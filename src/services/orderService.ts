import crypto from 'crypto';
import db from '../db';
import { getQuote, getMinFee } from './priceService';
import { createSepayOrder } from './sepayPgService';
import { fireCallback } from './callbackService';
import { triggerDisburse, hasTrustline, SUPPORTED_TOKEN_ISSUER, DEFAULT_ASSET_CODE, checkTrustline } from './stellarService';
import { getConfigNumber, getTokenConfig } from './configService';
import type { PartnerAuthContext } from './partnerService';
import { executePayout, getAccountBalance } from './payoutService';
import { emitOrderPaid } from './queueService';
import { consumeReservation, releaseReservation, reserveForOrder, rollbackReservation } from './reservationService';
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

  last_webhook_id?: string | null;
  bank_id: string | null;
  bank_account_name: string | null;
  bank_account_no: string | null;
  partner_id: string | null;
}

export interface CreateOptions {
  clientIp?: string;
  partner?: PartnerAuthContext;
}

export interface CreateDepositParams extends DepositRequest {
  _clientIp?: string;
}

function toTimestamp(date: Date | string | number): Usdt247Timestamp {
  const ms = new Date(date).getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanos: (ms % 1000) * 1_000_000,
  };
}
async function buildPartnerAdjustedQuote(
  direction: 'buy' | 'sell',
  usdtAmount: number,
  asset: string,
  partner?: PartnerAuthContext,
): Promise<{
  direction: 'buy' | 'sell';
  usdt_amount: number;
  rate: number;
  original_rate: number;
  spread: number;
  gross_vnd: number;
  fee_rate: number;
  fee_vnd: number;
  net_vnd: number;
  note: string;
}> {
  const baseQuote = await getQuote(direction, usdtAmount, asset);
  const partnerFeeRate = partner ? (direction === 'buy' ? partner.fee_buy : partner.fee_sell) : 0;
  const fee_rate = baseQuote.fee_rate + partnerFeeRate;
  const minFee = await getMinFee(asset);
  const fee_vnd = Math.max(Math.round(baseQuote.gross_vnd * fee_rate), minFee);
  const net_vnd = direction === 'buy' ? baseQuote.gross_vnd + fee_vnd : baseQuote.gross_vnd - fee_vnd;
  const assetCode = asset.toUpperCase();
  const note = direction === 'buy'
    ? 'Bạn cần chuyển ' + net_vnd.toLocaleString('vi-VN') + ' VND để nhận ' + usdtAmount + ' ' + assetCode
    : 'Bạn nhận được ' + net_vnd.toLocaleString('vi-VN') + ' VND khi bán ' + usdtAmount + ' ' + assetCode;
  return { ...baseQuote, fee_rate, fee_vnd, net_vnd, note };
}

async function toApiOrder(
  order: OrderRow,
  overrides?: Partial<Pick<Usdt247Order, 'body' | 'pay_data' | 'user_id' | 'client_ip' | 'outcome'>>
): Promise<Usdt247Order> {
  const rate = typeof order.rate === 'string' ? Number(order.rate) : order.rate;
  const feeVnd = typeof order.fee_vnd === 'string' ? Number(order.fee_vnd) : order.fee_vnd;
  const expiry = order.expired_at ?? new Date(order.created_at).getTime() + ORDER_EXPIRY_MS;
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
    partner_id: order.partner_id ?? null,
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

/**
 * Derive payment_status from order_state for backward compatibility.
 * Keeps payment_status in sync until the column is fully deprecated.
 */
function derivePaymentStatus(orderState: number): string {
  if (orderState >= OrderState.PROCESSING) return 'payment_received';
  return 'pending';
}

/**
 * Centralized order state transition. ALL order state changes MUST go through
 * this function to ensure payment_status stays in sync with order_state.
 */
async function transitionOrder(
  orderId: number,
  update: {
    order_state: number;
    processing_state?: number;
    transaction_hash?: string | null;
    last_webhook_id?: string;
    error_message?: string;
    vnd_received?: number;
    payment_confirmed_at?: unknown;
    cancelled_at?: unknown;
    cancel_reason?: string | null;
  }
): Promise<OrderRow> {
  const dbUpdate: Record<string, unknown> = {
    ...update,
    payment_status: derivePaymentStatus(update.order_state),
  };

  // Remove undefined values so we don't overwrite with NULL
  for (const key of Object.keys(dbUpdate)) {
    if (dbUpdate[key] === undefined) delete dbUpdate[key];
  }

  const updated = await db('orders')
    .where({ id: orderId })
    .update(dbUpdate)
    .returning('*');

  return firstRow<OrderRow>(updated as OrderRow | OrderRow[]);
}

export async function createBuyOrder(
  usdt_amount: number,
  asset: string = 'USDC',
  paymentCode?: string,
  options?: { partner?: PartnerAuthContext; quote?: Awaited<ReturnType<typeof buildPartnerAdjustedQuote>> },
) {
  const quote = options?.quote ?? await buildPartnerAdjustedQuote('buy', usdt_amount, asset, options?.partner);
  const payment_code = paymentCode || generatePaymentCode();
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
    partner_id: options?.partner?.id ?? null,
  });
  const id = firstInsertedId(inserted);

  return { id, payment_code, sepayOrder, quote };
}

