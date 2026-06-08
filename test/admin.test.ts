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

  it('POST /cms/partner creates a partner and exposes its key', async () => {
    const token = await login();
    const res = await app.inject({
      method: 'POST',
      url: '/cms/partner',
      headers: { authorization: 'Bearer ' + token },
      payload: { name: 'Partner A', fee_buy: 0.002, fee_sell: 0.003, active: true },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeTruthy();
    expect(body.data.key).toMatch(/^[a-f0-9]{64}$/);

    const getRes = await app.inject({
      method: 'GET',
      url: '/cms/partner/' + body.data.id,
      headers: { authorization: 'Bearer ' + token },
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().data.name).toBe('Partner A');
  });

  it('applies partner fee and persists partner_id on new orders', async () => {
    const token = await login();
    const partnerRes = await app.inject({
      method: 'POST',
      url: '/cms/partner',
      headers: { authorization: 'Bearer ' + token },
      payload: { name: 'Partner B', fee_buy: 0.002, fee_sell: 0.003, active: true },
    });

    const partner = partnerRes.json().data;
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders/deposit',
      headers: { 'partner-app-key': partner.key },
      payload: {
        amount: '100',
        chain_id: 56,
        asset_code: 'USDC',
        token_address: '0x55d398326f99059fF775485246999027B3197955',
        recipient: 'GDZST3XVCDTUJ76ZAV2HA72KYPJM7L7J4JZ5L6G6UFVPJKZ6JCZXM5CM',
        callback: 'https://example.com/webhook',
      },
    });

    expect(orderRes.statusCode).toBe(200);
    const order = orderRes.json().data;
    expect(order.total_fee_vnd).toBe(25000);

    const row = await db('orders').where({ payment_code: order.code }).first();
    expect(row.partner_id).toBe(partner.id);
    expect(Number(row.fee_vnd)).toBe(25000);
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
      order_state: 3,
      payment_confirmed_at: new Date().toISOString(),
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

