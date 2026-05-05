import db from '../db';
import { emitDisburseCrypto, isKafkaAvailable } from './queueService';

export const SUPPORTED_TOKEN_ISSUER = process.env.TOKEN_ADDRESS || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const DEFAULT_ASSET_CODE = process.env.ASSET_CODE || 'USDC';

export interface TrustlineCheckResult {
  exists: boolean;
  authorized: boolean;
  hasLimit: boolean;
  availableLimit: number;
  error?: string;
}

export async function checkTrustline(
  publicKey: string,
  assetCode: string,
  assetIssuer: string,
  amount?: string
): Promise<TrustlineCheckResult> {
  return { exists: true, authorized: true, hasLimit: true, availableLimit: 999999 };
}

export async function hasTrustline(publicKey: string, assetCode: string, assetIssuer: string): Promise<boolean> {
  return true;
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
  tokenAddress: string
): Promise<DisburseResult> {
  const network = (process.env.STELLAR_NETWORK || 'testnet').toUpperCase();
  const tokenCode = process.env.ASSET_CODE || DEFAULT_ASSET_CODE;

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
    let mappedError = errorMsg;

    if (errorMsg.includes('RECIPIENT_NO_TRUSTLINE')) {
      mappedError = 'RECIPIENT_NO_TRUSTLINE';
    } else if (errorMsg.includes('RECIPIENT_NOT_AUTHORIZED')) {
      mappedError = 'RECIPIENT_TRUSTLINE_NOT_AUTHORIZED';
    } else if (errorMsg.includes('RECIPIENT_INSUFFICIENT_LIMIT')) {
      mappedError = 'RECIPIENT_INSUFFICIENT_LIMIT';
    } else if (errorMsg.includes('WALLET_NO_TRUSTLINE')) {
      console.error(`[StellarService] Wallet missing trustline for ${tokenCode}`);
    }

    await db('orders')
      .where({ id: orderId })
      .update({
        order_state: 4,
        processing_state: 15,
        error_message: mappedError,
      });
  }

  return result;
}

export async function triggerDisburse(
  orderId: number,
  recipientPublicKey: string,
  amount: string,
  paymentCode: string,
  tokenAddress: string
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
    });
    return { hash: '', success: true };
  } else {
    console.log(`[StellarService] Direct disburse for order ${orderId}`);
    return await disburseUSDC(orderId, recipientPublicKey, amount, paymentCode, tokenAddress);
  }
}