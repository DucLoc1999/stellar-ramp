import crypto from 'crypto';
import db from '../db';
import { getQuote } from './priceService';
import { createSepayOrder } from './sepayPgService';
import { fireCallback } from './callbackService';
import { triggerDisburse, hasTrustline, SUPPORTED_TOKEN_ISSUER, DEFAULT_ASSET_CODE, checkTrustline } from './stellarService';
import { getConfigNumber } from './configService';
import { executePayout } from './payoutService';
import { emitOrderPaid } from './queueService';
import type { DepositRequest, WithdrawalRequest } from '../models/types';
import type { Usdt247Order, Usdt247PaymentInfo, Usdt247Timestamp } from '../models/usdt247';
import { OrderState, ProcessingState } from '../models/types';

export { DepositRequest, WithdrawalRequest, OrderState } from '../models/types';

/** Order expiry duration in milliseconds. Defaults to 5 minutes. */
export const ORDER_EXPIRY_MS = (Number(process.env.ORDER_EXPIRY_MINUTES) || 5) * 60 * 1000;

function isSupportedToken(tokenAddress: string | null | undefined, assetCode: string): boolean {
  const addr = tokenAddress || '';
  if (assetCode.toUpperCase() === 'XLM' && !addr) {
    return true;
  }
  return addr === SUPPORTED_TOKEN_ISSUER && (assetCode === DEFAULT_ASSET_CODE || assetCode === 'USDC');
}

interface OrderRow {
  id: number;
  payment_code: string;
  direction: 'buy' | 'sell';
  usdt_amount: string | number;
  rate: string | number;
  net_vnd: string | number;
  fee_rate: string | number;
  fee_vnd: string | number;
  order_state: number;
  payment_status: string;
  processing_state?: number | null;
  transaction_hash: string | null;
  error_message: string | null;
  chain_id: number;
  token_address: string;
  asset_code: string;
  recipient: string | null;
  callback: string;
  payment_info: Usdt247PaymentInfo | Record<string, unknown> | string | null;
  cancelled_at?: Date | null;
  expired_at: Date | null;
  created_at: Date;
  updated_at: Date;
  va_number: string | null;
  transfer_content: string | null;
  amount: string | number | null;
  sepay_transaction_id?: string | null;
  last_webhook_id?: string | null;
  bank_id: string | null;
  bank_account_name: string | null;
  bank_account_no: string | null;
}

export interface CreateOptions {
  clientIp?: string;
}

export interface CreateDepositParams extends DepositRequest {
  _clientIp?: string;
}

function toTimestamp(date: Date): Usdt247Timestamp {
  const ms = date.getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanos: (ms % 1000) * 1_000_000,
  };
}

