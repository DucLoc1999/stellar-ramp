import 'dotenv/config';

if (process.stdout._handle && typeof process.stdout._handle.setBlocking === 'function') {
  process.stdout._handle.setBlocking(true);
}
if (process.stderr._handle && typeof process.stderr._handle.setBlocking === 'function') {
  process.stderr._handle.setBlocking(true);
}

import * as StellarSdk from '@stellar/stellar-sdk';
import { Kafka, Producer, logLevel } from 'kafkajs';

const Asset = StellarSdk.Asset;
const Server = StellarSdk.Horizon.Server;

const STELLAR_HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';
const STELLAR_HORIZON_PUBLIC = 'https://horizon.stellar.org';

interface TokenTransferEvent {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  asset: string;
  tokenIssuer: string;
  timestamp: string;
  walletLabel: string;
  memo?: string;
  memoType?: string;
}

let producer: Producer | null = null;
let closeStream: (() => void) | null = null;
let running = true;

const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
if (!WALLET_ADDRESS) {
  console.error('[StellarListener] WALLET_ADDRESS not set');
  process.exit(1);
}
const WALLET_LABEL = 'hot_wallet';
const NETWORK = process.env.STELLAR_NETWORK || 'testnet';

function getHorizonUrl(network: string): string {
  return network === 'public' ? STELLAR_HORIZON_PUBLIC : STELLAR_HORIZON_TESTNET;
}

function getMonitoredAssets(): Asset[] {
  const code = process.env.ASSET_CODE || 'USDC';
  const issuer = process.env.TOKEN_ADDRESS || '';
  if (code.toUpperCase() === 'XLM' && !issuer) {
    return [Asset.native()];
  }
  if (!issuer) {
    console.warn('[StellarListener] TOKEN_ADDRESS not set, defaulting to USDC issuer');
    return [new Asset('USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN')];
  }
  return [new Asset(code, issuer)];
}

async function initKafka(): Promise<boolean> {
  const brokers = process.env.KAFKA_BROKERS;
  console.log('[StellarListener] Kafka brokers:', brokers);
  if (!brokers || brokers.trim() === '') {
    console.log('[StellarListener] Kafka not configured, using fallback only');
    return false;
  }

  try {
    producer = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'payment_svc',
      brokers: brokers.split(','),
      logLevel: logLevel.WARN,
    }).producer();

    await producer.connect();
    console.log('[StellarListener] Kafka connected');
    return true;
  } catch (error) {
    console.log('[StellarListener] Kafka connection failed:', (error as Error).message);
    return false;
  }
}

async function emitToKafka(event: TokenTransferEvent): Promise<boolean> {
  if (!producer) return false;

  const topic = process.env.KAFKA_TOKEN_IN_TOPIC || 'stellar_token_in';
  try {
    await producer.send({
      topic,
      messages: [{ key: event.txHash, value: JSON.stringify(event) }],
    });
    console.log(`[StellarListener] ✅ Kafka emitted: ${event.txHash}, ${event.amount} ${event.asset}`);
    return true;
  } catch (error) {
    console.error(`[StellarListener] ❌ Kafka emit error: ${(error as Error).message}`);
    return false;
  }
}

