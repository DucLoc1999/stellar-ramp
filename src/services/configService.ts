import db from '../db';

type ConfigKey = string;

const cache = new Map<ConfigKey, string>();

async function load(): Promise<void> {
  const rows = await db('config').select('key', 'value');
  for (const row of rows) cache.set(row.key, row.value);
}

export async function getConfig(key: ConfigKey): Promise<string | undefined> {
  if (cache.size === 0) await load();
  return cache.get(key);
}

export async function getConfigNumber(key: ConfigKey, fallback: number): Promise<number> {
  const val = await getConfig(key);
  return val !== undefined ? Number(val) : fallback;
}

export async function getAllConfig(): Promise<Record<string, string>> {
  if (cache.size === 0) await load();
  return Object.fromEntries(cache);
}

export async function updateConfig(
  key: ConfigKey,
  value: string,
  changedBy = 'admin',
): Promise<void> {
  const old = cache.get(key);
  await db('config').where({ key }).update({ value });
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
}
