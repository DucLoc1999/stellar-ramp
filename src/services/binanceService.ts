import 'dotenv/config';

const BINANCE_P2P_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';
const CACHE_TTL_MS = 5_000;

interface PriceCache {
  buy: number;
  sell: number;
  fetchedAt: number;
}

let priceCache = new Map<string, PriceCache>();

const COINGECKO_ASSET_MAP: Record<string, string> = {
  XLM: 'stellar',
};

const FALLBACK_PRICES: Record<string, number> = {
  USDC: 26500,
  XLM: 7500,
};

async function fetchMedianPrice(tradeType: 'BUY' | 'SELL', asset: string): Promise<number> {
  const res = await fetch(BINANCE_P2P_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset,
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
  if (prices.length === 0) {
    throw new Error(`No ${asset} offers on Binance P2P`);
  }
  prices.sort((a, b) => a - b);
  return prices[Math.floor(prices.length / 2)];
}

async function fetchCoinGeckoPrice(asset: string): Promise<number> {
  const coingeckoId = COINGECKO_ASSET_MAP[asset.toUpperCase()];
  if (!coingeckoId) {
    throw new Error(`No CoinGecko mapping for ${asset}`);
  }

  const apiKey = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['x-cg-demo-api-key'] = apiKey;
  }

  const url = `${COINGECKO_URL}?ids=${coingeckoId}&vs_currencies=vnd`;
  const res = await fetch(url, { headers });

  if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);

  const json = await res.json() as Record<string, { vnd: number }>;
  const price = json[coingeckoId]?.vnd;
  if (!price) throw new Error(`No price for ${coingeckoId} in CoinGecko response`);

  return price;
}

export async function getBinancePrices(asset: string = 'USDC'): Promise<{ buy: number; sell: number; cached: boolean }> {
  const now = Date.now();
  const cacheKey = asset.toUpperCase();

  const cached = priceCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return { ...cached, cached: true };
  }

  try {
    if (COINGECKO_ASSET_MAP[cacheKey]) {
      const price = await fetchCoinGeckoPrice(asset);
      const spread = 100;
      priceCache.set(cacheKey, { buy: price + spread, sell: price - spread, fetchedAt: now });
      return { buy: price + spread, sell: price - spread, cached: false };
    }

    const [buy, sell] = await Promise.all([
      fetchMedianPrice('BUY', asset),
      fetchMedianPrice('SELL', asset),
    ]);
    priceCache.set(cacheKey, { buy, sell, fetchedAt: now });
    return { buy, sell, cached: false };
  } catch (err) {
    const fallback = priceCache.get(cacheKey);
    if (fallback) return { ...fallback, cached: true };
    const fallbackPrice = FALLBACK_PRICES[cacheKey] ?? 26500;
    return { buy: fallbackPrice + 100, sell: fallbackPrice - 100, cached: false };
  }
}

export function invalidatePriceCache(): void {
  priceCache.clear();
}
