import * as StellarSdk from '@stellar/stellar-sdk';
import db from '../db';
import { emitDisburseCrypto, isKafkaAvailable } from './queueService';
import { OrderState } from '../models/types';
import { fireCallback } from './callbackService';
import { signTxHash, resolveSourcePublicKey } from './gcpKmsService';

export const SUPPORTED_TOKEN_ISSUER = process.env.TOKEN_ADDRESS || '';
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
  const isXlmNative = !assetIssuer || assetCode.toUpperCase() === 'XLM';

  const account = await getHorizonAccount(publicKey);

  console.log(`[StellarService] checkTrustline: publicKey=${publicKey}, assetCode=${assetCode}, assetIssuer=${assetIssuer}, amount=${amount}`);

  if (!account) {
    if (isXlmNative) {
      console.log(`[StellarService] Account not found but XLM is native, returning success`);
      return { exists: true, authorized: true, hasLimit: true, availableLimit: Infinity };
    }
    console.error(`[StellarService] Account not found: ${publicKey}`);
    return { exists: false, authorized: false, hasLimit: false, availableLimit: 0, error: 'Account not found' };
  }

  if (isXlmNative) {
    const nativeBal = account.balances.find((b) => b.asset_type === 'native');
    if (!nativeBal) {
      console.error(`[StellarService] No native balance found for: ${publicKey}`);
      return { exists: false, authorized: false, hasLimit: false, availableLimit: 0 };
    }
    const balanceNum = parseFloat(nativeBal.balance);
    console.log(`[StellarService] XLM native balance: ${balanceNum}`);
    if (amount) {
      const requestedAmount = parseFloat(amount);
      const hasEnough = balanceNum >= requestedAmount;
      console.log(`[StellarService] XLM check: balance=${balanceNum}, requested=${requestedAmount}, hasEnough=${hasEnough}`);
      return { exists: true, authorized: true, hasLimit: hasEnough, availableLimit: balanceNum };
    }
    return { exists: true, authorized: true, hasLimit: true, availableLimit: balanceNum };
  }

  const balance = account.balances.find(
    (b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer
  );

  if (!balance) {
    console.error(`[StellarService] No trustline found for ${assetCode} (issuer: ${assetIssuer}) on ${publicKey}`);
    return { exists: false, authorized: false, hasLimit: false, availableLimit: 0 };
  }

  const balanceNum = parseFloat(balance.balance);
  const limit = balance.limit ? parseFloat(balance.limit) : Infinity;
  const availableLimit = limit === Infinity ? Infinity : limit - balanceNum;

  console.log(`[StellarService] Trustline found: balance=${balanceNum}, limit=${limit}, availableLimit=${availableLimit}`);

  if (amount) {
    const requestedAmount = parseFloat(amount);
    const hasEnoughLimit = availableLimit >= requestedAmount;
    console.log(`[StellarService] Limit check: available=${availableLimit}, requested=${requestedAmount}, hasEnoughLimit=${hasEnoughLimit}`);
    return { exists: true, authorized: true, hasLimit: hasEnoughLimit, availableLimit };
  }

  return { exists: true, authorized: true, hasLimit: true, availableLimit };
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



export async function initStellarServer(network?: string) {
  return null;
}

// ---------------------------------------------------------------------------
// GCP KMS signing path
// ---------------------------------------------------------------------------

export const MIN_XLM_BALANCE = '0.00001';
export const DEFAULT_STARTING_BALANCE = '2.5';

const STROOP_SCALE = 10n ** 7n;

export function toStroops(amount: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(amount);
  if (!match) {
    throw new Error('amount must have no more than 7 decimal places');
  }
  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? '').padEnd(7, '0');
  return whole * STROOP_SCALE + BigInt(fraction || '0');
}

export interface KmsNativeAsset {
  isNative: true;
  asset: StellarSdk.Asset;
  assetCode: 'XLM';
  assetIssuer?: undefined;
}

export interface KmsTokenAsset {
  isNative: false;
  asset: StellarSdk.Asset;
  assetCode: string;
  assetIssuer: string;
}

export type KmsAssetSpec = KmsNativeAsset | KmsTokenAsset;

export interface HorizonLikeAccount {
  balances: any[];
}

export function findNativeBalance(account: HorizonLikeAccount): string {
  const nativeBalance = account.balances.find((b) => b.asset_type === 'native');
  return nativeBalance ? String(nativeBalance.balance ?? '0') : '0';
}

