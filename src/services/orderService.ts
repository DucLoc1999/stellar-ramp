import db from '../db';
import { getQuote } from './priceService';
import { createCheckoutSession } from './sepayPgService';
import { fireCallback } from './callbackService';
import { triggerDisburse, loadHotWallet } from './stellarService';
import type { DepositRequest, WithdrawalRequest, Usdt247Order, Usdt247Timestamp } from '../models/types';
import { OrderState } from '../models/types';

export { DepositRequest, WithdrawalRequest, OrderState } from '../models/types';

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
  transaction_hash: string | null;
  error_message: string | null;
  chain_id: number;
  token_address: string;
  recipient: string | null;
  callback: string;
  payment_info: Record<string, unknown> | null;
  expired_at: Date | null;
  created_at: Date;
  updated_at: Date;
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
  overrides?: Partial<Pick<Usdt247Order, 'body' | 'pay_data'>>
): Usdt247Order {
  const rate = typeof order.rate === 'string' ? Number(order.rate) : order.rate;
  const feeVnd = typeof order.fee_vnd === 'string' ? Number(order.fee_vnd) : order.fee_vnd;
  const expiry = order.expired_at ?? new Date(order.created_at.getTime() + 30 * 60 * 1000);
  return {
    id: String(order.id),
    user_id: null,
    order_type: order.direction,
    external_id: null,
    code: order.payment_code,
    provider: order.direction === 'buy' ? 'sepay' : 'chain',
    callback: order.callback,
    amount: typeof order.usdt_amount === 'string' ? parseFloat(order.usdt_amount) : order.usdt_amount,
    currency: 'USDT',
    rate,
    token_address: order.token_address,
    recipient: order.recipient ?? null,
    chain_id: order.chain_id,
    partner_id: null,
    state: order.order_state,
    processing_state: null,
    body: overrides?.body ?? null,
    pay_data: overrides?.pay_data ?? null,
    payment_info: order.payment_info ?? null,
    expired_at: toTimestamp(expiry),
    created_at: toTimestamp(order.created_at),
    updated_at: toTimestamp(order.updated_at),
    client_ip: null,
    outcome: null,
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

export async function createBuyOrder(usdt_amount: number) {
  const quote = await getQuote('buy', usdt_amount);
  const payment_code = generatePaymentCode();
  const { checkout_url, form_fields } = createCheckoutSession({
    payment_code,
    net_vnd: quote.net_vnd,
  });

  const [id] = await db('orders').insert({
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
    fireCallback(order.callback, order.id, oldState, OrderState.PROCESSING).catch(() => {});
  }
}

export async function findPendingOrderByCode(payment_code: string) {
  return db('orders').where({ payment_code, payment_status: 'pending' }).first();
}

export async function getOrderByCode(payment_code: string) {
  return db('orders').where({ payment_code }).first();
}

export async function createDeposit(req: DepositRequest): Promise<Usdt247Order> {
  const usdtAmount = Number(req.amount);
  const result = await createBuyOrder(usdtAmount);
  const expiredAt = new Date(Date.now() + 30 * 60 * 1000);
  const [order] = await db('orders')
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
  fireCallback(req.callback, order.id, 0, OrderState.CREATED).catch(() => {});
  return toApiOrder(order as OrderRow, {
    pay_data: { qr_code: result.checkout_url },
    body: { bankInfo: result.form_fields },
  });
}

export async function createWithdrawal(req: WithdrawalRequest): Promise<Usdt247Order> {
  const usdtAmount = Number(req.amount);
  const quote = await getQuote('sell', usdtAmount);
  const payment_code = generatePaymentCode();
  const expiredAt = new Date(Date.now() + 30 * 60 * 1000);
  const [order] = await db('orders')
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
      payment_info: JSON.stringify(req.payment_info),
      expired_at: expiredAt,
    })
    .returning('*');
  fireCallback(req.callback, order.id, 0, OrderState.CREATED).catch(() => {});

  const hotWallet = await loadHotWallet();
  return toApiOrder(order as OrderRow, {
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

  const [updated] = await db('orders').where({ payment_code: paymentCode }).returning('*');

  if (order.callback) {
    fireCallback(order.callback, order.id, currentState, OrderState.CANCELLED).catch(() => {});
  }

  return {
    data: {
      payment_code: updated.payment_code,
      order_state: updated.order_state,
      cancelled_at: updated.cancelled_at?.toISOString() || new Date().toISOString(),
    },
  };
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
    fireCallback(order.callback, order.id, oldState, OrderState.PROCESSING).catch(() => {});
  }

  return { success: true };
}