export async function confirmPayment(params: {
  payment_code: string;
  vnd_received: number;
  last_webhook_id?: string;
}) {
  const order = await db('orders')
    .where({ payment_code: params.payment_code, order_state: OrderState.CREATED })
    .first();

  if (!order) return;

  // Guard: reject payment on expired orders
  if (isOrderExpired(order)) {
    console.log(`[OrderService] ⏭ Rejecting payment for expired order: ${params.payment_code}`);
    await performCancel(order, 'ORDER_EXPIRED');
    return;
  }

  const oldState = order.order_state || 0;

  await transitionOrder(order.id, {
    order_state: OrderState.PROCESSING,
    vnd_received: params.vnd_received,
    payment_confirmed_at: db.fn.now(),
    last_webhook_id: params.last_webhook_id,
  });

  if (order.direction === 'buy') {
    await consumeReservation(params.payment_code);
  }

  if (order.direction === 'buy' && order.recipient) {
    const usdtAmount = order.usdt_amount.toString();
    const assetCode = order.asset_code || DEFAULT_ASSET_CODE;
    const result = await triggerDisburse(order.id, order.recipient, usdtAmount, params.payment_code, order.token_address, assetCode);
    if (result.success && order.callback) {
      fireCallback(order.callback, order.id, oldState, OrderState.COMPLETED, 10, 14, result.hash).catch((err) => console.error('[OrderService] fireCallback failed:', err));
    } else if (!result.success && result.error) {
      await transitionOrder(order.id, {
        order_state: OrderState.FAILED,
        processing_state: 15,
        error_message: result.error,
      });
    }
  }
}

