import db from '../db';
import { getQuote } from './priceService';
import { createCheckoutSession } from './sepayPgService';
import { fireCallback } from './callbackService';
import { triggerDisburse, loadHotWallet, SUPPORTED_TOKEN_ISSUER } from './stellarService';
import type { DepositRequest, WithdrawalRequest } from '../models/types';
import type { Usdt247Order, Usdt247PaymentInfo, Usdt247Timestamp } from '../models/usdt247';
import { OrderState } from '../models/types';

export { DepositRequest, WithdrawalRequest, OrderState } from '../models/types';

function isSupportedToken(tokenAddress: string): boolean {
  return tokenAddress === SUPPORTED_TOKEN_ISSUER;
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
  recipient: string | null;
  callback: string;
  payment_info: Usdt247PaymentInfo | Record<string, unknown> | string | null;
  cancelled_at?: Date | null;
  expired_at: Date | null;
  created_at: Date;
  updated_at: Date;
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

function toApiOrder(
  order: OrderRow,
  overrides?: Partial<Pick<Usdt247Order, 'body' | 'pay_data' | 'user_id' | 'client_ip' | 'outcome'>>
): Usdt247Order {
  const rate = typeof order.rate === 'string' ? Number(order.rate) : order.rate;
  const feeVnd = typeof order.fee_vnd === 'string' ? Number(order.fee_vnd) : order.fee_vnd;
  const expiry = order.expired_at ?? new Date(order.created_at.getTime() + 30 * 60 * 1000);
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

  return {
    id: String(order.id),
    user_id: overrides?.user_id ?? '',
    order_type: order.direction,
    external_id: null,
    code: order.payment_code,
    provider: order.direction === 'buy' ? 'sepay' : 'chain',
    callback: order.callback,
    amount: typeof order.usdt_amount === 'string' ? parseFloat(order.usdt_amount) : order.usdt_amount,
    currency: 'USDT',
    rate,
    token_address: order.token_address,
    recipient: order.recipient ?? '',
    chain_id: order.chain_id,
    partner_id: "1",  // update when have partner assign system
    state: order.order_state,
    processing_state: order.processing_state ?? 0,
    body: overrides?.body ?? null,
    pay_data: overrides?.pay_data ?? null,
    payment_info: paymentInfo,
    expired_at: toTimestamp(expiry),
    created_at: toTimestamp(order.created_at),
    updated_at: toTimestamp(order.updated_at),
    client_ip: overrides?.client_ip ?? '',
    outcome: overrides?.outcome ?? '',
    original_rate: rate,
    total_fee_vnd: feeVnd,
  };
}

export function formatOrderResponse(order: OrderRow): Usdt247Order {
  return toApiOrder(order);
}

function generatePaymentCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'USDT247-';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
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

export async function createBuyOrder(usdt_amount: number) {
  const quote = await getQuote('buy', usdt_amount);
  const payment_code = generatePaymentCode();
  const { checkout_url, form_fields } = createCheckoutSession({
    payment_code,
    net_vnd: quote.net_vnd,
  });

  const inserted = await db('orders').insert({
    payment_code,
    checkout_url,
    direction: 'buy',
    usdt_amount: quote.usdt_amount,
    rate: quote.rate,
    net_vnd: quote.net_vnd,
    fee_rate: quote.fee_rate,
    fee_vnd: quote.fee_vnd,
    payment_status: 'pending',
  });
  const id = firstInsertedId(inserted);

  return { id, payment_code, checkout_url, form_fields, quote };
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

  await db('orders')
    .where({ payment_code: params.payment_code, payment_status: 'pending' })
    .update({
      payment_status: 'payment_received',
      sepay_transaction_id: params.sepay_transaction_id,
      vnd_received: params.vnd_received,
      payment_confirmed_at: db.fn.now(),
    });

  const oldState = order.order_state || 0;
  await db('orders')
    .where({ payment_code: params.payment_code })
    .update({ order_state: OrderState.PROCESSING });

  if (order.direction === 'buy' && order.recipient) {
    const usdtAmount = order.usdt_amount.toString();
    await triggerDisburse(order.id, order.recipient, usdtAmount, params.payment_code, order.token_address);
  }

  if (order.callback) {
    fireCallback(order.callback, order.id, oldState, OrderState.PROCESSING).catch(() => { });
  }
}

export async function findPendingOrderByCode(payment_code: string) {
  return db('orders').where({ payment_code, payment_status: 'pending' }).first();
}

export async function getOrderByCode(payment_code: string) {
  return db('orders').where({ payment_code }).first();
}

export async function createDeposit(
  req: DepositRequest,
  options?: CreateOptions
): Promise<Usdt247Order> {
  if (!req.token_address || !isSupportedToken(req.token_address)) {
    throw new Error('UNSUPPORTED_TOKEN');
  }
  const usdtAmount = Number(req.amount);
  const result = await createBuyOrder(usdtAmount);
  const expiredAt = new Date(Date.now() + 30 * 60 * 1000);
  const updated = await db('orders')
    .where({ payment_code: result.payment_code })
    .update({
      chain_id: req.chain_id,
      token_address: req.token_address,
      recipient: req.recipient,
      callback: req.callback,
      order_state: OrderState.CREATED,
      expired_at: expiredAt,
    })
    .returning('*');
  const order = firstRow<OrderRow>(updated as OrderRow | OrderRow[]);
  fireCallback(req.callback, order.id, 0, OrderState.CREATED).catch(() => { });
  return toApiOrder(order as OrderRow, {
    user_id: req.user_id ?? '',
    client_ip: options?.clientIp ?? '',
    pay_data: { qr_link: result.checkout_url, qr_code: result.checkout_url },
    body: { bankInfo: result.form_fields },
  });
}

export async function createWithdrawal(
  req: WithdrawalRequest,
  options?: CreateOptions
): Promise<Usdt247Order> {
  if (!req.token_address || !isSupportedToken(req.token_address)) {
    throw new Error('UNSUPPORTED_TOKEN');
  }
  const usdtAmount = Number(req.amount);
  const quote = await getQuote('sell', usdtAmount);
  const payment_code = generatePaymentCode();
  const expiredAt = new Date(Date.now() + 30 * 60 * 1000);
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
      chain_id: req.chain_id,
      token_address: req.token_address,
      callback: req.callback,
      bank_id: req.payment_info.bank_id,
      bank_account_name: req.payment_info.full_name,
      bank_account_no: req.payment_info.account_number,
      payment_info: JSON.stringify(req.payment_info),
      expired_at: expiredAt,
    })
    .returning('*');
  const order = firstRow<OrderRow>(inserted as OrderRow | OrderRow[]);
  fireCallback(req.callback, order.id, 0, OrderState.CREATED).catch(() => { });

  const hotWallet = await loadHotWallet();
  return toApiOrder(order as OrderRow, {
    user_id: req.user_id ?? '',
    client_ip: options?.clientIp ?? '',
    pay_data: { address: hotWallet.publicKey },
  });
}

