import { getConfig } from './configService';
import { SePayPgClient } from 'sepay-pg-node';

const sepayClient = new SePayPgClient({
  env: (process.env.SEPAY_ENV ?? 'sandbox') as 'sandbox' | 'production',
  merchant_id: process.env.SEPAY_ID!,
  secret_key: process.env.SEPAY_KEY!,
});

export interface CheckoutSession {
  checkout_url: string;
  form_fields: Record<string, unknown>;
  qr_url: string;
}

export async function createCheckoutSession(params: {
  payment_code: string;
  net_vnd: number;
}): Promise<CheckoutSession> {
  const domain = (process.env.DOMAIN ?? '').replace(/\/$/, '');
  const base = domain.startsWith('http') ? domain : `https://${domain}`;

  const checkout_url = sepayClient.checkout.initCheckoutUrl();

  const form_fields = sepayClient.checkout.initOneTimePaymentFields({
    payment_method: 'BANK_TRANSFER',
    order_invoice_number: params.payment_code,
    order_amount: params.net_vnd,
    currency: 'VND',
    order_description: `Thanh toan don hang ${params.payment_code}`,
    success_url: `${base}/orders/${params.payment_code}?payment=success`,
    error_url: `${base}/orders/${params.payment_code}?payment=error`,
    cancel_url: `${base}/orders/${params.payment_code}?payment=cancel`,
  });

  const merchantAcc = await getConfig('sepay_merchant_account');
  const merchantBank = await getConfig('sepay_merchant_bank');

  let qr_url = '';
  if (merchantAcc && merchantBank) {
    qr_url = `https://qr.sepay.vn/img?acc=${merchantAcc}&bank=${merchantBank}&amount=${params.net_vnd}&des=${encodeURIComponent(params.payment_code)}`;
  }

  return { checkout_url, form_fields, qr_url };
}