async function toApiOrder(
  order: OrderRow,
  overrides?: Partial<Pick<Usdt247Order, 'body' | 'pay_data' | 'user_id' | 'client_ip' | 'outcome'>>
): Promise<Usdt247Order> {
  const rate = typeof order.rate === 'string' ? Number(order.rate) : order.rate;
  const feeVnd = typeof order.fee_vnd === 'string' ? Number(order.fee_vnd) : order.fee_vnd;
  const expiry = order.expired_at ?? new Date(order.created_at.getTime() + ORDER_EXPIRY_MS);
  let paymentInfo: Usdt247PaymentInfo | null = null;
  if (order.payment_info && typeof order.payment_info === 'object') {
    paymentInfo = order.payment_info as Usdt247PaymentInfo;
  } else if (typeof order.payment_info === 'string') {
    try {
      paymentInfo = JSON.parse(order.payment_info) as Usdt247PaymentInfo;
    } catch {
      paymentInfo = null;
    }
  }

  const assetCode = (order.asset_code || 'USDC').toUpperCase();

  const netVnd = typeof order.net_vnd === 'string' ? Number(order.net_vnd) : order.net_vnd;

  return {
    id: String(order.id),
    user_id: overrides?.user_id ?? '',
    order_type: order.direction,
    external_id: null,
    code: order.payment_code,
    provider: order.direction === 'buy' ? 'sepay' : 'chain',
    callback: order.callback,
    amount: typeof order.usdt_amount === 'string' ? parseFloat(order.usdt_amount) : order.usdt_amount,
    currency: assetCode === 'XLM' ? 'XLM' : 'USDC',
    rate,
    token_address: order.token_address,
    asset_code: order.asset_code || '',
    recipient: order.recipient ?? '',
    chain_id: order.chain_id,
    partner_id: "1",  // update when have partner assign system
    state: order.order_state,
    processing_state: order.processing_state ?? 0,
    body: overrides?.body ?? {
      bankInfo: {
        bankName: order.va_number ? '' : '',
        bankAccountName: '',
        bankAccountNumber: order.va_number ?? '',
        transferContent: order.transfer_content ?? '',
        vaAmount: order.amount ? Number(order.amount) : 0,
      },
    },
    pay_data: overrides?.pay_data ?? null,
    payment_info: paymentInfo,
    expired_at: toTimestamp(expiry),
    created_at: toTimestamp(order.created_at),
    updated_at: toTimestamp(order.updated_at),
    client_ip: overrides?.client_ip ?? '',
    outcome: overrides?.outcome ?? '',
    net_vnd: netVnd,
    total_fee_vnd: feeVnd,
    transaction_hash: order.transaction_hash,
  };
}

export async function formatOrderResponse(order: OrderRow): Promise<Usdt247Order> {
  return toApiOrder(order);
}

function generatePaymentCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(10);
  let code = 'DH';
  for (let i = 0; i < 10; i++) code += chars[bytes[i] % 36];
  return code;
}

function firstRow<T>(result: T | T[]): T {
  return (Array.isArray(result) ? result[0] : result) as T;
}

function firstInsertedId(result: unknown): number {
  if (Array.isArray(result)) return Number(result[0]);
  if (typeof result === 'object' && result !== null && 'id' in result) {
    return Number((result as { id: number | string }).id);
  }
  return Number(result);
}

export async function createBuyOrder(usdt_amount: number, asset: string = 'USDC') {
  const quote = await getQuote('buy', usdt_amount, asset);
  const payment_code = generatePaymentCode();
  const sepayOrder = await createSepayOrder({
    payment_code,
    net_vnd: quote.net_vnd,
  });

  const inserted = await db('orders').insert({
    payment_code,
    direction: 'buy',
    usdt_amount: quote.usdt_amount,
    rate: quote.original_rate,  // have spread
    net_vnd: quote.net_vnd,  // have spread and fee_vnd
    fee_rate: quote.fee_rate,
    fee_vnd: quote.fee_vnd,
    payment_status: 'pending',
    va_number: sepayOrder.va_number,
    transfer_content: sepayOrder.transfer_content,
    amount: sepayOrder.amount,
    order_state: OrderState.CREATED,
  });
  const id = firstInsertedId(inserted);

  return { id, payment_code, sepayOrder, quote };
}

export async function confirmPayment(params: {
  payment_code: string;
  sepay_transaction_id: string;
  vnd_received: number;
}) {
  const order = await db('orders')
    .where({ payment_code: params.payment_code, payment_status: 'pending' })
    .first();

  if (!order) return;

  // Guard: reject payment on expired orders
  if (isOrderExpired(order)) {
    console.log(`[OrderService] ⏭ Rejecting payment for expired order: ${params.payment_code}`);
    await performCancel(order, 'ORDER_EXPIRED');
    return;
  }

  await db('orders')
    .where({ payment_code: params.payment_code, payment_status: 'pending' })
    .update({
      payment_status: 'payment_received',
      sepay_transaction_id: params.sepay_transaction_id,
      vnd_received: params.vnd_received,
      payment_confirmed_at: db.fn.now(),
    });

  if (order.direction === 'buy' && order.recipient) {
    await db('orders')
      .where({ payment_code: params.payment_code })
      .update({ order_state: OrderState.PROCESSING });
    const usdtAmount = order.usdt_amount.toString();
    const assetCode = order.asset_code || DEFAULT_ASSET_CODE;
    const result = await triggerDisburse(order.id, order.recipient, usdtAmount, params.payment_code, order.token_address, assetCode);
    if (result.success && order.callback) {
      fireCallback(order.callback, order.id, order.order_state, OrderState.COMPLETED, 10, 14, result.hash).catch((err) => console.error('[OrderService] fireCallback failed:', err));
    } else if (!result.success && result.error) {
      await db('orders').where({ id: order.id }).update({ order_state: OrderState.FAILED, processing_state: 15, error_message: result.error });
    }
  }
}

