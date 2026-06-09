import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, runMigrations, cleanOrders, destroyDb, db } from './helper';
import type { FastifyInstance } from 'fastify';
import { Keypair } from '@stellar/stellar-sdk';


const DEPOSIT_BODY = {
  amount: '100',
  chain_id: 56,
  asset_code: 'USDC',
  token_address: '0x55d398326f99059fF775485246999027B3197955',
  recipient: 'GDZST3XVCDTUJ76ZAV2HA72KYPJM7L7J4JZ5L6G6UFVPJKZ6JCZXM5CM',
  callback: 'https://example.com/webhook',
};

const WITHDRAWAL_BODY = {
  amount: '50',
  chain_id: 56,
  asset_code: 'USDC',
  token_address: '0x55d398326f99059fF775485246999027B3197955',
  callback: 'https://example.com/webhook',
  payment_info: {
    bank_id: 'MBBank',
    full_name: 'NGUYEN VAN A',
    account_type: 1,
    account_number: '1234567890',
  },
};

const DEPOSIT_WEBHOOK_BODY = {
  ...DEPOSIT_BODY,
  recipient: Keypair.random().publicKey(),
};

const PARTNER_APP_KEY = process.env.PARTNER_APP_KEY || 'test-partner-key';
process.env.PARTNER_APP_KEY = PARTNER_APP_KEY;
const PARTNER_HEADERS = { 'partner-app-key': PARTNER_APP_KEY };

let app: FastifyInstance;

beforeAll(async () => {
  process.env.STELLAR_HOT_WALLET_ENCRYPTION_KEY =
    process.env.STELLAR_HOT_WALLET_ENCRYPTION_KEY || '12345678901234567890123456789012';
  await runMigrations();
  const kp = Keypair.random();
  await db('system_wallets')
    .insert({
      name: process.env.STELLAR_HOT_WALLET_NAME || 'stellar_hot_wallet',
      public_key: kp.publicKey(),
      encrypted_secret: 'removed',
      network: 'testnet',
      is_active: true,
    })
    .onConflict('name')
    .merge();
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await destroyDb();
});

beforeEach(async () => {
  await cleanOrders();
});

// ─── POST /api/orders/deposit ────────────────────────────────────

