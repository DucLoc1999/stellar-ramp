import { findPendingOrderByCode, confirmPayment } from './orderService';

export interface SepayIpnPayload {
  timestamp: number;
  notification_type: string;
  order: {
    id: string;
    order_id: string;
    order_status: string;
    order_currency: string;
    order_amount: string;
    order_invoice_number: string;
    custom_data: unknown[];
    user_agent: string;
    ip_address: string;
    order_description: string;
  };
  transaction: {
    id: string;
    payment_method: string;
    transaction_id: string;
    transaction_type: string;
    transaction_date: string;
    transaction_status: string;
    transaction_amount: string;
    transaction_currency: string;
  };
  customer: {
    id: string;
    customer_id: string;
  };
}

export async function handleSepayIpn(payload: SepayIpnPayload): Promise<void> {
  if (payload.notification_type !== 'ORDER_PAID') return;
  if (payload.order.order_status !== 'CAPTURED') return;
  if (payload.transaction.transaction_status !== 'APPROVED') return;

  const payment_code = payload.order.order_invoice_number;
  const order = await findPendingOrderByCode(payment_code);
  if (!order) return;

  const vnd_received = Math.round(Number(payload.transaction.transaction_amount));

  await confirmPayment({
    payment_code,
    sepay_transaction_id: payload.transaction.transaction_id,
    vnd_received,
  });
}