export async function findPendingOrderByCode(payment_code: string) {
  return db('orders').where({ payment_code, payment_status: 'pending' }).first();
}

export async function getOrderByCode(payment_code: string) {
  return db('orders').where({ payment_code }).first();
}

export async function getOrderById(id: number) {
  return db('orders').where({ id }).first();
}

export async function createDeposit(
  req: DepositRequest,
  options?: CreateOptions
): Promise<Usdt247Order> {
  const tokenAddress = req.token_address || '';
  if (!req.asset_code || !isSupportedToken(tokenAddress, req.asset_code)) {
    throw new Error('UNSUPPORTED_TOKEN');
  }

  if (req.asset_code.toUpperCase() === 'XLM' && Number(req.amount) < 1) {
    throw new Error('XLM_MIN_AMOUNT_1');
  }

  const trustlineCheck = await checkTrustline(req.recipient, req.asset_code, tokenAddress, req.amount);
  if (!trustlineCheck.exists) {
    console.error(`[OrderService] Trustline check failed for ${req.recipient}: trustline does not exist for ${req.asset_code} (issuer: ${tokenAddress})`);
    throw new Error('RECIPIENT_TRUSTLINE_INSUFFICIENT_LIMIT');
  }
  if (!trustlineCheck.hasLimit) {
    console.error(`[OrderService] Trustline check failed for ${req.recipient}: insufficient limit. Available: ${trustlineCheck.availableLimit}, Requested: ${req.amount}`);
    throw new Error('RECIPIENT_TRUSTLINE_INSUFFICIENT_LIMIT');
  }

  const usdtAmount = Number(req.amount);
  const result = await createBuyOrder(usdtAmount, req.asset_code);
  const expiredAt = new Date(Date.now() + ORDER_EXPIRY_MS);
  const updated = await db('orders')
    .where({ payment_code: result.payment_code })
    .update({
      chain_id: req.chain_id,
      token_address: req.token_address,
      asset_code: req.asset_code,
      recipient: req.recipient,
      callback: req.callback,
      order_state: OrderState.CREATED,
      processing_state: 10,
      expired_at: expiredAt,
      va_number: result.sepayOrder.va_number,
      transfer_content: result.sepayOrder.transfer_content,
      amount: result.sepayOrder.amount,
    })
    .returning('*');
  const order = firstRow<OrderRow>(updated as OrderRow | OrderRow[]);
  fireCallback(req.callback, order.id, 0, OrderState.CREATED, 0, 10).catch((err) => console.error('[OrderService] fireCallback failed:', err));
  const walletAddress = process.env.WALLET_ADDRESS || '';
  return await toApiOrder(order as OrderRow, {
    user_id: req.user_id ?? '',
    client_ip: options?.clientIp ?? '',
    pay_data: {
      address: walletAddress,
      qr_link: result.sepayOrder.qr_code_url,
      qr_code: result.sepayOrder.qr_code_url,
    },
    body: {
      qr_link: result.sepayOrder.qr_code_url,
      qr_code: result.sepayOrder.qr_code_url,
      bankInfo: {
        bankName: result.sepayOrder.bank_info.bank_name,
        bankAccountName: result.sepayOrder.bank_info.account_holder_name,
        bankAccountNumber: result.sepayOrder.bank_info.account_number,
        transferContent: result.sepayOrder.transfer_content,
        vaAmount: result.sepayOrder.amount,
      },
    },
  });
}