export async function findPendingOrderByCode(payment_code: string) {
  return db('orders').where({ payment_code, order_state: OrderState.CREATED }).first();
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
  const maxOrder = await getTokenConfig(req.asset_code, 'buy', 'max_order_amount');
  if (Number(req.amount) > maxOrder) {
    throw new Error('MAX_ORDER_EXCEEDED');
  }
  if (!trustlineCheck.exists) {
    console.error(`[OrderService] Trustline check failed for ${req.recipient}: trustline does not exist for ${req.asset_code} (issuer: ${tokenAddress})`);
    throw new Error('RECIPIENT_TRUSTLINE_INSUFFICIENT_LIMIT');
  }
  if (!trustlineCheck.hasLimit) {
    console.error(`[OrderService] Trustline check failed for ${req.recipient}: insufficient limit. Available: ${trustlineCheck.availableLimit}, Requested: ${req.amount}`);
    throw new Error('RECIPIENT_TRUSTLINE_INSUFFICIENT_LIMIT');
  }

  const expiredAt = new Date(Date.now() + ORDER_EXPIRY_MS);
  const paymentCode = generatePaymentCode();
  const usdtAmount = Number(req.amount);

  const quote = await buildPartnerAdjustedQuote('buy', usdtAmount, req.asset_code, options?.partner);

  const reserveResult = await reserveForOrder({
    paymentCode,
    direction: 'buy',
    token: req.asset_code,
    amount: req.amount,
    vndAmount: quote.net_vnd,
    expiresAt: expiredAt,
  });
  if (!reserveResult.success) {
    throw new Error(reserveResult.error || 'INSUFFICIENT_LIQUIDITY');
  }

  let result: Awaited<ReturnType<typeof createBuyOrder>>;
  try {
    result = await createBuyOrder(usdtAmount, req.asset_code, paymentCode, { partner: options?.partner, quote });
  } catch (error) {
    await rollbackReservation(paymentCode);
    throw error;
  }

  let updated;
  try {
    updated = await db('orders')
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
  } catch (error) {
    await rollbackReservation(paymentCode);
    throw error;
  }
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
  const maxOrder = await getTokenConfig(req.asset_code, 'sell', 'max_order_amount');
  if (usdtAmount > maxOrder) {
    throw new Error('MAX_ORDER_EXCEEDED');
  }
  const quote = await buildPartnerAdjustedQuote('sell', usdtAmount, req.asset_code, options?.partner);
  const payment_code = generatePaymentCode();
  const expiredAt = new Date(Date.now() + ORDER_EXPIRY_MS);

  const reserveResult = await reserveForOrder({
    paymentCode: payment_code,
    direction: 'sell',
    token: 'VND',
    amount: quote.net_vnd,
    vndAmount: quote.net_vnd,
    expiresAt: expiredAt,
  });
  if (!reserveResult.success) {
    throw new Error(reserveResult.error || 'INSUFFICIENT_LIQUIDITY');
  }

  let inserted: unknown;
  try {
    inserted = await db('orders')
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
        partner_id: options?.partner?.id ?? null,
      });
  } catch (error) {
    await rollbackReservation(payment_code);
    throw error;
  }
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

  // Only CREATED orders can be cancelled
  if (currentState !== OrderState.CREATED) {
    return { error: 'CANCEL_NOT_ALLOWED' };
  }

  // Block cancellation if payment webhook already received
  if (order.last_webhook_id) {
    return { error: 'CANCEL_NOT_ALLOWED' };
  }

  const updated = await transitionOrder(order.id, {
    order_state: OrderState.CANCELLED,
    cancelled_at: db.fn.now(),
    cancel_reason: reason || null,
  });

  // Release reservation for both buy and sell orders
  await releaseReservation(order.payment_code);

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
  await transitionOrder(order.id, { order_state: stateNum });

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

  await transitionOrder(order.id, {
    order_state: OrderState.PROCESSING,
    processing_state: ProcessingState.SELL_PAYMENT_RECEIVED,
    transaction_hash: txHash,
    last_webhook_id: String(webhookLogId),
  });

  if (order.callback) {
    fireCallback(order.callback, order.id, oldState, OrderState.PROCESSING, oldProcessingState, ProcessingState.SELL_PAYMENT_RECEIVED).catch((err) => console.error('[OrderService] fireCallback failed:', err));
  }

  if (process.env.PAYOUT_MODE !== 'stub') {
    const balance = await getAccountBalance();
    if (!balance.success) {
      console.error(`[OrderService] VND balance check failed before payout: ${balance.error}`);
      await transitionOrder(order.id, {
        order_state: OrderState.FAILED,
        processing_state: ProcessingState.SELL_PAYOUT_FAILED,
        error_message: 'VND_BALANCE_CHECK_FAILED',
      });
      if (order.callback) {
        fireCallback(order.callback, order.id, OrderState.PROCESSING, OrderState.FAILED, ProcessingState.SELL_PAYMENT_RECEIVED, ProcessingState.SELL_PAYOUT_FAILED).catch((err) => console.error('[OrderService] fireCallback failed:', err));
      }
      await releaseReservation(memo!);
      return { success: false, error: 'VND_BALANCE_CHECK_FAILED' };
    }
    if ((balance.availableBalance ?? 0) < Number(order.net_vnd)) {
      console.error(`[OrderService] Insufficient VND for payout: available=${balance.availableBalance}, needed=${order.net_vnd}`);
      await transitionOrder(order.id, {
        order_state: OrderState.FAILED,
        processing_state: ProcessingState.SELL_PAYOUT_FAILED,
        error_message: 'INSUFFICIENT_VND_BALANCE',
      });
      if (order.callback) {
        fireCallback(order.callback, order.id, OrderState.PROCESSING, OrderState.FAILED, ProcessingState.SELL_PAYMENT_RECEIVED, ProcessingState.SELL_PAYOUT_FAILED).catch((err) => console.error('[OrderService] fireCallback failed:', err));
      }
      await releaseReservation(memo!);
      return { success: false, error: 'INSUFFICIENT_VND_BALANCE' };
    }
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
    await transitionOrder(order.id, {
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

    await consumeReservation(memo!);
  } else {
    await transitionOrder(order.id, {
      order_state: OrderState.FAILED,
      processing_state: ProcessingState.SELL_PAYOUT_FAILED,
      error_message: payoutResult.error || 'Payout failed',
    });

    if (order.callback) {
      fireCallback(order.callback, order.id, OrderState.PROCESSING, OrderState.FAILED, ProcessingState.SELL_PAYMENT_RECEIVED, ProcessingState.SELL_PAYOUT_FAILED).catch((err) => console.error('[OrderService] fireCallback failed:', err));
    }

    await releaseReservation(memo!);
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
  if (currentState !== OrderState.CREATED) {
    return { error: 'ORDER_NOT_ELIGIBLE' };
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
      vnd_received: Number(order.net_vnd),
      last_webhook_id: String(webhookLogId),
    });
    return { success: true };
  } catch (err) {
    console.error(`[Bypass] confirmPayment failed for order ${orderId}:`, err);
    return { error: 'CONFIRMATION_FAILED' };
  }
}
