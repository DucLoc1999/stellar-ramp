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
  paymentCode: string
): Promise<DisburseResult> {
  const asset = new Asset(
    'USDT',
    'GA7ZFU7U6PRFWNK6W7LQHLQR7YLSSXEGQBWAFWALNQI2E3CR4THWIC2D'
  );

  const result = await executeStellarPayment(recipientPublicKey, amount, asset);

  if (result.success) {
    await db('orders')
      .where({ id: orderId })
      .update({
        transaction_hash: result.hash,
        order_state: 3,
      });
  } else {
    await db('orders')
      .where({ id: orderId })
      .update({
        order_state: 4,
        error_message: result.error,
      });
  }

  return result;
}

export async function triggerDisburse(
  orderId: number,
  recipientPublicKey: string,
  amount: string,
  paymentCode: string
): Promise<void> {
  await emitDisburseCrypto({
    orderId,
    recipientPublicKey,
    amount,
    paymentCode,
  });
}