export async function createWithdrawal(
  req: WithdrawalRequest,
  options?: CreateOptions
): Promise<Usdt247Order> {
  const tokenAddress = req.token_address || '';
  if (!req.asset_code || !isSupportedToken(tokenAddress, req.asset_code)) {
    throw new Error('UNSUPPORTED_TOKEN');
  }
  const usdtAmount = Number(req.amount);
  const quote = await getQuote('sell', usdtAmount, req.asset_code);
  const payment_code = generatePaymentCode();
  const expiredAt = new Date(Date.now() + ORDER_EXPIRY_MS);
  const inserted = await db('orders')
    .insert({
      payment_code,
      direction: 'sell',
      usdt_amount: quote.usdt_amount,
      rate: quote.rate,
      net_vnd: quote.net_vnd,
      fee_rate: quote.fee_rate,
      fee_vnd: quote.fee_vnd,
      payment_status: 'pending',
      order_state: OrderState.CREATED,
      processing_state: 10,
      chain_id: req.chain_id,
      token_address: tokenAddress,
      asset_code: req.asset_code,
      callback: req.callback,
      bank_id: req.payment_info.bank_id,
      bank_account_name: req.payment_info.full_name,
      bank_account_no: req.payment_info.account_number,
      payment_info: JSON.stringify(req.payment_info),
      expired_at: expiredAt,
    });
  const order = await db('orders').where({ payment_code }).first<OrderRow>();
  if (!order) {
    throw new Error('Failed to create withdrawal order');
  }
  fireCallback(req.callback, order.id, 0, OrderState.CREATED, 0, 10).catch((err) => console.error('[OrderService] fireCallback failed:', err));

  const walletAddress = process.env.WALLET_ADDRESS || '';
  return await toApiOrder(order as OrderRow, {
    user_id: req.user_id ?? '',
    client_ip: options?.clientIp ?? '',
    pay_data: { address: walletAddress },
    body: {
      bankInfo: {
        bankName: req.payment_info.bank_id,
        bankAccountName: req.payment_info.full_name,
        bankAccountNumber: req.payment_info.account_number,
        transferContent: payment_code,
        vaAmount: quote.net_vnd,
      },
    },
  });
}

/** Check whether an order has passed its expiry time. */
function isOrderExpired(order: OrderRow): boolean {
  const expiry = order.expired_at
    ? new Date(order.expired_at).getTime()
    : new Date(order.created_at).getTime() + ORDER_EXPIRY_MS;
  return Date.now() >= expiry;
}

/**
 * Auto-cancel all CREATED orders that have passed their expiry time.
 * Called by the expiry scheduler on a periodic interval.
 */
export async function cancelExpiredOrders(): Promise<number> {
  const now = new Date();
  const fallbackCutoff = new Date(Date.now() - ORDER_EXPIRY_MS);

  // Orders with explicit expired_at that have passed, OR
  // orders without expired_at whose created_at + ORDER_EXPIRY_MS has passed
  const expiredOrders: OrderRow[] = await db('orders')
    .where('order_state', OrderState.CREATED)
    .where('payment_status', 'pending')
    .where(function (this: any) {
      this.where('expired_at', '<=', now)
        .orWhere(function (this: any) {
          this.whereNull('expired_at').andWhere('created_at', '<=', fallbackCutoff);
        });
    });

  let cancelled = 0;
  for (const order of expiredOrders) {
    const result = await performCancel(order, 'ORDER_EXPIRED');
    if (result.data) cancelled++;
  }
  return cancelled;
}

interface CancelResult {
  data?: {
    payment_code: string;
    order_state: number;
    cancelled_at: string;
  };
  error?: string;
}

