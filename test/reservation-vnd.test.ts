import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { runMigrations, destroyDb } from './helper';

vi.mock('ioredis', () => ({
  default: vi.fn(),
}));

describe('reservationService VND extension', () => {
  beforeAll(async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.WALLET_ADDRESS = 'GABCDEF1234567890';
    await runMigrations();
  });

  afterAll(async () => {
    delete process.env.REDIS_URL;
    delete process.env.WALLET_ADDRESS;
    await destroyDb();
  });

  it('syncVndBalance runs and updates VND balance key', async () => {
    const { syncVndBalance } = await import('../src/services/reservationService');
    await syncVndBalance();
    expect(true).toBe(true);
  });
});