import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, runMigrations, cleanOrders, destroyDb, db } from './helper';
import type { FastifyInstance } from 'fastify';
import { createAdmin } from '../src/services/adminService';

let app: FastifyInstance;

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'password123';

beforeAll(async () => {
  process.env.ADMIN_JWT_SECRET = 'test-secret';
  await runMigrations();
  await db('admins').where({ email: ADMIN_EMAIL }).del();
  await createAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await destroyDb();
});

beforeEach(async () => {
  await cleanOrders();
});

async function login(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/login',
    payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.success).toBe(true);
  return body.data.access_token as string;
}

describe('Admin workflow', () => {
  it('POST /login returns JWT', async () => {
    const token = await login();
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('PATCH /config updates fee config (auth)', async () => {
    const token = await login();
    const res = await app.inject({
      method: 'PATCH',
      url: '/config',
      headers: { authorization: `Bearer ${token}` },
      payload: { fee_rate_buy: 0.01, spread_buy: 75 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.fee_rate_buy).toBe(0.01);
    expect(body.data.spread_buy).toBe(75);
  });

  it('GET /stats returns aggregated totals (auth)', async () => {
    const token = await login();

    await db('orders').insert({
      payment_code: 'USDC247-TEST0001',
      direction: 'buy',
      usdt_amount: 10,
      rate: 25000,
      net_vnd: 250000,
      fee_rate: 0.008,
      fee_vnd: 2000,
      payment_status: 'payment_received',
      payment_confirmed_at: db.fn.now(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/stats',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.totals.count).toBe(1);
    expect(body.data.totals.net_vnd).toBe(250000);
    expect(body.data.by_direction.buy.count).toBe(1);
  });
});

