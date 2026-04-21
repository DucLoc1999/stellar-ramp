import { SePayPgClient } from 'sepay-pg-node';

const sepayClient = new SePayPgClient({
  env: (process.env.SEPAY_ENV ?? 'sandbox') as 'sandbox' | 'production',
  merchant_id: process.env.SEPAY_ID!,
  secret_key: process.env.SEPAY_KEY!,
});

export interface CheckoutSession {
  checkout_url: string;
  form_fields: Record<string, unknown>;
}

export function createCheckoutSession(params: {
  payment_code: string;
  net_vnd: number;
}): CheckoutSession {
  const domain = (process.env.DOMAIN ?? '').replace(/\/$/, '');
  const base = domain.startsWith('http') ? domain : `https://${domain}`;

  const checkout_url = sepayClient.checkout.initCheckoutUrl();

  const form_fields = sepayClient.checkout.initOneTimePaymentFields({
    payment_method: 'BANK_TRANSFER',
    order_invoice_number: params.payment_code,
    order_amount: params.net_vnd,
    currency: 'VND',
    order_description: `Thanh toan don hang ${params.payment_code}`,
    success_url: `${base}/order/${params.payment_code}?payment=success`,
    error_url: `${base}/order/${params.payment_code}?payment=error`,
    cancel_url: `${base}/order/${params.payment_code}?payment=cancel`,
  });

  return { checkout_url, form_fields };
}