export function findTokenBalance(account: HorizonLikeAccount, assetCode: string, assetIssuer: string): { balance: string; isAuthorized: boolean } | null {
  const trustline = account.balances.find((b) => {
    return (
      b.asset_code === assetCode &&
      b.asset_issuer === assetIssuer
    );
  });

  if (!trustline) return null;
  return {
    balance: String(trustline.balance ?? '0'),
    isAuthorized: Boolean(trustline.is_authorized ?? true),
  };
}

export function checkSourceWallet(
  sourceAccount: HorizonLikeAccount,
  asset: KmsAssetSpec,
  paymentAmount: string
): string | null {
  const xlmBalance = parseFloat(findNativeBalance(sourceAccount));
  if (xlmBalance < parseFloat(MIN_XLM_BALANCE)) {
    return `INSUFFICIENT_GAS: XLM balance ${xlmBalance} below minimum ${MIN_XLM_BALANCE}`;
  }

  if (!asset.isNative) {
    const sourceBalance = findTokenBalance(sourceAccount, asset.assetCode, asset.assetIssuer);

    if (!sourceBalance) {
      return 'WALLET_NO_TRUSTLINE: Source wallet missing trustline for token';
    }

    if (!sourceBalance.isAuthorized) {
      return 'WALLET_NOT_AUTHORIZED: Source trustline is frozen';
    }

    const tokenBalanceNum = parseFloat(sourceBalance.balance);
    const paymentAmountNum = parseFloat(paymentAmount);
    if (tokenBalanceNum < paymentAmountNum) {
      return `INSUFFICIENT_TOKEN_BALANCE: Available ${tokenBalanceNum}, required ${paymentAmountNum}`;
    }
  }

  return null;
}

export function buildAssetSpec(code?: string, issuer?: string): KmsAssetSpec {
  const isNative = !issuer || !code || code.toUpperCase() === 'XLM';
  if (isNative) {
    return {
      isNative: true,
      asset: StellarSdk.Asset.native(),
      assetCode: 'XLM',
    };
  }
  return {
    isNative: false,
    asset: new StellarSdk.Asset(code.toUpperCase(), issuer),
    assetCode: code.toUpperCase(),
    assetIssuer: issuer,
  };
}

function getSdkNetworkConfig(network: string): { serverUrl: string; networkPassphrase: string } {
  const normalized = network.toUpperCase();
  if (normalized === 'PUBLIC' || normalized === 'MAINNET') {
    return {
      serverUrl: HORIZON_URLS.public,
      networkPassphrase: StellarSdk.Networks.PUBLIC,
    };
  }
  return {
    serverUrl: HORIZON_URLS.testnet,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  };
}

export function attachKmsSignature(
  transaction: StellarSdk.Transaction,
  sourcePublicKey: string,
  signature: Buffer,
  networkPassphrase: string
): StellarSdk.Transaction {
  const envelope = transaction.toEnvelope();
  const hint = StellarSdk.Keypair.fromPublicKey(sourcePublicKey).signatureHint();
  const decorated = new StellarSdk.xdr.DecoratedSignature({ hint, signature });
  envelope.v1().signatures().push(decorated);
  return new StellarSdk.Transaction(envelope, networkPassphrase);
}

async function signAndSubmitTransaction(
  server: StellarSdk.Horizon.Server,
  networkPassphrase: string,
  transaction: StellarSdk.Transaction,
  sourcePublicKey: string
): Promise<{ hash: string; success: boolean; error?: string }> {
  try {
    const hash = transaction.hash();
    const signature = await signTxHash(hash);
    const signed = attachKmsSignature(transaction, sourcePublicKey, signature, networkPassphrase);
    const result = await server.submitTransaction(signed);
    return { hash: result.hash, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { hash: '', success: false, error: message };
  }
}

export async function kmsDisburse(
  destination: string,
  amount: string,
  memo: string,
  network: string,
  tokenCode?: string,
  tokenAddress?: string
): Promise<{ hash: string; success: boolean; error?: string }> {
  const { serverUrl, networkPassphrase } = getSdkNetworkConfig(network);
  const server = new StellarSdk.Horizon.Server(serverUrl);
  const sourcePublicKey = await resolveSourcePublicKey();
  const sourceAccount = await server.loadAccount(sourcePublicKey);

  const amountFormatted = parseFloat(amount).toFixed(7).replace(/\.?0+$/, '');
  toStroops(amountFormatted);

  const asset = buildAssetSpec(tokenCode, tokenAddress);
  const validationError = checkSourceWallet(sourceAccount, asset, amountFormatted);
  if (validationError) {
    return { hash: '', success: false, error: validationError };
  }

  const destExists = await server.loadAccount(destination).catch(() => null);

  let builder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE.toString(),
    networkPassphrase,
  });

  if (!destExists && asset.isNative) {
    builder = builder.addOperation(
      StellarSdk.Operation.createAccount({
        destination,
        startingBalance: amountFormatted,
      })
    );
  } else {
    builder = builder.addOperation(
      StellarSdk.Operation.payment({
        destination,
        asset: asset.asset,
        amount: amountFormatted,
      })
    );
  }

  if (memo) {
    builder = builder.addMemo(StellarSdk.Memo.text(memo));
  }

  const transaction = builder.setTimeout(30).build();
  return signAndSubmitTransaction(server, networkPassphrase, transaction, sourcePublicKey);
}

