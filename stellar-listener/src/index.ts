import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as StellarSdk from '@stellar/stellar-sdk';

const Server = StellarSdk.Horizon.Server;
const Asset = StellarSdk.Asset;
import { Kafka, Producer, logLevel } from 'kafkajs';

const STELLAR_HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';
const STELLAR_HORIZON_PUBLIC = 'https://horizon.stellar.org';

interface Config {
  stellar: {
    network: string;
    wallets: Array<{
      address: string;
      label: string;
    }>;
  };
  assets: Array<{
    code: string;
    issuer: string;
  }>;
  kafka: {
    brokers: string;
    client_id: string;
    topic: string;
  };
  fallback: {
    enabled: boolean;
    url: string;
    auth_token: string;
    timeout_ms: number;
  };
}

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

let config: Config;
let producer: Producer | null = null;
let streams: Array<() => void> = [];
let running = true;

function loadConfig(): Config {
  const configPath = path.join(__dirname, '..', 'config.yaml');
  const fileContents = fs.readFileSync(configPath, 'utf8');
  const cfg = yaml.load(fileContents) as Config;
  return cfg;
}

function getHorizonUrl(network: string): string {
  return network === 'public' ? STELLAR_HORIZON_PUBLIC : STELLAR_HORIZON_TESTNET;
}

function buildAsset(code: string, issuer: string): Asset {
  return new Asset(code, issuer);
}

async function initKafka(): Promise<boolean> {
  console.log("[StellarListener] initKafka", config.kafka.brokers)
  if (!config.kafka.brokers || config.kafka.brokers.trim() === '') {
    console.log('[StellarListener] Kafka not configured, using fallback only');
    return false;
  }

  try {
    producer = new Kafka({
      clientId: config.kafka.client_id,
      brokers: config.kafka.brokers.split(','),
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

  try {
    await producer.send({
      topic: config.kafka.topic,
      messages: [
        {
          key: event.txHash,
          value: JSON.stringify(event),
        },
      ],
    });
    console.log(`[StellarListener] Kafka emitted: ${event.txHash}, ${event.amount} ${event.asset}`);
    return true;
  } catch (error) {
    console.error('[StellarListener] Kafka emit error:', (error as Error).message);
    return false;
  }
}

async function emitToFallback(event: TokenTransferEvent): Promise<boolean> {
  if (!config.fallback.enabled || !config.fallback.url) {
    console.log('[StellarListener] Fallback disabled or no URL configured');
    return false;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.fallback.auth_token) {
      headers['Authorization'] = `Bearer ${config.fallback.auth_token}`;
    }

    const response = await fetch(config.fallback.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(config.fallback.timeout_ms || 10000),
    });

    if (response.ok) {
      console.log(`[StellarListener] Fallback POST success: ${event.txHash}`);
      return true;
    } else {
      console.error(`[StellarListener] Fallback POST failed: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('[StellarListener] Fallback POST error:', (error as Error).message);
    return false;
  }
}

async function emit(event: TokenTransferEvent): Promise<void> {
  if (producer) {
    const kafkaSuccess = await emitToKafka(event);
    if (kafkaSuccess) return;

    if (config.fallback.enabled) {
      await emitToFallback(event);
    }
  } else {
    if (config.fallback.enabled) {
      await emitToFallback(event);
    } else {
      console.error('[StellarListener] No output channel available for event:', event.txHash);
    }
  }
}

async function processTransaction(
  tx: any,
  walletLabel: string,
  hotWallet: string,
  monitoredAssets: Asset[]
): Promise<void> {
  try {
    const operations = await tx.operations();

    for (const op of operations.records) {
      if (op.type !== 'payment' || op.type_i !== 1) continue;
      if (op.to !== hotWallet) continue;

      const opAsset = op.asset;
      const assetCode = opAsset === 'native' ? 'XLM' : opAsset;
      const tokenIssuer = opAsset === 'native' ? '' : (op.asset_issuer || '');

      const isMonitored = monitoredAssets.some(
        (a) => (a.isNative() && opAsset === 'native') ||
          (!a.isNative() && a.code === assetCode && a.issuer === tokenIssuer)
      );

      if (!isMonitored) continue;

      const amount = op.amount;
      const timestamp = tx.created_at;

      const event: TokenTransferEvent = {
        txHash: tx.hash,
        memo: tx.memo || '',
        memoType: tx.memo_type || '',
        from: op.from,
        to: op.to,
        amount,
        asset: assetCode,
        tokenIssuer,
        timestamp,
        walletLabel,
      };

      await emit(event);
    }
  } catch (error) {
    console.error(`[StellarListener] Error processing tx ${tx.hash}:`, error);
  }
}

function startWalletListener(
  server: Server,
  wallet: { address: string; label: string },
  monitoredAssets: Asset[]
): void {
  console.log(`[StellarListener] Starting listener for ${wallet.label} (${wallet.address})`);

  const closeStream = server
    .transactions()
    .forAccount(wallet.address)
    .cursor('now')
    .stream({
      onmessage: async (tx: any) => {
        await processTransaction(tx, wallet.label, wallet.address, monitoredAssets);
      },
      onerror: (error: any) => {
        console.error(`[StellarListener] Stream error for ${wallet.label}:`, error.message || error);
      },
    });

  streams.push(closeStream);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log('[StellarListener] Starting...');

  config = loadConfig();
  console.log(`[StellarListener] Config loaded: network=${config.stellar.network}, wallets=${config.stellar.wallets.length}`);

  const kafkaEnabled = await initKafka();

  if (!kafkaEnabled && !config.fallback.enabled) {
    console.error('[StellarListener] No output configured. Exiting.');
    process.exit(1);
  }

  const horizonUrl = getHorizonUrl(config.stellar.network);
  const server = new Server(horizonUrl);

  const monitoredAssets = config.assets.map((a) => buildAsset(a.code, a.issuer));

  console.log(`[StellarListener] Horizon: ${horizonUrl}`);
  console.log(`[StellarListener] Monitoring assets: ${config.assets.map((a) => a.code).join(', ')}`);

  for (const wallet of config.stellar.wallets) {
    startWalletListener(server, wallet, monitoredAssets);
  }

  console.log(`[StellarListener] All listeners started, waiting for events...`);

  process.on('SIGINT', async () => {
    console.log('[StellarListener] Shutting down...');
    running = false;

    for (const close of streams) {
      close();
    }
    streams = [];

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