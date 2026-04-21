import db from '../db';
import { getQuote } from './priceService';
import { createCheckoutSession } from './sepayPgService';

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
  await db('orders')
    .where({ payment_code: params.payment_code, payment_status: 'pending' })
    .update({
      payment_status: 'payment_received',
      sepay_transaction_id: params.sepay_transaction_id,
      vnd_received: params.vnd_received,
      payment_confirmed_at: db.fn.now(),
    });
}

export async function findPendingOrderByCode(payment_code: string) {
  return db('orders').where({ payment_code, payment_status: 'pending' }).first();
}

export async function getOrderByCode(payment_code: string) {
  return db('orders').where({ payment_code }).first();
}
