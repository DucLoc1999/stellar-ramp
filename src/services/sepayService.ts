import db from '../db';
import { findPendingOrderByCode, confirmPayment } from './orderService';

export interface SepayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  code: string | null;
  content: string;
  transferType: 'in' | 'out';
  transferAmount: number;
  accumulated: number;
  subAccount: string | null;
  referenceCode: string;
  description: string;
}

export async function handleSepayWebhook(payload: SepayWebhookPayload): Promise<void> {
  if (!payload.gateway || !payload.id) return;
  if (payload.transferType !== 'in') return;

  const existing = await db('webhook_logs')
    .where({ sepay_transaction_id: payload.id })
    .first();
  if (existing) return;

  await db('webhook_logs').insert({
    sepay_transaction_id: payload.id,
    body: JSON.stringify(payload),
  });

  if (!payload.code) return;

  const order = await findPendingOrderByCode(payload.code);
  if (!order) return;

  if (payload.transferAmount < order.net_vnd) return;

  await confirmPayment({
    payment_code: payload.code,
    sepay_transaction_id: String(payload.id),
    vnd_received: payload.transferAmount,
  });
}