describe('POST /api/orders/deposit', () => {
  it('creates deposit order with correct fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: DEPOSIT_BODY,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.order_type).toBe('buy');
    expect(body.data.code).toMatch(/^DH[A-Z0-9]{10}$/);
    expect(body.data.state).toBe(1);
    expect(body.data.amount).toBe(100);
    expect(body.data.recipient).toBe(DEPOSIT_BODY.recipient);
  });

  it('returns pay_data.qr_link (+ qr_code alias) and body.bankInfo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: DEPOSIT_BODY,
    });

    const { data } = res.json();
    expect(data.pay_data).toBeDefined();
    expect(data.pay_data.qr_code).toBeTruthy();
    expect(data.pay_data.qr_link).toBeTruthy();
    expect(data.pay_data.qr_link).toBe(data.pay_data.qr_code);
    expect(data.body.bankInfo).toBeDefined();
  });

  it('returns canonical monetary fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: DEPOSIT_BODY,
    });

    const { data } = res.json();
    expect(data.amount).toBe(100);
    expect(data.currency).toBe('USDC');
    expect(data.rate).toBeGreaterThan(0);
    expect(data.total_fee_vnd).toBeGreaterThan(0);
  });

  it('persists order in DB with new columns', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: DEPOSIT_BODY,
    });

    const { data } = res.json();
    const row = await db('orders').where({ payment_code: data.code }).first();
    expect(row).toBeDefined();
    expect(row.chain_id).toBe('56');
    expect(row.token_address).toBe(DEPOSIT_BODY.token_address);
    expect(row.recipient).toBe(DEPOSIT_BODY.recipient);
    expect(row.callback).toBe(DEPOSIT_BODY.callback);
    expect(row.order_state).toBe(1);
    expect(row.payment_status).toBe('pending');
    expect(row.partner_id).toBeTruthy();
  });

  it('rejects negative amount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: { ...DEPOSIT_BODY, amount: '-5' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('rejects zero amount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: { ...DEPOSIT_BODY, amount: '0' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects non-numeric amount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: { ...DEPOSIT_BODY, amount: 'abc' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: { amount: '100', chain_id: 56 },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── POST /api/orders/withdrawal ─────────────────────────────────

describe('POST /api/orders/withdrawal', () => {
  it('creates withdrawal order with bank info', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/withdrawal',
      headers: PARTNER_HEADERS,
      payload: WITHDRAWAL_BODY,
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.order_type).toBe('sell');
    expect(data.code).toMatch(/^DH[A-Z0-9]{10}$/);
    expect(data.state).toBe(1);
    expect(data.amount).toBe(50);
  });

  it('persists bank details in DB', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/withdrawal',
      headers: PARTNER_HEADERS,
      payload: WITHDRAWAL_BODY,
    });

    const { data } = res.json();
    const row = await db('orders').where({ payment_code: data.code }).first();
    expect(row.bank_id).toBe('MBBank');
    expect(row.bank_account_name).toBe('NGUYEN VAN A');
    expect(row.bank_account_no).toBe('1234567890');
    expect(row.direction).toBe('sell');
    expect(row.partner_id).toBeTruthy();
  });

  it('rejects negative amount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/withdrawal',
      headers: PARTNER_HEADERS,
      payload: { ...WITHDRAWAL_BODY, amount: '-10' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects missing payment_info', async () => {
    const { payment_info, ...noPaymentInfo } = WITHDRAWAL_BODY;
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/withdrawal',
      headers: PARTNER_HEADERS,
      payload: noPaymentInfo,
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects missing bank fields inside payment_info', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/withdrawal',
      headers: PARTNER_HEADERS,
      payload: {
        ...WITHDRAWAL_BODY,
        payment_info: { bank_id: 'MBBank' },
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── GET /api/orders/:payment_code ────────────────────────────────

describe('GET /api/orders/:payment_code', () => {
  it('returns order by payment_code', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: DEPOSIT_BODY,
    });
    const code = create.json().data.code;

    const res = await app.inject({
      method: 'GET',
      url: `/api/orders/${code}`,
      headers: PARTNER_HEADERS,
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.code).toBe(code);
    expect(data.state).toBe(1);
    expect(data.chain_id).toBe('56');
    expect(data.recipient).toBe(DEPOSIT_BODY.recipient);
  });

  it('returns 404 for nonexistent code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/orders/DHZZZZZZZZZZ',
      headers: PARTNER_HEADERS,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error?.message).toBe('Order not found');
  });
});

// ─── SePay webhook → confirmPayment → order_state ─────────────────

