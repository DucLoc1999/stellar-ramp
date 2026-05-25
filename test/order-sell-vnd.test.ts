import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, runMigrations, cleanOrders, destroyDb, db } from './helper';
import type { FastifyInstance } from 'fastify';

const PARTNER_APP_KEY = process.env.PARTNER_APP_KEY || 'test-partner-key';
const PARTNER_HEADERS = { 'partner-app-key': PARTNER_APP_KEY };

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

vi.mock('ioredis', () => ({
  default: vi.fn(),
}));

let app: FastifyInstance;

describe('Sell flow VND reservation integration', () => {
  beforeAll(async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.WALLET_ADDRESS = 'GABCDEF1234567890';
    await runMigrations();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    await destroyDb();
    delete process.env.REDIS_URL;
    delete process.env.WALLET_ADDRESS;
  });

  beforeEach(async () => {
    await cleanOrders();
    vi.clearAllMocks();
  });

  it('creates withdrawal order and persists in DB', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/withdrawal',
      headers: PARTNER_HEADERS,
      payload: WITHDRAWAL_BODY,
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.order_type).toBe('sell');
    expect(data.state).toBe(1);
    expect(data.code).toMatch(/^DH[A-Z0-9]{10}$/);

    const row = await db('orders').where({ payment_code: data.code }).first();
    expect(row).toBeDefined();
    expect(row.direction).toBe('sell');
    expect(row.order_state).toBe(1);
    expect(row.bank_id).toBe('MBBank');
    expect(row.bank_account_name).toBe('NGUYEN VAN A');
  });
});