import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/configService', () => ({
  getConfig: vi.fn(async (key: string) => {
    if (key === 'price_source') return 'coingecko';
    if (key === 'rate_coingecko_source') return JSON.stringify({ cache_ttl_ms: 1 });
    return undefined;
  }),
  getTokenSideConfigFromDb: vi.fn(async (token: string, side: 'buy' | 'sell') => {
    if (token === 'USDC' && side === 'buy') {
      return {
        spread: 50,
        fee_rate: 0.008,
        min_fee: 5000,
        min_order_amount: 1,
        source: 'mock-source',
      };
    }
    return null;
  }),
}));

const mockSource = vi.fn(async () => ({ buy: 111, sell: 99, cached: false }));

let getPrices: typeof import('../src/services/priceSources').getPrices;
let registerPriceSource: typeof import('../src/services/priceSources').registerPriceSource;

beforeAll(async () => {
  const mod = await import('../src/services/priceSources');
  getPrices = mod.getPrices;
  registerPriceSource = mod.registerPriceSource;
  registerPriceSource('mock-source', mockSource);
});

describe('priceSources', () => {
  it('uses token source from config before global source', async () => {
    const prices = await getPrices('USDC');

    expect(mockSource).toHaveBeenCalledWith('USDC', {});
    expect(prices).toEqual({ buy: 111, sell: 99, cached: false });
  });
});