describe('SePay webhook flow', () => {
  it('confirms payment and transitions order_state to PROCESSING', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: DEPOSIT_WEBHOOK_BODY,
    });
    const { code } = create.json().data;
    const createdRow = await db('orders').where({ payment_code: code }).first();
    const netVnd = Number(createdRow.net_vnd);

    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/webhooks/sepay',
      headers: {
        authorization: `Apikey ${process.env.SEPAY_WEBHOOK_API_KEY}`,
      },
      payload: {
        id: 99001,
        gateway: 'MBBank',
        transactionDate: '2026-04-22 12:00:00',
        accountNumber: '0123456789',
        code,
        content: `chuyen tien ${code}`,
        transferType: 'in',
        transferAmount: netVnd,
        accumulated: 10000000,
        subAccount: null,
        referenceCode: 'MB.12345',
        description: '',
      },
    });

    expect(webhookRes.statusCode).toBe(200);
    expect(webhookRes.json().success).toBe(true);

    const row = await db('orders').where({ payment_code: code }).first();
    expect(row.payment_status).toBe('payment_received');
    expect(row.order_state).toBe(2);
    expect(Number(row.vnd_received)).toBe(netVnd);
  });

  it('bypasses buy payment using tx_hash webhook log, not sepay_transaction_id', async () => {
    process.env.ADMIN_BOOTSTRAP_PASSWORD = 'test-admin-key';

    const create = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: DEPOSIT_WEBHOOK_BODY,
    });
    const orderId = create.json().data.id;

    const bypass = await app.inject({
      method: 'POST',
      url: '/bypass-payment',
      payload: {
        admin_key: 'test-admin-key',
        order_id: orderId,
      },
    });

    expect(bypass.statusCode).toBe(200);
    expect(bypass.json()).toEqual({ success: true });

    const log = await db('webhook_logs').where({ source: 'admin-bypass' }).first();
    expect(log).toBeDefined();
    expect(log.tx_hash).toMatch(/^bypass-\d+$/);
    expect(log.sepay_transaction_id).toBeNull();

    const row = await db('orders').where({ id: orderId }).first();
    expect(row.order_state).not.toBe(1);
    expect(row.last_webhook_id).toBe(String(log.id));
    expect(Number(row.vnd_received)).toBe(Number(row.net_vnd));
  });

  it('deduplicates — second webhook with same id is ignored', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: DEPOSIT_WEBHOOK_BODY,
    });
    const { code } = create.json().data;
    const createdRow = await db('orders').where({ payment_code: code }).first();
    const netVnd = Number(createdRow.net_vnd);

    const webhookPayload = {
      id: 99002,
      gateway: 'MBBank',
      transactionDate: '2026-04-22 12:00:00',
      accountNumber: '0123456789',
      code,
      content: `chuyen tien ${code}`,
      transferType: 'in',
      transferAmount: netVnd,
      accumulated: 10000000,
      subAccount: null,
      referenceCode: 'MB.12346',
      description: '',
    };

    const headers = { authorization: `Apikey ${process.env.SEPAY_WEBHOOK_API_KEY}` };

    await app.inject({ method: 'POST', url: '/api/webhooks/sepay', headers, payload: webhookPayload });
    await app.inject({ method: 'POST', url: '/api/webhooks/sepay', headers, payload: webhookPayload });

    const logs = await db('webhook_logs').where({ sepay_transaction_id: 99002 });
    expect(logs.length).toBe(1);
  });

  it('ignores webhook when transferAmount < net_vnd', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: DEPOSIT_WEBHOOK_BODY,
    });
    const { code } = create.json().data;

    await app.inject({
      method: 'POST',
      url: '/api/webhooks/sepay',
      headers: { authorization: `Apikey ${process.env.SEPAY_WEBHOOK_API_KEY}` },
      payload: {
        id: 99003,
        gateway: 'MBBank',
        transactionDate: '2026-04-22 12:00:00',
        accountNumber: '0123456789',
        code,
        content: `chuyen tien ${code}`,
        transferType: 'in',
        transferAmount: 1000,
        accumulated: 10000000,
        subAccount: null,
        referenceCode: 'MB.12347',
        description: '',
      },
    });

    const row = await db('orders').where({ payment_code: code }).first();
    expect(row.payment_status).toBe('pending');
    expect(row.order_state).toBe(1);
  });

  it('ignores transferType=out', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: DEPOSIT_WEBHOOK_BODY,
    });
    const { code } = create.json().data;
    const createdRow = await db('orders').where({ payment_code: code }).first();
    const netVnd = Number(createdRow.net_vnd);

    await app.inject({
      method: 'POST',
      url: '/api/webhooks/sepay',
      headers: { authorization: `Apikey ${process.env.SEPAY_WEBHOOK_API_KEY}` },
      payload: {
        id: 99004,
        gateway: 'MBBank',
        transactionDate: '2026-04-22 12:00:00',
        accountNumber: '0123456789',
        code,
        content: `chuyen tien ${code}`,
        transferType: 'out',
        transferAmount: netVnd,
        accumulated: 10000000,
        subAccount: null,
        referenceCode: 'MB.12348',
        description: '',
      },
    });

    const row = await db('orders').where({ payment_code: code }).first();
    expect(row.payment_status).toBe('pending');
  });

  it('rejects webhook without valid API key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/sepay',
      headers: { authorization: 'Apikey wrong-key' },
      payload: {
        id: 99005,
        gateway: 'MBBank',
        transactionDate: '2026-04-22 12:00:00',
        accountNumber: '0123456789',
        code: null,
        content: 'test',
        transferType: 'in',
        transferAmount: 1000,
        accumulated: 10000000,
        subAccount: null,
        referenceCode: 'MB.00000',
        description: '',
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ─── Order state updates ──────────────────────────────────────────

describe('updateOrderState', () => {
  it('transitions order state and persists', async () => {
    const { updateOrderState } = await import('../src/services/orderService');

    const create = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: PARTNER_HEADERS,
      payload: DEPOSIT_WEBHOOK_BODY,
    });
    const { code } = create.json().data;

    await updateOrderState(code, 3);

    const row = await db('orders').where({ payment_code: code }).first();
    expect(row.order_state).toBe(3);
  });
});
