import db from '../db';
import { getQuote } from './priceService';
import { createCheckoutSession } from './sepayPgService';
import { fireCallback } from './callbackService';
import { triggerDisburse } from './stellarService';
import type { DepositRequest, WithdrawalRequest } from '../models/types';
import { OrderState } from '../models/types';

export { DepositRequest, WithdrawalRequest, OrderState } from '../models/types';

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
    await triggerDisburse(order.id, order.recipient, usdtAmount, params.payment_code);
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

export async function createDeposit(req: DepositRequest) {
  const usdtAmount = Number(req.amount);
  const result = await createBuyOrder(usdtAmount);
  const [order] = await db('orders')
    .where({ payment_code: result.payment_code })
    .update({
      chain_id: req.chain_id,
      token_address: req.token_address,
      recipient: req.recipient,
      callback: req.callback,
      order_state: OrderState.CREATED,
    })
    .returning('*');
  fireCallback(req.callback, order.id, 0, OrderState.CREATED).catch(() => {});
  return {
    id: order.id,
    payment_code: order.payment_code,
    checkout_url: result.checkout_url,
    direction: 'buy',
    usdt_amount: result.quote.usdt_amount,
    rate: result.quote.rate,
    net_vnd: result.quote.net_vnd,
    fee_rate: result.quote.fee_rate,
    fee_vnd: result.quote.fee_vnd,
    order_state: OrderState.CREATED,
    pay_data: { qr_code: result.checkout_url },
    body: { bankInfo: result.form_fields },
    form_fields: result.form_fields,
    quote: result.quote,
    recipient: req.recipient,
  };
}

export async function createWithdrawal(req: WithdrawalRequest) {
  const usdtAmount = Number(req.amount);
  const quote = await getQuote('sell', usdtAmount);
  const payment_code = generatePaymentCode();
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
      payment_info: req.payment_info,
    })
    .returning('*');
  fireCallback(req.callback, order.id, 0, OrderState.CREATED).catch(() => {});
  return {
    id: order.id,
    payment_code: order.payment_code,
    direction: 'sell',
    usdt_amount: quote.usdt_amount,
    rate: quote.rate,
    net_vnd: quote.net_vnd,
    fee_rate: quote.fee_rate,
    fee_vnd: quote.fee_vnd,
    order_state: OrderState.CREATED,
  };
}
