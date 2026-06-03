import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = os.tmpdir();
const testDbPath = path.join(tmpDir, `p2p_prices_test_${Date.now()}.db`);
process.env.DB_PATH = testDbPath;

let getLatestPrice: typeof import('../src/services/snapshotLandingPageDb').getLatestPrice;
let getHistory: typeof import('../src/services/snapshotLandingPageDb').getHistory;

beforeAll(async () => {
  const module = await import('../src/services/snapshotLandingPageDb');
  getLatestPrice = module.getLatestPrice;
  getHistory = module.getHistory;
});

afterAll(() => {
  try {
    fs.unlinkSync(testDbPath);
  } catch {
    // ignore
  }
});

describe('snapshotLandingPageDb', () => {
  it('returns the latest USDC price per exchange using asset binding', () => {
    const price = getLatestPrice('binance', 'buy', 'USDC');
    expect(price).toBeGreaterThan(0);
  });

  it('returns the latest XLM price per exchange using asset binding', () => {
    const price = getLatestPrice('binance', 'buy', 'XLM');
    expect(price).toBeGreaterThan(0);
  });

  it('returns history for the requested USDC asset', () => {
    const history = getHistory('binance', 1, 'USDC');
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toHaveProperty('buy');
    expect(history[0]).toHaveProperty('sell');
  });

  it('returns history for the requested XLM asset', () => {
    const history = getHistory('binance', 1, 'XLM');
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toHaveProperty('buy');
    expect(history[0]).toHaveProperty('sell');
  });
});
