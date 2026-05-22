import { getConfig } from '../configService';
import { binanceSource } from './binanceSource';
import { coingeckoSource } from './coingeckoSource';

export interface PriceSourceResult {
  buy: number;
  sell: number;
  cached: boolean;
}

export type PriceSourceFn = (asset: string, config: Record<string, unknown>) => Promise<PriceSourceResult>;

const registry: Record<string, PriceSourceFn> = {
  binance: binanceSource,
  coingecko: coingeckoSource,
};

export function registerPriceSource(name: string, fn: PriceSourceFn): void {
  registry[name] = fn;
}

async function getSourceName(): Promise<string> {
  const dbVal = await getConfig('price_source');
  if (dbVal && registry[dbVal]) return dbVal;
  const envVal = process.env.PRICE_SOURCE;
  if (envVal && registry[envVal]) return envVal;
  return 'binance';
}

async function getSourceConfig(source: string): Promise<Record<string, unknown>> {
  const raw = await getConfig(`rate_${source}_source`);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getPrices(asset: string): Promise<PriceSourceResult> {
  const source = await getSourceName();
  const config = await getSourceConfig(source);
  return registry[source](asset, config);
}