async function emitToFallback(event: TokenTransferEvent): Promise<boolean> {
  const url = process.env.STELLAR_LISTENER_FALLBACK_URL;
  if (!url) {
    console.log('[StellarListener] Fallback URL not set');
    return false;
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authToken = process.env.STELLAR_LISTENER_FALLBACK_AUTH_TOKEN;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const timeoutMs = Number(process.env.CALLBACK_TIMEOUT_MS || 10000);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) {
      console.log(`[StellarListener] ✅ Fallback POST success: ${event.txHash}`);
      return true;
    } else {
      console.error(`[StellarListener] ❌ Fallback POST failed: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error(`[StellarListener] ❌ Fallback POST error: ${(error as Error).message}`);
    return false;
  }
}

async function emit(event: TokenTransferEvent): Promise<void> {
  if (producer) {
    const kafkaSuccess = await emitToKafka(event);
    if (kafkaSuccess) return;
    if (process.env.STELLAR_LISTENER_FALLBACK_URL) {
      await emitToFallback(event);
    }
  } else if (process.env.STELLAR_LISTENER_FALLBACK_URL) {
    await emitToFallback(event);
  } else {
    console.error('[StellarListener] No output channel available for event:', event.txHash);
  }
}

async function processTransaction(
  tx: any,
  walletLabel: string,
  hotWallet: string,
  monitoredAssets: Asset[]
): Promise<void> {
  try {
    console.log(`[StellarListener] 📥 New transaction: ${tx.hash}`);

    const operations = await tx.operations();

    for (const op of operations.records) {
      if (op.type !== 'payment' || op.type_i !== 1) continue;
      if (op.to !== hotWallet) continue;

      const assetType = op.asset_type;
      const assetCode = assetType === 'native' ? 'XLM' : (op.asset_code || '');
      const tokenIssuer = assetType === 'native' ? '' : (op.asset_issuer || '');

      console.log(`[StellarListener] ⚡ Payment: ${op.amount} ${assetCode} from ${op.from.slice(0, 8)}... memo='${tx.memo || ''}' (type: ${assetType})`);

      // For native XLM: always forward if there's a valid memo (sell order)
      // For non-native: check against monitored assets list
      const isNativeWithMemo = assetType === 'native' && tx.memo && tx.memo.trim() !== '';
      const isMonitored = monitoredAssets.some(
        (a) =>
          (a.isNative() && assetType === 'native') ||
          (!a.isNative() && a.code === assetCode && a.issuer === tokenIssuer)
      );

      if (!isMonitored && !isNativeWithMemo) {
        console.log(`[StellarListener] ⏭ Skipped (not monitored): ${assetCode} (issuer: ${tokenIssuer || 'native'})`);
        continue;
      }

      const event: TokenTransferEvent = {
        txHash: tx.hash,
        memo: tx.memo || '',
        memoType: tx.memo_type || '',
        from: op.from,
        to: op.to,
        amount: op.amount,
        asset: assetCode,
        tokenIssuer,
        timestamp: tx.created_at,
        walletLabel,
      };

      console.log(`[StellarListener] ➡ Emitting: ${op.amount} ${assetCode} → ${walletLabel}`);
      await emit(event);
    }
  } catch (error) {
    console.error(`[StellarListener] Error processing tx ${tx.hash}:`, error);
  }
}

function startWalletListener(
  server: Server,
  walletAddress: string,
  walletLabel: string,
  monitoredAssets: Asset[]
): void {
  console.log(`[StellarListener] Starting listener for ${walletLabel} (${walletAddress})`);

  closeStream = server
    .transactions()
    .forAccount(walletAddress)
    .cursor('now')
    .stream({
      onmessage: async (tx: any) => {
        await processTransaction(tx, walletLabel, walletAddress, monitoredAssets);
      },
      onerror: (error: any) => {
        console.error(`[StellarListener] Stream error for ${walletLabel}:`, error.message || error);
      },
    });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log('[StellarListener] Starting...');

  const kafkaEnabled = await initKafka();

  if (!kafkaEnabled && !process.env.STELLAR_LISTENER_FALLBACK_URL) {
    console.error('[StellarListener] No output configured. Exiting.');
    process.exit(1);
  }

  const monitoredAssets = getMonitoredAssets();
  const horizonUrl = getHorizonUrl(NETWORK);
  const server = new Server(horizonUrl);

  console.log(`[StellarListener] Horizon: ${horizonUrl}`);
  console.log(`[StellarListener] Network: ${NETWORK}`);
  console.log(`[StellarListener] Wallet: ${WALLET_LABEL} (${WALLET_ADDRESS})`);
  console.log(`[StellarListener] Monitoring assets: ${monitoredAssets.map((a) => a.code).join(', ')}`);

  startWalletListener(server, WALLET_ADDRESS, WALLET_LABEL, monitoredAssets);

  console.log('[StellarListener] Listener started, waiting for events...');

  process.on('SIGINT', async () => {
    console.log('[StellarListener] Shutting down...');
    running = false;

    if (closeStream) {
      closeStream();
      closeStream = null;
    }

    if (producer) {
      await producer.disconnect();
      producer = null;
    }

    console.log('[StellarListener] Stopped');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('[StellarListener] SIGTERM received');
    process.emit('SIGINT');
  });

  while (running) {
    await sleep(5000);
  }
}

main().catch((error) => {
  console.error('[StellarListener] Fatal error:', error);
  process.exit(1);
});