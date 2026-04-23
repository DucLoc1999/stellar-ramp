import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, runMigrations, cleanOrders, destroyDb, db } from './helper';
import type { FastifyInstance } from 'fastify';

const DEPOSIT_BODY = {
  amount: '100',
  chain_id: 56,
  token_address: '0x55d398326f99059fF775485246999027B3197955',
  recipient: '0xTestWallet1234567890abcdef',
  callback: 'https://example.com/webhook',
};

const WITHDRAWAL_BODY = {
  amount: '50',
  chain_id: 56,
  token_address: '0x55d398326f99059fF775485246999027B3197955',
  callback: 'https://example.com/webhook',
  payment_info: {
    bank_id: 'MBBank',
    full_name: 'NGUYEN VAN A',
    account_type: 1,
    account_number: '1234567890',
  },
};

let app: FastifyInstance;

beforeAll(async () => {
  await runMigrations();
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
      payload: DEPOSIT_BODY,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.direction).toBe('buy');
    expect(body.data.payment_code).toMatch(/^USDT247-[A-Z0-9]{8}$/);
    expect(body.data.order_state).toBe(1);
    expect(body.data.usdt_amount).toBe(100);
    expect(body.data.checkout_url).toBeTruthy();
    expect(body.data.recipient).toBe(DEPOSIT_BODY.recipient);
  });

  it('returns pay_data.qr_code and body.bankInfo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      payload: DEPOSIT_BODY,
    });

    const { data } = res.json();
    expect(data.pay_data).toBeDefined();
    expect(data.pay_data.qr_code).toBeTruthy();
    expect(data.body.bankInfo).toBeDefined();
    expect(data.form_fields).toBeDefined();
  });

  it('returns quote breakdown', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      payload: DEPOSIT_BODY,
    });

    const { data } = res.json();
    expect(data.quote).toBeDefined();
    expect(data.quote.direction).toBe('buy');
    expect(data.quote.usdt_amount).toBe(100);
    expect(data.quote.rate).toBeGreaterThan(0);
    expect(data.quote.net_vnd).toBeGreaterThan(0);
    expect(data.quote.fee_vnd).toBeGreaterThan(0);
  });

  it('persists order in DB with new columns', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      payload: DEPOSIT_BODY,
    });

    const { data } = res.json();
    const row = await db('orders').where({ payment_code: data.payment_code }).first();
    expect(row).toBeDefined();
    expect(row.chain_id).toBe(56);
    expect(row.token_address).toBe(DEPOSIT_BODY.token_address);
    expect(row.recipient).toBe(DEPOSIT_BODY.recipient);
    expect(row.callback).toBe(DEPOSIT_BODY.callback);
    expect(row.order_state).toBe(1);
    expect(row.payment_status).toBe('pending');
  });

  it('rejects negative amount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      payload: { ...DEPOSIT_BODY, amount: '-5' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('rejects zero amount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      payload: { ...DEPOSIT_BODY, amount: '0' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects non-numeric amount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      payload: { ...DEPOSIT_BODY, amount: 'abc' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
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
      payload: WITHDRAWAL_BODY,
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.direction).toBe('sell');
    expect(data.payment_code).toMatch(/^USDT247-[A-Z0-9]{8}$/);
    expect(data.order_state).toBe(1);
    expect(data.usdt_amount).toBe(50);
  });

  it('persists bank details in DB', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/withdrawal',
      payload: WITHDRAWAL_BODY,
    });

    const { data } = res.json();
    const row = await db('orders').where({ payment_code: data.payment_code }).first();
    expect(row.bank_id).toBe('MBBank');
    expect(row.bank_account_name).toBe('NGUYEN VAN A');
    expect(row.bank_account_no).toBe('1234567890');
    expect(row.direction).toBe('sell');
  });

  it('rejects negative amount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/withdrawal',
      payload: { ...WITHDRAWAL_BODY, amount: '-10' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects missing payment_info', async () => {
    const { payment_info, ...noPaymentInfo } = WITHDRAWAL_BODY;
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/withdrawal',
      payload: noPaymentInfo,
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects missing bank fields inside payment_info', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/withdrawal',
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
      payload: DEPOSIT_BODY,
    });
    const code = create.json().data.payment_code;

    const res = await app.inject({
      method: 'GET',
      url: `/api/orders/${code}`,
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.payment_code).toBe(code);
    expect(data.order_state).toBe(1);
    expect(data.chain_id).toBe(56);
    expect(data.recipient).toBe(DEPOSIT_BODY.recipient);
  });

  it('returns 404 for nonexistent code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/orders/USDT247-ZZZZZZZZ',
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('Order not found');
  });
});

