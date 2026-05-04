import {
  Keypair,
  Asset,
  TransactionBuilder,
  Operation,
  Horizon,
  Networks,
  BASE_FEE,
  Transaction,
  StrKey,
  xdr,
} from '@stellar/stellar-sdk';
import db from '../db';
import { decrypt } from './encryptionService';
import { emitDisburseCrypto, isKafkaAvailable } from './queueService';

const HORIZON_URLS = {
  testnet: 'https://horizon-testnet.stellar.org',
  public: 'https://horizon.stellar.org',
};

const RPC_URLS: Record<string, string> = {
  testnet: 'https://soroban-testnet.stellar.org',
  public: 'https://soroban-rpc.mainnet.stellar.gateway.fm',
};

let serverInstance: Horizon.Server | null = null;
let rpcServerInstance: any = null;
let networkPassphrase: string | null = null;

export const SUPPORTED_TOKEN_ISSUER = process.env.TOKEN_ADDRESS || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const DEFAULT_ASSET_CODE = process.env.ASSET_CODE || 'USDC';

export function initStellarServer(network: 'testnet' | 'public' = 'testnet'): Horizon.Server {
  serverInstance = new Horizon.Server(HORIZON_URLS[network]);
  networkPassphrase = network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;
  return serverInstance;
}

export function getStellarServer(): Horizon.Server {
  if (!serverInstance) {
    const network = (process.env.STELLAR_NETWORK as 'testnet' | 'public') || 'testnet';
    console.log('Stellar server not initialized. Initializing with network:', network);
    return initStellarServer(network);
  }
  return serverInstance;
}

let RpcServerClass: any = null;

function getRpcServerClass() {
  if (!RpcServerClass) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rpcModule = require('@stellar/stellar-sdk/rpc');
    RpcServerClass = rpcModule.Server;
  }
  return RpcServerClass;
}

export function initRpcServer(network: 'testnet' | 'public' = 'testnet') {
  const RpcServer = getRpcServerClass();
  const url = RPC_URLS[network];
  rpcServerInstance = new RpcServer(url);
  return rpcServerInstance;
}

export function getRpcServer() {
  if (!rpcServerInstance) {
    const network = (process.env.STELLAR_NETWORK as 'testnet' | 'public') || 'testnet';
    console.log('RPC server not initialized. Initializing with network:', network);
    return initRpcServer(network);
  }
  return rpcServerInstance;
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
  if (!publicKey || !assetCode || !assetIssuer) {
    return { exists: false, authorized: false, hasLimit: false, availableLimit: 0, error: 'Invalid parameters' };
  }

  const rpc = getRpcServer();

  try {
    await rpc.getAccount(publicKey);
  } catch {
    return { exists: false, authorized: false, hasLimit: false, availableLimit: 0, error: 'Account does not exist' };
  }

  const asset = new Asset(assetCode, assetIssuer);

  const publicKeyXdr = xdr.PublicKey.publicKeyTypeEd25519(
    StrKey.decodeEd25519PublicKey(publicKey),
  );

  const trustlineKeyXdr = new xdr.LedgerKeyTrustLine({
    accountId: publicKeyXdr,
    asset: asset.toTrustLineXDRObject(),
  });

  const key = xdr.LedgerKey.trustline(trustlineKeyXdr);

  let entries;
  try {
    entries = await (rpc as any).getLedgerEntries(key);
  } catch {
    return { exists: false, authorized: false, hasLimit: false, availableLimit: 0, error: 'Failed to query trustline' };
  }

  if (!entries.entries || entries.entries.length === 0) {
    return { exists: false, authorized: false, hasLimit: false, availableLimit: 0 };
  }

  const ledgerData = entries.entries[0];

  let trustlineData;
  try {
    trustlineData = ledgerData.val.trustLine();
  } catch {
    return { exists: false, authorized: false, hasLimit: false, availableLimit: 0, error: 'Failed to parse trustline data' };
  }

  const authorized = Number(trustlineData.flags()) === 1;

  const limit = Number(trustlineData.limit().toBigInt()) / 10 ** 7;
  const balance = Number(trustlineData.balance().toBigInt()) / 10 ** 7;
  const availableLimit = limit - balance;

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
    const trustlineCheck = await checkTrustline(recipientPublicKey, assetCode, assetIssuer, amount);
    if (!trustlineCheck.exists) {
      return {
        hash: '',
        success: false,
        error: `RECIPIENT_NO_TRUSTLINE:${assetCode}`,
      };
    }
    if (!trustlineCheck.authorized) {
      return {
        hash: '',
        success: false,
        error: `RECIPIENT_TRUSTLINE_NOT_AUTHORIZED:${assetCode}`,
      };
    }
    if (!trustlineCheck.hasLimit) {
      return {
        hash: '',
        success: false,
        error: `RECIPIENT_INSUFFICIENT_LIMIT:${assetCode}`,
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

export async function disburseUSDC(
  orderId: number,
  recipientPublicKey: string,
  amount: string,
  paymentCode: string,
  tokenAddress: string
): Promise<DisburseResult> {
  const assetCode = process.env.ASSET_CODE || 'USDC';
  const asset = new Asset(assetCode, tokenAddress);

  const result = await executeStellarPayment(recipientPublicKey, amount, asset);

  if (result.success) {
    await db('orders')
      .where({ id: orderId })
      .update({
        transaction_hash: result.hash,
        order_state: 3,
        processing_state: 14,
      });
  } else {
    const isNoTrustline = result.error?.startsWith('RECIPIENT_NO_TRUSTLINE');
    await db('orders')
      .where({ id: orderId })
      .update({
        order_state: 4,
        processing_state: 15,
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