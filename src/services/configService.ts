import db from '../db';

type ConfigKey = string;

const cache = new Map<ConfigKey, string>();
let cacheLoaded = false;

async function loadFromDb(): Promise<void> {
  const rows = await db('config').select('key', 'value');
  for (const row of rows) cache.set(row.key, row.value);
}

async function load(): Promise<void> {
  if (!cacheLoaded) {
    await loadFromDb();
    cacheLoaded = true;
  }
}

export async function refresh(): Promise<void> {
  cache.clear();
  await loadFromDb();
  cacheLoaded = true;
}

function envFallback(key: ConfigKey, fallback: number): number {
  const envMap: Record<string, string> = {
    spread_buy: 'SPREAD_BUY',
    spread_sell: 'SPREAD_SELL',
    fee_rate_buy: 'FEE_RATE_BUY',
    fee_rate_sell: 'FEE_RATE_SELL',
    usdc_spread_buy: 'USDC_SPREAD_BUY',
    usdc_spread_sell: 'USDC_SPREAD_SELL',
    usdc_fee_rate_buy: 'USDC_FEE_RATE_BUY',
    usdc_fee_rate_sell: 'USDC_FEE_RATE_SELL',
    xlm_spread_buy: 'XLM_SPREAD_BUY',
    xlm_spread_sell: 'XLM_SPREAD_SELL',
    xlm_fee_rate_buy: 'XLM_FEE_RATE_BUY',
    xlm_fee_rate_sell: 'XLM_FEE_RATE_SELL',
    usdc_min_fee: 'USDC_MIN_FEE_VND',
    xlm_min_fee: 'XLM_MIN_FEE_VND',
    min_fee_vnd: 'MIN_FEE_VND',
  };
  const envKey = envMap[key] || key.toUpperCase().replace(/[.-]/g, '_');
  const envVal = process.env[envKey];
  if (envVal !== undefined) {
    const parsed = Number(envVal);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

export async function getConfig(key: ConfigKey): Promise<string | undefined> {
  await load();
  const val = cache.get(key);
  if (val !== undefined) return val;
  return undefined;
}

export async function getConfigNumber(key: ConfigKey, fallback: number): Promise<number> {
  const val = await getConfig(key);
  if (val !== undefined) {
    const parsed = Number(val);
    if (!isNaN(parsed)) return parsed;
    console.warn(`[ConfigService] Unparseable value for key="${key}" val="${val}", using fallback=${fallback}`);
  }
  return envFallback(key, fallback);
}

export async function getAllConfig(): Promise<Record<string, string>> {
  await load();
  return Object.fromEntries(cache);
}

export async function updateConfig(
  key: ConfigKey,
  value: string,
  changedBy = 'admin',
): Promise<void> {
  const old = cache.get(key);
  await db('config')
    .insert({ key, value })
    .onConflict('key')
    .merge({ value });
  cache.set(key, value);

  if (key.startsWith('fee_rate')) {
    await db('fee_audit_log').insert({
      config_key: key,
      old_value: old ?? null,
      new_value: value,
      changed_by: changedBy,
    });
  }
}

export function invalidateCache(): void {
  cache.clear();
  cacheLoaded = false;
}

export type TokenSide = 'buy' | 'sell';
export type TokenKind = 'spread' | 'fee_rate' | 'min_fee';

export async function getTokenConfig(
  token: string,
  side: TokenSide,
  kind: TokenKind,
): Promise<number> {
  const t = token.toLowerCase();
  const keyMap: Record<string, string> = {
    'spread_buy': `${t}_spread_buy`,
    'spread_sell': `${t}_spread_sell`,
    'fee_rate_buy': `${t}_fee_rate_buy`,
    'fee_rate_sell': `${t}_fee_rate_sell`,
    'min_fee': `${t}_min_fee`,
  };
  const sideKind = `${kind}_${side}` as const;
  const key = keyMap[sideKind];
  if (!key) throw new Error(`Invalid token config: ${token} ${side} ${kind}`);

  const tokenSpecific = await getConfig(key);
  if (tokenSpecific !== undefined) {
    const parsed = Number(tokenSpecific);
    if (!isNaN(parsed)) return parsed;
  }

  const globalKeyMap: Record<string, string> = {
    'spread_buy': 'spread_buy',
    'spread_sell': 'spread_sell',
    'fee_rate_buy': 'fee_rate_buy',
    'fee_rate_sell': 'fee_rate_sell',
    'min_fee': 'min_fee_vnd',
  };
  const globalKey = globalKeyMap[sideKind];
  const defaultMap: Record<string, number> = {
    'spread_buy': 50,
    'spread_sell': 50,
    'fee_rate_buy': 0.008,
    'fee_rate_sell': 0.008,
    'min_fee': 5000,
  };
  return getConfigNumber(globalKey, defaultMap[globalKey] ?? 50);
}