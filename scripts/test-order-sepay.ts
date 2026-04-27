import 'dotenv/config';
import { createCheckoutSession } from '../src/services/sepayPgService';
import { getQuote } from '../src/services/priceService';

async function main() {
  const paymentCode = process.argv[2] || 'TEST001';
  const usdtAmount = Number(process.argv[3]) || 100;
  
  const quote = await getQuote('buy', usdtAmount);
  console.log('Quote:', quote);
  
  const session = await createCheckoutSession({
    payment_code: paymentCode,
    net_vnd: quote.net_vnd,
  });
  
  console.log('\n=== SePay Checkout Session ===');
  console.log('Checkout URL:', session.checkout_url);
  console.log('QR URL:', session.qr_url || '(requires sepay_merchant_account + bank config)');
  console.log('\nForm fields:');
  console.log(JSON.stringify(session.form_fields, null, 2));
}

main().catch(console.error);