async function performCancel(order: OrderRow, reason?: string): Promise<CancelResult> {
  const currentState = order.order_state || 0;

  if (currentState === OrderState.CANCELLED || currentState === OrderState.COMPLETED || currentState === OrderState.FAILED) {
    return { error: 'CANCEL_NOT_ALLOWED' };
  }

  if (order.sepay_transaction_id || order.payment_status === 'payment_received') {
    return { error: 'CANCEL_NOT_ALLOWED' };
  }

  const idOrPaymentCode = order.payment_code ? { payment_code: order.payment_code } : { id: order.id };
  const updatedRows = await db('orders')
    .where(idOrPaymentCode)
    .update({
      order_state: OrderState.CANCELLED,
      cancelled_at: db.fn.now(),
      cancel_reason: reason || null,
    })
    .returning('*');
  const updated = firstRow<OrderRow>(updatedRows as OrderRow | OrderRow[]);

  if (order.callback) {
    fireCallback(order.callback, order.id, currentState, OrderState.CANCELLED, order.processing_state || 0, order.processing_state || 0).catch((err) => console.error('[OrderService] fireCallback failed:', err));
  }

  return {
    data: {
      payment_code: updated.payment_code,
      order_state: updated.order_state,
      cancelled_at: updated.cancelled_at?.toISOString() || new Date().toISOString(),
    },
  };
}

export async function cancelOrder(paymentCode: string, reason?: string): Promise<CancelResult> {
  const order = await db('orders').where({ payment_code: paymentCode }).first();
  if (!order) {
    return { error: 'ORDER_NOT_FOUND' };
  }
  return performCancel(order, reason);
}

export async function cancelOrderById(orderId: number, reason?: string): Promise<CancelResult> {
  const order = await db('orders').where({ id: orderId }).first();
  if (!order) {
    return { error: 'ORDER_NOT_FOUND' };
  }
  return performCancel(order, reason);
}

export async function updateOrderState(paymentCode: string, newState: number | string): Promise<void> {
  const order = await db('orders').where({ payment_code: paymentCode }).first();
  if (!order) return;

  const oldState = order.order_state || 0;
  const oldProcessingState = order.processing_state || 0;
  const stateNum = typeof newState === 'string' ? Number(newState) : newState;
  await db('orders').where({ payment_code: paymentCode }).update({ order_state: stateNum });

  if (order.callback) {
    fireCallback(order.callback, order.id, oldState, stateNum, oldProcessingState, oldProcessingState).catch((err) => console.error('[OrderService] fireCallback failed:', err));
  }
}

function isPaymentCodeFormat(memo: string): boolean {
  return /^DH[A-Z0-9]{10}$/.test(memo);
}

