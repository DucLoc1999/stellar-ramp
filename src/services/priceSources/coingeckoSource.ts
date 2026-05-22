import type { PriceSourceResult } from './index';

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
  USDC: 'usd-coin',
};

export async function coingeckoSource(asset: string): Promise<PriceSourceResult> {
  const now = Date.now();
  const cacheKey = asset.toUpperCase();

  const cached = priceCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return { ...cached, cached: true };
  }

  const coingeckoId = COINGECKO_ASSET_MAP[cacheKey];
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

  const spread = 100;
  const buy = price + spread;
  const sell = price - spread;
  priceCache.set(cacheKey, { buy, sell, fetchedAt: now });
  return { buy, sell, cached: false };
}
