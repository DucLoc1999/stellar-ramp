import db from '../db';
import { findPendingOrderByCode, confirmPayment } from './orderService';
import { OrderState } from '../models/types';

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

function extractCodeFromContent(content: string): string | null {
  const match = content.match(/DH[A-Z0-9]{10}/);
  return match ? match[0] : null;
}

export async function handleSepayWebhook(payload: SepayWebhookPayload): Promise<void> {
  if (!payload.gateway || !payload.id) return;
  if (payload.transferType !== 'in') return;

  const existing = await db('webhook_logs')
    .where({ sepay_transaction_id: payload.id })
    .first();
  console.log('[sepay-webhook] existing:', existing);
  if (existing) return;

  const [insertedWebhookLog] = await db('webhook_logs').insert({
    sepay_transaction_id: payload.id,
    source: 'sepay',
    body: JSON.stringify(payload),
  }).returning('id');
  const webhookLogId = Number((insertedWebhookLog as any).id ?? insertedWebhookLog);

  const paymentCode = payload.code ?? extractCodeFromContent(payload.content);
  if (!paymentCode) return;

  const order = await db('orders').where({ payment_code: paymentCode }).first();
  if (!order) return;

  if (order.last_webhook_id && Number(order.last_webhook_id) === webhookLogId) {
    console.log('[sepay-webhook] duplicate webhook for order:', paymentCode);
    return;
  }

  const currentState = order.order_state || 0;
  if (currentState === OrderState.COMPLETED || currentState === OrderState.CANCELLED) {
    console.log('[sepay-webhook] order already in final state:', currentState, 'for order:', paymentCode);
    return;
  }

  if (order.payment_status !== 'pending') {
    console.log('[sepay-webhook] order payment already received for order:', paymentCode);
    return;
  }

  console.log('[sepay-webhook] net_vnd:', order.net_vnd, 'transferAmount:', payload.transferAmount);
  if (payload.transferAmount < Number(order.net_vnd)) return;

  await db('orders')
    .where({ payment_code: paymentCode })
    .update({ last_webhook_id: String(webhookLogId) });

  await confirmPayment({
    payment_code: paymentCode,
    sepay_transaction_id: String(payload.id),
    vnd_received: payload.transferAmount,
  });
}