interface CancelResult {
  data?: {
    payment_code: string;
    order_state: number;
    cancelled_at: string;
  };
  error?: string;
}

export async function cancelOrder(paymentCode: string, reason?: string): Promise<CancelResult> {
  const order = await db('orders').where({ payment_code: paymentCode }).first();

  if (!order) {
    return { error: 'ORDER_NOT_FOUND' };
  }

  const currentState = order.order_state || 0;

  if (currentState === OrderState.CANCELLED || currentState === OrderState.COMPLETED || currentState === OrderState.FAILED) {
    return { error: 'CANCEL_NOT_ALLOWED' };
  }

  if (currentState === OrderState.PROCESSING) {
    if (order.sepay_transaction_id || order.payment_status === 'payment_received') {
      return { error: 'CANCEL_NOT_ALLOWED' };
    }
  }

  await db('orders')
    .where({ payment_code: paymentCode })
    .update({
      order_state: OrderState.CANCELLED,
      cancelled_at: db.fn.now(),
      cancel_reason: reason || null,
    });

  const updatedRows = await db('orders').where({ payment_code: paymentCode }).returning('*');
  const updated = firstRow<OrderRow>(updatedRows as OrderRow | OrderRow[]);

  if (order.callback) {
    fireCallback(order.callback, order.id, currentState, OrderState.CANCELLED).catch(() => { });
  }

  return {
    data: {
      payment_code: updated.payment_code,
      order_state: updated.order_state,
      cancelled_at: updated.cancelled_at?.toISOString() || new Date().toISOString(),
    },
  };
}

export async function updateOrderState(paymentCode: string, newState: number): Promise<void> {
  const order = await db('orders').where({ payment_code: paymentCode }).first();
  if (!order) return;

  const oldState = order.order_state || 0;
  await db('orders').where({ payment_code: paymentCode }).update({ order_state: newState });

  if (order.callback) {
    fireCallback(order.callback, order.id, oldState, newState).catch(() => { });
  }
}

interface ChainEventParams {
  paymentCode: string;
  txHash: string;
  amount: string;
  address: string;
  chainId: number;
}

interface ChainEventResult {
  success: boolean;
  error?: string;
}

export async function handleChainEvent(params: ChainEventParams): Promise<ChainEventResult> {
  const { paymentCode, txHash, amount, address, chainId } = params;

  const order = await db('orders').where({ payment_code: paymentCode }).first();

  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  if (order.direction !== 'sell') {
    return { success: false, error: 'Chain webhook only applicable to sell orders' };
  }

  if (order.recipient && order.recipient !== address) {
    return { success: false, error: 'Address mismatch' };
  }

  const orderUsdtAmount = typeof order.usdt_amount === 'string'
    ? parseFloat(order.usdt_amount)
    : order.usdt_amount;
  const webhookAmount = parseFloat(amount);
  const tolerance = 0.01;
  const percentDiff = Math.abs(webhookAmount - orderUsdtAmount) / orderUsdtAmount;

  if (percentDiff > tolerance) {
    return { success: false, error: 'Amount mismatch' };
  }

  const oldState = order.order_state || 0;

  await db('orders')
    .where({ payment_code: paymentCode })
    .update({
      order_state: OrderState.PROCESSING,
      transaction_hash: txHash,
    });

  if (order.callback) {
    fireCallback(order.callback, order.id, oldState, OrderState.PROCESSING).catch(() => { });
  }

  return { success: true };
}