// ─── SePay webhook → confirmPayment → order_state ─────────────────

describe('SePay webhook flow', () => {
  it('confirms payment and transitions order_state to PROCESSING', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      payload: DEPOSIT_BODY,
    });
    const { payment_code, net_vnd } = create.json().data;

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
        code: payment_code,
        content: `chuyen tien ${payment_code}`,
        transferType: 'in',
        transferAmount: net_vnd,
        accumulated: 10000000,
        subAccount: null,
        referenceCode: 'MB.12345',
        description: '',
      },
    });

    expect(webhookRes.statusCode).toBe(200);
    expect(webhookRes.json().success).toBe(true);

    const row = await db('orders').where({ payment_code }).first();
    expect(row.payment_status).toBe('payment_received');
    expect(row.order_state).toBe(2);
    expect(Number(row.vnd_received)).toBe(net_vnd);
  });

  it('deduplicates — second webhook with same id is ignored', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      payload: DEPOSIT_BODY,
    });
    const { payment_code, net_vnd } = create.json().data;

    const webhookPayload = {
      id: 99002,
      gateway: 'MBBank',
      transactionDate: '2026-04-22 12:00:00',
      accountNumber: '0123456789',
      code: payment_code,
      content: `chuyen tien ${payment_code}`,
      transferType: 'in',
      transferAmount: net_vnd,
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
      payload: DEPOSIT_BODY,
    });
    const { payment_code } = create.json().data;

    await app.inject({
      method: 'POST',
      url: '/api/webhooks/sepay',
      headers: { authorization: `Apikey ${process.env.SEPAY_WEBHOOK_API_KEY}` },
      payload: {
        id: 99003,
        gateway: 'MBBank',
        transactionDate: '2026-04-22 12:00:00',
        accountNumber: '0123456789',
        code: payment_code,
        content: `chuyen tien ${payment_code}`,
        transferType: 'in',
        transferAmount: 1000,
        accumulated: 10000000,
        subAccount: null,
        referenceCode: 'MB.12347',
        description: '',
      },
    });

    const row = await db('orders').where({ payment_code }).first();
    expect(row.payment_status).toBe('pending');
    expect(row.order_state).toBe(1);
  });

  it('ignores transferType=out', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      payload: DEPOSIT_BODY,
    });
    const { payment_code, net_vnd } = create.json().data;

    await app.inject({
      method: 'POST',
      url: '/api/webhooks/sepay',
      headers: { authorization: `Apikey ${process.env.SEPAY_WEBHOOK_API_KEY}` },
      payload: {
        id: 99004,
        gateway: 'MBBank',
        transactionDate: '2026-04-22 12:00:00',
        accountNumber: '0123456789',
        code: payment_code,
        content: `chuyen tien ${payment_code}`,
        transferType: 'out',
        transferAmount: net_vnd,
        accumulated: 10000000,
        subAccount: null,
        referenceCode: 'MB.12348',
        description: '',
      },
    });

    const row = await db('orders').where({ payment_code }).first();
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
      payload: DEPOSIT_BODY,
    });
    const { payment_code } = create.json().data;

    await updateOrderState(payment_code, 3);

    const row = await db('orders').where({ payment_code }).first();
    expect(row.order_state).toBe(3);
  });
});