async function kmsFund(destination: string, startingBalance?: string): Promise<FundWalletResult> {
  const network = (process.env.STELLAR_NETWORK || 'testnet').toUpperCase();
  const { serverUrl, networkPassphrase } = getSdkNetworkConfig(network);
  const server = new StellarSdk.Horizon.Server(serverUrl);
  const sourcePublicKey = await resolveSourcePublicKey();
  const sourceAccount = await server.loadAccount(sourcePublicKey);

  const balance = startingBalance || DEFAULT_STARTING_BALANCE;
  toStroops(balance);

  const xlmBalance = parseFloat(findNativeBalance(sourceAccount));
  if (xlmBalance < parseFloat(balance) + parseFloat(MIN_XLM_BALANCE)) {
    return {
      success: false,
      hash: '',
      already_exists: false,
      error: `INSUFFICIENT_GAS: XLM balance ${xlmBalance}`,
    };
  }

  const destExists = await server.loadAccount(destination).catch(() => null);
  if (destExists) {
    return { success: true, hash: '', already_exists: true };
  }

  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE.toString(),
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.createAccount({
        destination,
        startingBalance: balance,
      })
    )
    .setTimeout(30)
    .build();

  const result = await signAndSubmitTransaction(server, networkPassphrase, transaction, sourcePublicKey);
  return { success: result.success, hash: result.hash, already_exists: false, error: result.error };
}

export interface DisburseResult {
  hash: string;
  success: boolean;
  error?: string;
}

export interface FundWalletResult {
  success: boolean;
  hash: string;
  already_exists: boolean;
  error?: string;
}

export async function fundWallet(
  destination: string,
  startingBalance?: string
): Promise<FundWalletResult> {
  return kmsFund(destination, startingBalance);
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

  // Idempotency guard: never disburse an order that is not awaiting disbursement.
  // Protects against Kafka replay (fromBeginning) and duplicate/retried messages.
  const order = await db('orders').where({ id: orderId }).first();
  if (!order) {
    return { hash: '', success: false, error: 'ORDER_NOT_FOUND' };
  }
  if (order.order_state !== OrderState.PROCESSING) {
    console.log(`[StellarService] ⏭ Skipping disburse for order ${orderId}: state=${order.order_state} (already processed)`);
    return { hash: order.transaction_hash || '', success: order.order_state === OrderState.COMPLETED, error: order.order_state === OrderState.COMPLETED ? undefined : 'ORDER_NOT_ELIGIBLE' };
  }

  const result = await kmsDisburse(recipientPublicKey, amount, paymentCode, network, tokenCode, tokenAddress);

  if (result.success) {
    await db('orders')
      .where({ id: orderId })
      .update({
        transaction_hash: result.hash,
        order_state: OrderState.COMPLETED,
        processing_state: 14,
      });

    if (order.callback) {
      fireCallback(order.callback, orderId, OrderState.PROCESSING, OrderState.COMPLETED, 13, 14, result.hash)
        .catch((err) => console.error('[StellarService] fireCallback failed:', err));
    }
  } else {
    const errorMsg = (result.error || '').slice(0, 500);

    try {
      await db('orders')
        .where({ id: orderId })
        .update({
          order_state: OrderState.FAILED,
          processing_state: 15,
          error_message: errorMsg,
        });
    } catch (dbErr) {
      console.error(`[StellarService] Failed to mark order ${orderId} as FAILED:`, dbErr);
    }

    if (order.callback) {
      fireCallback(order.callback, orderId, OrderState.PROCESSING, OrderState.FAILED, 13, 15)
        .catch((err) => console.error('[StellarService] fireCallback failed:', err));
    }
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
