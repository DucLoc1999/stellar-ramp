import db from '../db';
import { emitDisburseCrypto, isKafkaAvailable } from './queueService';

export const SUPPORTED_TOKEN_ISSUER = process.env.TOKEN_ADDRESS || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const DEFAULT_ASSET_CODE = process.env.ASSET_CODE || 'USDC';

const HORIZON_URLS: Record<string, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  public: 'https://horizon.stellar.org',
};

function getHorizonUrl(network?: string): string {
  const net = network?.toLowerCase() || process.env.STELLAR_NETWORK || 'testnet';
  return HORIZON_URLS[net] || HORIZON_URLS.testnet;
}

export interface TrustlineCheckResult {
  exists: boolean;
  authorized: boolean;
  hasLimit: boolean;
  availableLimit: number;
  error?: string;
}

interface HorizonBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
}

interface HorizonAccount {
  balances: HorizonBalance[];
}

export async function getHorizonAccount(publicKey: string, network?: string): Promise<HorizonAccount | null> {
  const horizonUrl = getHorizonUrl(network);
  try {
    const res = await fetch(`${horizonUrl}/accounts/${publicKey}`);
    if (!res.ok) return null;
    return await res.json() as HorizonAccount;
  } catch {
    return null;
  }
}

export async function checkTrustline(
  publicKey: string,
  assetCode: string,
  assetIssuer: string,
  amount?: string
): Promise<TrustlineCheckResult> {
  const account = await getHorizonAccount(publicKey);
  if (!account) {
    return { exists: false, authorized: false, hasLimit: false, availableLimit: 0, error: 'Account not found' };
  }

  const balance = account.balances.find(
    (b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer
  );

  if (!balance) {
    return { exists: false, authorized: false, hasLimit: false, availableLimit: 0 };
  }

  const balanceNum = parseFloat(balance.balance);
  const authorized = balanceNum > 0;
  const limit = balance.limit ? parseFloat(balance.limit) : Infinity;
  const availableLimit = limit === Infinity ? Infinity : limit - balanceNum;

  if (amount) {
    const requestedAmount = parseFloat(amount);
    const hasEnoughLimit = availableLimit >= requestedAmount;
    return { exists: true, authorized, hasLimit: hasEnoughLimit, availableLimit };
  }

  return { exists: true, authorized, hasLimit: true, availableLimit };
}

export async function hasTrustline(publicKey: string, assetCode: string, assetIssuer: string): Promise<boolean> {
  const result = await checkTrustline(publicKey, assetCode, assetIssuer);
  return result.exists && result.authorized;
}

export async function getUsdcBalance(publicKey: string, network?: string): Promise<string> {
  const account = await getHorizonAccount(publicKey, network);
  if (!account) return '0';

  const usdcBalance = account.balances.find(
    (b) => b.asset_code === DEFAULT_ASSET_CODE && b.asset_issuer === SUPPORTED_TOKEN_ISSUER
  );

  return usdcBalance ? usdcBalance.balance : '0';
}

export async function getXlmBalance(publicKey: string, network?: string): Promise<string> {
  const account = await getHorizonAccount(publicKey, network);
  if (!account) return '0';

  const nativeBalance = account.balances.find((b) => b.asset_type === 'native');
  return nativeBalance ? nativeBalance.balance : '0';
}

export async function loadHotWallet() {
  return { publicKey: '', network: 'testnet' };
}

export async function initStellarServer(network?: string) {
  return null;
}

export interface DisburseResult {
  hash: string;
  success: boolean;
  error?: string;
}

const DEFAULT_WORKER_URL = 'http://localhost:8787';

async function callWorker(
  destination: string,
  amount: string,
  memo: string,
  network: string,
  tokenCode?: string,
  tokenAddress?: string
): Promise<{ hash: string; success: boolean; error?: string }> {
  const workerUrl = process.env.WORKER_URL || DEFAULT_WORKER_URL;
  const authToken = process.env.WORKER_AUTH_TOKEN;

  if (!authToken) {
    throw new Error('WORKER_AUTH_TOKEN not configured');
  }

  const requestBody: Record<string, unknown> = {
    destination,
    amount,
    memo,
    network,
  };

  if (tokenCode && tokenAddress) {
    requestBody.token_code = tokenCode;
    requestBody.token_address = tokenAddress;
  }

  const amountFormatted = parseFloat(amount).toFixed(7).replace(/\.?0+$/, '');
  requestBody.amount = amountFormatted;

  console.log('[StellarService] Calling worker:', {
    url: workerUrl,
    destination,
    amount: amountFormatted,
    memo,
    network,
    token_code: tokenCode || 'XLM (native)',
    token_address: tokenAddress || 'N/A',
  });

  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      hash: '',
      success: false,
      error: `Worker error ${response.status}: ${errorText}`,
    };
  }

  const data = await response.json() as { success: boolean; hash?: string; ledger?: number; error?: string };

  if (!data.success) {
    return {
      hash: data.hash || '',
      success: false,
      error: data.error || 'Worker returned failure',
    };
  }

  return {
    hash: data.hash || '',
    success: true,
  };
}

export async function disburseUSDC(
  orderId: number,
  recipientPublicKey: string,
  amount: string,
  paymentCode: string,
  tokenAddress: string,
  assetCode: string
): Promise<DisburseResult> {
  const network = (process.env.STELLAR_NETWORK || 'testnet').toUpperCase();
  const tokenCode = assetCode || DEFAULT_ASSET_CODE;

  const result = await callWorker(
    recipientPublicKey,
    amount,
    paymentCode,
    network,
    tokenCode,
    tokenAddress
  );

  if (result.success) {
    await db('orders')
      .where({ id: orderId })
      .update({
        transaction_hash: result.hash,
        order_state: 3,
        processing_state: 14,
      });
  } else {
    const errorMsg = result.error || '';

    await db('orders')
      .where({ id: orderId })
      .update({
        order_state: 4,
        processing_state: 15,
        error_message: errorMsg,
      });
  }

  return result;
}

export async function triggerDisburse(
  orderId: number,
  recipientPublicKey: string,
  amount: string,
  paymentCode: string,
  tokenAddress: string,
  assetCode: string
): Promise<DisburseResult> {
  await db('orders')
    .where({ id: orderId })
    .update({ processing_state: 13 });

  if (isKafkaAvailable()) {
    await emitDisburseCrypto({
      orderId,
      recipientPublicKey,
      amount,
      paymentCode,
      tokenAddress,
      assetCode,
    });
    return { hash: '', success: true };
  } else {
    console.log(`[StellarService] Direct disburse for order ${orderId}`);
    return await disburseUSDC(orderId, recipientPublicKey, amount, paymentCode, tokenAddress, assetCode);
  }
}