export async function processSellPayment(params: {
  txHash: string;
  from?: string;
  amount: string;
  asset: string;
  tokenIssuer?: string;
  memo?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { txHash, from, amount, asset, tokenIssuer, memo } = params;

  if (!memo || !isPaymentCodeFormat(memo)) {
    console.log(`[OrderService] ⏭ Ignoring: memo='${memo || ''}' (invalid format or empty)`);
    return { success: false, error: 'MEMO_INVALID_FORMAT' };
  }

  // ── Deduplication: check if this txHash was already processed ──
  const existingLog = await db('webhook_logs').where({ tx_hash: txHash }).first();
  if (existingLog) {
    console.log(`[OrderService] ⏭ Ignoring: txHash=${txHash} already processed`);
    return { success: false, error: 'DUPLICATE_TX' };
  }

  // Log this webhook immediately to prevent concurrent processing
  const [insertedWebhookLog] = await db('webhook_logs').insert({
    tx_hash: txHash,
    source: 'stellar',
    body: JSON.stringify(params),
  }).returning('id');
  const webhookLogId = Number((insertedWebhookLog as any).id ?? insertedWebhookLog);

  const orderByCode = await db('orders')
    .where({ payment_code: memo, direction: 'sell' })
    .first();

  if (!orderByCode) {
    console.log(`[OrderService] ⏭ Ignoring: no order found with payment_code=${memo}`);
    return { success: false, error: 'ORDER_NOT_FOUND' };
  }

  if (orderByCode.order_state === OrderState.COMPLETED) {
    console.log(`[OrderService] ⏭ Ignoring: order ${memo} already COMPLETED`);
    return { success: false, error: 'ORDER_ALREADY_COMPLETED' };
  }

  if (orderByCode.order_state !== OrderState.CREATED) {
    console.log(`[OrderService] ⏭ Ignoring: order ${memo} state=${orderByCode.order_state} not CREATED`);
    return { success: false, error: 'ORDER_NOT_ELIGIBLE' };
  }

  // Guard: reject payment on expired orders
  if (isOrderExpired(orderByCode)) {
    console.log(`[OrderService] ⏭ Rejecting: order ${memo} is expired`);
    await performCancel(orderByCode, 'ORDER_EXPIRED');
    return { success: false, error: 'ORDER_EXPIRED' };
  }

  // ── Strict asset code + issuer validation ──
  const orderAssetCode = (orderByCode.asset_code || '').toUpperCase();
  const incomingAsset = asset.toUpperCase();

  if (incomingAsset !== orderAssetCode) {
    console.log(`[OrderService] ⏭ Rejecting: asset mismatch — received ${incomingAsset}, order expects ${orderAssetCode}`);
    return { success: false, error: 'ASSET_CODE_MISMATCH' };
  }

  if (orderAssetCode === 'XLM') {
    // XLM is native — tokenIssuer should be empty/undefined
    if (tokenIssuer && tokenIssuer.trim() !== '') {
      console.log(`[OrderService] ⏭ Rejecting: XLM order but received non-native asset (issuer=${tokenIssuer})`);
      return { success: false, error: 'ASSET_ISSUER_MISMATCH' };
    }
  } else {
    // Non-native (USDC etc): issuer must match order's token_address
    const expectedIssuer = orderByCode.token_address || '';
    if (!tokenIssuer || tokenIssuer !== expectedIssuer) {
      console.log(`[OrderService] ⏭ Rejecting: issuer mismatch — received '${tokenIssuer || ''}', expected '${expectedIssuer}'`);
      return { success: false, error: 'ASSET_ISSUER_MISMATCH' };
    }
  }

  // ── Exact amount matching ──
  const orderUsdtAmount = typeof orderByCode.usdt_amount === 'string'
    ? parseFloat(orderByCode.usdt_amount)
    : orderByCode.usdt_amount;
  const webhookAmount = parseFloat(amount);

  if (webhookAmount !== orderUsdtAmount) {
    console.log(`[OrderService] ⏭ Rejecting: amount mismatch — received ${webhookAmount}, order expects exactly ${orderUsdtAmount}`);
    return { success: false, error: 'AMOUNT_MISMATCH' };
  }

  const order = orderByCode;
  const oldState = order.order_state || 0;
  const oldProcessingState = order.processing_state || 0;

  await db('orders')
    .where({ id: order.id })
    .update({
      payment_status: 'payment_received',
      order_state: OrderState.PROCESSING,
      processing_state: ProcessingState.SELL_PAYMENT_RECEIVED,
      transaction_hash: txHash,
      last_webhook_id: String(webhookLogId),
    });

  if (order.callback) {
    fireCallback(order.callback, order.id, oldState, OrderState.PROCESSING, oldProcessingState, ProcessingState.SELL_PAYMENT_RECEIVED).catch((err) => console.error('[OrderService] fireCallback failed:', err));
  }

  const payInfo = typeof order.payment_info === 'string'
    ? JSON.parse(order.payment_info)
    : order.payment_info;

  const payoutResult = await executePayout({
    orderId: order.id,
    amount: Number(order.net_vnd),
    bankId: order.bank_id || (payInfo?.bank_id as string) || '',
    bankAccountName: order.bank_account_name || (payInfo?.full_name as string) || '',
    bankAccountNo: order.bank_account_no || (payInfo?.account_number as string) || '',
    description: order.payment_code,
  });

  if (payoutResult.success) {
    await db('orders')
      .where({ id: order.id })
      .update({
        order_state: OrderState.COMPLETED,
        processing_state: ProcessingState.SELL_PAYOUT_COMPLETED,
      });

    if (order.callback) {
      fireCallback(order.callback, order.id, OrderState.PROCESSING, OrderState.COMPLETED, ProcessingState.SELL_PAYMENT_RECEIVED, ProcessingState.SELL_PAYOUT_COMPLETED).catch((err) => console.error('[OrderService] fireCallback failed:', err));
    }

    await emitOrderPaid({
      orderId: order.id,
      amount,
      txHash,
      paymentCode: order.payment_code,
    });
  } else {
    await db('orders')
      .where({ id: order.id })
      .update({
        order_state: OrderState.FAILED,
        processing_state: ProcessingState.SELL_PAYOUT_FAILED,
        error_message: payoutResult.error || 'Payout failed',
      });

    if (order.callback) {
      fireCallback(order.callback, order.id, OrderState.PROCESSING, OrderState.FAILED, ProcessingState.SELL_PAYMENT_RECEIVED, ProcessingState.SELL_PAYOUT_FAILED).catch((err) => console.error('[OrderService] fireCallback failed:', err));
    }
  }

  return { success: payoutResult.success, error: payoutResult.error };
}

export async function bypassSellPayment(adminKey: string, orderId: number): Promise<{ success?: boolean; error?: string }> {
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!bootstrapPassword || adminKey !== bootstrapPassword) {
    return { error: 'INVALID_ADMIN_CODE' };
  }

  const order = await db('orders').where({ id: orderId }).first();
  if (!order) return { error: 'ORDER_NOT_FOUND' };
  if (order.direction !== 'sell') return { error: 'NOT_SELL_ORDER' };
  if (order.order_state !== OrderState.CREATED) return { error: 'ORDER_NOT_ELIGIBLE' };
  if (order.payment_status !== 'pending') return { error: 'PAYMENT_ALREADY_RECEIVED' };

  const result = await processSellPayment({
    txHash: `bypass-${Date.now()}`,
    amount: String(order.usdt_amount),
    asset: order.asset_code || 'USDC',
    tokenIssuer: order.token_address,
    memo: order.payment_code,
  });

  return result.success ? { success: true } : { error: result.error };
}

