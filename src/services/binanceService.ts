// Fetches Binance P2P prices and caches them for 5 seconds.
const BINANCE_P2P_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
const CACHE_TTL_MS = 5_000;

interface PriceCache {
  buy: number;
  sell: number;
  fetchedAt: number;
}

let priceCache: PriceCache | null = null;

async function fetchMedianPrice(tradeType: 'BUY' | 'SELL'): Promise<number> {
  const res = await fetch(BINANCE_P2P_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset: 'USDT',
      fiat: 'VND',
      merchantCheck: false,
      page: 1,
      publisherType: null,
      rows: 5,
      tradeType,
    }),
  });

  if (!res.ok) throw new Error(`Binance P2P returned ${res.status}`);

  const json = (await res.json()) as { data: Array<{ adv: { price: string } }> };
  const prices = json.data.map((d) => Number(d.adv.price));
  prices.sort((a, b) => a - b);
  return prices[Math.floor(prices.length / 2)];
}

export async function getBinancePrices(): Promise<{ buy: number; sell: number; cached: boolean }> {
  const now = Date.now();

  if (priceCache && now - priceCache.fetchedAt < CACHE_TTL_MS) {
    return { ...priceCache, cached: true };
  }

  try {
    const [buy, sell] = await Promise.all([
      fetchMedianPrice('BUY'),
      fetchMedianPrice('SELL'),
    ]);
    priceCache = { buy, sell, fetchedAt: now };
    return { buy, sell, cached: false };
  } catch (err) {
    if (priceCache) return { ...priceCache, cached: true };
    throw err;
  }
}

export function invalidatePriceCache(): void {
  priceCache = null;
}
