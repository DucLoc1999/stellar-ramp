import 'dotenv/config';
import http from 'http';

const PARTNER_APP_KEY = process.env.PARTNER_APP_KEY || '4982bfec-fb30-4526-be37-60718b4d5a17';
const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const SERVER_PORT = process.env.PORT || 3000;

function request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string | number> = {
      'Content-Type': 'application/json',
      'Partner-App-Key': PARTNER_APP_KEY,
    };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(
      { hostname: SERVER_HOST, port: SERVER_PORT, path, method: body ? 'POST' : 'GET', headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Server ${res.statusCode}: ${buf.toString()}`));
          } else {
            try {
              resolve(JSON.parse(buf.toString()) as T);
            } catch {
              reject(new Error(`Invalid JSON: ${buf.toString()}`));
            }
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function createDeposit(amount: string, chainId = '2', tokenAddress: string) {
  const body = {
    amount,
    chain_id: chainId,
    token_address: tokenAddress || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    recipient: 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOUJ2LNLRK',
    callback: 'https://example.com/callback',
  };
  console.log('Request:', JSON.stringify(body, null, 2));
  const res = await request<{ success: boolean; data: unknown }>('/api/orders/deposit', body);
  return res;
}

async function main() {
  const amount = process.argv[2] || '10';
  const tokenAddress = process.argv[3] || '';

  console.log(`--- Creating deposit: ${amount} USDT ---`);
  const res = await createDeposit(amount, '2', tokenAddress);

  console.log('\nResponse:');
  console.log(JSON.stringify(res, null, 2));

  if (res.success && res.data) {
    const order = res.data as Record<string, unknown>;
    const body = order.body as Record<string, unknown> | null;
    const bankInfo = body?.bankInfo as Record<string, unknown> | undefined;
    console.log('\n--- Order Details ---');
    console.log('Code:', order.code);
    console.log('Amount:', order.amount);
    console.log('Rate:', order.rate);
    console.log('State:', order.state);
    console.log('\n--- Bank Info ---');
    console.log('Bank Name:', bankInfo?.bankName);
    console.log('Account Name:', bankInfo?.bankAccountName);
    console.log('Account Number:', bankInfo?.bankAccountNumber);
    console.log('Transfer Content:', bankInfo?.transferContent);
    console.log('VA Amount:', bankInfo?.vaAmount);
  }
}

main().catch(console.error);