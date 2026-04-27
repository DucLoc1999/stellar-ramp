import {
  Keypair,
  Asset,
  TransactionBuilder,
  Operation,
  Horizon,
  Networks,
  BASE_FEE,
  Transaction,
} from '@stellar/stellar-sdk';
import db from '../db';
import { decrypt } from './encryptionService';
import { emitDisburseCrypto } from './queueService';

const HORIZON_URLS = {
  testnet: 'https://horizon-testnet.stellar.org',
  public: 'https://horizon.stellar.org',
};

let serverInstance: Horizon.Server | null = null;
let networkPassphrase: string | null = null;

export const SUPPORTED_TOKEN_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const DEFAULT_ASSET_CODE = 'USDC';

export function initStellarServer(network: 'testnet' | 'public' = 'testnet'): Horizon.Server {
  serverInstance = new Horizon.Server(HORIZON_URLS[network]);
  networkPassphrase = network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;
  return serverInstance;
}

export function getStellarServer(): Horizon.Server {
  if (!serverInstance) {
    const network = (process.env.STELLAR_NETWORK as 'testnet' | 'public') || 'testnet';
    return initStellarServer(network);
  }
  return serverInstance;
}

export async function loadHotWallet() {
  const walletName = process.env.STELLAR_HOT_WALLET_NAME || 'stellar_hot_wallet';
  const wallet = await db('system_wallets')
    .where({ name: walletName, is_active: true })
    .first();

  if (!wallet) {
    throw new Error(`Hot wallet '${walletName}' not found or inactive`);
  }

  const secretKey = decrypt(wallet.encrypted_secret);
  const keypair = Keypair.fromSecret(secretKey);

  if (keypair.publicKey() !== wallet.public_key) {
    throw new Error('Wallet public key mismatch');
  }

  return {
    keypair,
    publicKey: keypair.publicKey(),
    network: wallet.network,
  };
}

export interface TrustlineResult {
  success: boolean;
  hash?: string;
  error?: string;
}

export async function hasTrustline(publicKey: string, assetCode: string, assetIssuer: string): Promise<boolean> {
  const server = getStellarServer();
  const account = await server.loadAccount(publicKey);
  return account.balances.some((b) => {
    if ('asset_code' in b && 'asset_issuer' in b) {
      return b.asset_code === assetCode && b.asset_issuer === assetIssuer;
    }
    return false;
  });
}

export async function ensureTrustline(
  keypair: Keypair,
  assetCode: string = DEFAULT_ASSET_CODE,
  assetIssuer: string = SUPPORTED_TOKEN_ISSUER
): Promise<TrustlineResult> {
  const server = getStellarServer();
  const publicKey = keypair.publicKey();

  const account = await server.loadAccount(publicKey);
  const asset = new Asset(assetCode, assetIssuer);

  const hasTrust = account.balances.some((b) => {
    if ('asset_code' in b && 'asset_issuer' in b) {
      return b.asset_code === assetCode && b.asset_issuer === assetIssuer;
    }
    return false;
  });

  if (hasTrust) {
    return { success: true };
  }

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE.toString(),
    networkPassphrase: networkPassphrase || Networks.TESTNET,
  })
    .addOperation(
      Operation.changeTrust({
        asset,
        limit: '922337203685.4775807',
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(keypair);

  try {
    const response = await server.submitTransaction(transaction);
    return { success: true, hash: response.hash };
  } catch (error: unknown) {
    const err = error as { response?: { data?: { extras?: { result_codes?: { operations?: string[] } } } }; message?: string };
    const resultCodes = err.response?.data?.extras?.result_codes?.operations;
    return {
      success: false,
      error: resultCodes ? `Operations failed: ${resultCodes.join(', ')}` : err.message,
    };
  }
}

export interface DisburseResult {
  hash: string;
  success: boolean;
  error?: string;
}

export async function executeStellarPayment(
  recipientPublicKey: string,
  amount: string,
  asset: Asset = Asset.native()
): Promise<DisburseResult> {
  const server = getStellarServer();
  const wallet = await loadHotWallet();
  const assetCode = asset.code;
  const assetIssuer = asset.issuer;

  if (assetIssuer) {
    const recipientHasTrustline = await hasTrustline(recipientPublicKey, assetCode, assetIssuer);
    if (!recipientHasTrustline) {
      return {
        hash: '',
        success: false,
        error: `RECIPIENT_NO_TRUSTLINE:${assetCode}`,
      };
    }
  }

  const sourceAccount = await server.loadAccount(wallet.publicKey);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE.toString(),
    networkPassphrase: networkPassphrase || Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: recipientPublicKey,
        asset: asset,
        amount: amount,
      })
    )
    .setTimeout(60)
    .build();

  transaction.sign(wallet.keypair);

  try {
    const response = await server.submitTransaction(transaction);
    return { hash: response.hash, success: true };
  } catch (error: unknown) {
    const err = error as { response?: { data?: { extras?: { result_codes?: { operations?: string[] } } } }; message?: string };
    const resultCodes = err.response?.data?.extras?.result_codes?.operations;
    return {
      hash: '',
      success: false,
      error: resultCodes ? `Operations failed: ${resultCodes.join(', ')}` : err.message,
    };
  }
}

export async function disburseUSDT(
  orderId: number,
  recipientPublicKey: string,
  amount: string,
  paymentCode: string,
  tokenAddress: string
): Promise<DisburseResult> {
  const assetCode = process.env.STELLAR_ASSET_CODE || 'USDC';
  const asset = new Asset(assetCode, tokenAddress);

  const result = await executeStellarPayment(recipientPublicKey, amount, asset);

  if (result.success) {
    await db('orders')
      .where({ id: orderId })
      .update({
        transaction_hash: result.hash,
        order_state: 3,
      });
  } else {
    const isNoTrustline = result.error?.startsWith('RECIPIENT_NO_TRUSTLINE');
    await db('orders')
      .where({ id: orderId })
      .update({
        order_state: 4,
        error_message: isNoTrustline ? 'RECIPIENT_NO_TRUSTLINE' : result.error,
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
): Promise<void> {
  await emitDisburseCrypto({
    orderId,
    recipientPublicKey,
    amount,
    paymentCode,
    tokenAddress,
  });
}