export async function bypassPayment(adminKey: string, orderId: number): Promise<{ success?: boolean; error?: string }> {
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!bootstrapPassword || adminKey !== bootstrapPassword) {
    return { error: 'INVALID_ADMIN_CODE' };
  }

  const order = await db('orders').where({ id: orderId }).first();
  if (!order) {
    return { error: 'ORDER_NOT_FOUND' };
  }

  const paymentCode = order.payment_code;

  if (order.direction !== 'buy') {
    return { error: 'NOT_BUY_ORDER' };
  }

  const currentState = order.order_state || 0;
  if (currentState === OrderState.COMPLETED || currentState === OrderState.FAILED || currentState === OrderState.CANCELLED) {
    return { error: 'ORDER_NOT_ELIGIBLE' };
  }

  if (order.payment_status !== 'pending') {
    return { error: 'PAYMENT_ALREADY_RECEIVED' };
  }

  const sepay_transaction_id = `bypass-${Date.now()}`;
  const [insertedWebhookLog] = await db('webhook_logs').insert({
    sepay_transaction_id,
    source: 'admin-bypass',
    body: JSON.stringify({ bypass: true, orderId, sepay_transaction_id }),
  }).returning('id');
  const webhookLogId = Number((insertedWebhookLog as any).id ?? insertedWebhookLog);
  try {
    await confirmPayment({
      payment_code: paymentCode,
      sepay_transaction_id,
      vnd_received: Number(order.net_vnd),
    });
    await db('orders').where({ id: orderId }).update({ last_webhook_id: String(webhookLogId) });
    return { success: true };
  } catch (err) {
    console.error(`[Bypass] confirmPayment failed for order ${orderId}:`, err);
    return { error: 'CONFIRMATION_FAILED' };
  }
}
