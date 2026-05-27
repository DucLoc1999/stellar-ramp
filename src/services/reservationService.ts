import 'dotenv/config';
import Redis from 'ioredis';
import db from '../db';
import { getAccountBalance } from './payoutService';

const MICRO_SCALE = 7;
const RESERVATION_TTL_GRACE_MS = 5 * 60 * 1000;
const BALANCE_TTL_SEC = 15;

let redis: Redis | null = null;
let enabled = false;
let ready = false;

function parseBufferUnits(token: string): bigint {
  const normalized = token.toUpperCase();
  const value = normalized === 'XLM'
    ? process.env.RESERVATION_BUFFER_XLM ?? '1'
    : process.env.RESERVATION_BUFFER_USDC ?? '1';
  return toUnits(value);
}

function toUnits(input: string | number): bigint {
  const asString = String(input).trim();
  if (!asString) return 0n;
  const negative = asString.startsWith('-');
  const unsigned = negative ? asString.slice(1) : asString;
  const [wholeRaw, fracRaw = ''] = unsigned.split('.');
  const whole = wholeRaw || '0';
  const frac = (fracRaw + '0'.repeat(MICRO_SCALE)).slice(0, MICRO_SCALE);
  const units = BigInt(whole) * 10n ** BigInt(MICRO_SCALE) + BigInt(frac || '0');
  return negative ? -units : units;
}

function fromUnits(units: bigint): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const base = 10n ** BigInt(MICRO_SCALE);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(MICRO_SCALE, '0').replace(/0+$/, '');
  const body = frac ? `${whole.toString()}.${frac}` : whole.toString();
  return negative ? `-${body}` : body;
}

function balanceKey(token: string): string {
  return `wallet:balance:${token.toUpperCase()}`;
}

function totalKey(token: string): string {
  return `reserved:total:${token.toUpperCase()}`;
}

function reservationKey(direction: string, paymentCode: string): string {
  return `reservation:${direction}:${paymentCode}`;
}

function mapKey(paymentCode: string): string {
  return `reservation:map:${paymentCode}`;
}

const expiryZset = 'reservations:expiry';

function isEnabled(): boolean {
  return enabled && !!redis;
}

async function pruneExpired(nowMs: number, limit = 50): Promise<void> {
  if (!isEnabled()) return;
  const client = redis!;
  const expiredMembers = await client.zrangebyscore(expiryZset, 0, nowMs, 'LIMIT', 0, limit);
  for (const member of expiredMembers) {
    const colonIdx = member.indexOf(':');
    if (colonIdx === -1) continue;
    const direction = member.slice(0, colonIdx);
    const paymentCode = member.slice(colonIdx + 1);
    await releaseReservationByKey(reservationKey(direction, paymentCode), direction, paymentCode, 'expired');
  }
}

async function releaseReservationByKey(
  resKey: string,
  direction: string,
  paymentCode: string,
  reason: 'expired' | 'manual' | 'rollback'
): Promise<boolean> {
  if (!isEnabled()) return false;
  const client = redis!;
  for (let i = 0; i < 3; i++) {
    await client.watch(resKey);
    const data = await client.hgetall(resKey);
    if (!data || !data.state || !data.token || !data.amount_units) {
      await client.unwatch();
      await client.zrem(expiryZset, `${direction}:${paymentCode}`);
      return false;
    }
    if (data.state !== 'reserved') {
      await client.unwatch();
      await client.zrem(expiryZset, `${direction}:${paymentCode}`);
      return false;
    }
    const amountUnits = BigInt(data.amount_units);
    const tx = client.multi();
    tx.hset(resKey, 'state', 'released', 'release_reason', reason, 'released_at', String(Date.now()));
    tx.persist(resKey);
    tx.decrby(totalKey(data.token), amountUnits.toString());
    tx.del(mapKey(paymentCode));
    tx.zrem(expiryZset, `${direction}:${paymentCode}`);
    const out = await tx.exec();
    if (out) return true;
  }
  return false;
}

async function refreshBalanceFromApi(token: string): Promise<string | null> {
  const walletAddress = (process.env.WALLET_ADDRESS || '').trim();
  const network = process.env.STELLAR_NETWORK || 'testnet';

  if (token === 'VND') {
    const result = await getAccountBalance();
    if (!result.success) return null;
    return String(result.availableBalance ?? 0);
  }

  if (token === 'USDC') {
    const { getUsdcBalance } = await import('./stellarService');
    return getUsdcBalance(walletAddress, network);
  }

  if (token === 'XLM') {
    const { getXlmBalance } = await import('./stellarService');
    return getXlmBalance(walletAddress, network);
  }

  return null;
}

export async function initReservationService(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    enabled = false;
    ready = false;
    return;
  }
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });
  enabled = true;
  await reconcileReservedTotalsFromDb();
  ready = true;
}

export function startReservationSchedulers(): NodeJS.Timeout[] {
  if (!isEnabled()) return [];
  const sweepMs = Number(process.env.RESERVATION_SWEEP_INTERVAL_MS || 5000);
  const reconcileMs = Number(process.env.RESERVATION_RECONCILE_INTERVAL_MS || 60000);
  const a = setInterval(() => {
    pruneExpired(Date.now()).catch((err) => console.error('[Reservation] pruneExpired failed:', err));
  }, sweepMs);
  const c = setInterval(() => {
    reconcileReservedTotalsFromDb().catch((err) => console.error('[Reservation] reconcile failed:', err));
  }, reconcileMs);
  a.unref();
  c.unref();
  return [a, c];
}

export async function shutdownReservationService(): Promise<void> {
  if (redis) await redis.quit();
  redis = null;
  enabled = false;
  ready = false;
}

export interface ReserveResult {
  success: boolean;
  error?: 'RESERVATION_NOT_READY' | 'INSUFFICIENT_LIQUIDITY' | 'RESERVATION_CONFLICT';
}

export async function reserveForOrder(params: {
  paymentCode: string;
  direction: 'buy' | 'sell';
  token: string;
  amount: string | number;
  vndAmount: string | number;
  expiresAt: Date;
}): Promise<ReserveResult> {
  if (!isEnabled()) return { success: true };
  if (!ready) return { success: false, error: 'RESERVATION_NOT_READY' };
  const client = redis!;
  const token = params.token.toUpperCase();
  const amountUnits = toUnits(params.amount);
  const vndAmountUnits = toUnits(params.vndAmount);
  const bufferUnits = parseBufferUnits(token);
  const now = Date.now();

  await pruneExpired(now, 100);

  let balanceRaw = await client.get(balanceKey(token));

  if (!balanceRaw) {
    const fresh = await refreshBalanceFromApi(token);
    if (fresh === null) {
      return { success: false, error: 'RESERVATION_NOT_READY' };
    }
    balanceRaw = toUnits(fresh).toString();
    await client.set(balanceKey(token), balanceRaw, 'EX', BALANCE_TTL_SEC);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const paymentMap = mapKey(params.paymentCode);
    await client.watch(balanceKey(token), totalKey(token), paymentMap);
    const [currentBalance, reservedRaw, existing] = await client.mget(balanceKey(token), totalKey(token), paymentMap);
    if (existing) {
      await client.unwatch();
      return { success: true };
    }
    if (!currentBalance) {
      await client.unwatch();
      return { success: false, error: 'RESERVATION_NOT_READY' };
    }
    const balanceUnits = BigInt(currentBalance);
    const reservedUnits = BigInt(reservedRaw ?? '0');
    const available = balanceUnits - reservedUnits - bufferUnits;
    if (available < amountUnits) {
      await client.unwatch();
      return { success: false, error: 'INSUFFICIENT_LIQUIDITY' };
    }
    const resKey = reservationKey(params.direction, params.paymentCode);
    const ttlMs = Math.max(1000, params.expiresAt.getTime() - now + RESERVATION_TTL_GRACE_MS);
    const tx = client.multi();
    tx.incrby(totalKey(token), amountUnits.toString());
    tx.hset(resKey, {
      payment_code: params.paymentCode,
      direction: params.direction,
      token,
      amount_units: amountUnits.toString(),
      vnd_amount_units: vndAmountUnits.toString(),
      state: 'reserved',
      reserved_at: String(now),
      expires_at: String(params.expiresAt.getTime()),
    });
    tx.pexpire(resKey, ttlMs);
    tx.set(paymentMap, params.direction, 'PX', ttlMs);
    tx.zadd(expiryZset, String(params.expiresAt.getTime()), `${params.direction}:${params.paymentCode}`);
    const out = await tx.exec();
    if (out) return { success: true };
  }
  return { success: false, error: 'RESERVATION_CONFLICT' };
}

async function readReservation(paymentCode: string): Promise<{ direction: string; resKey: string } | null> {
  if (!isEnabled()) return null;
  const direction = await redis!.get(mapKey(paymentCode));
  if (!direction) return null;
  return { direction, resKey: reservationKey(direction, paymentCode) };
}

export async function consumeReservation(paymentCode: string): Promise<boolean> {
  if (!isEnabled()) return true;
  const info = await readReservation(paymentCode);
  if (!info) return false;
  const { direction, resKey } = info;
  const client = redis!;
  for (let i = 0; i < 3; i++) {
    await client.watch(resKey);
    const data = await client.hgetall(resKey);
    if (!data || data.state !== 'reserved' || !data.token || !data.amount_units) {
      await client.unwatch();
      return false;
    }
    const tx = client.multi();
    tx.hset(resKey, 'state', 'consumed', 'consumed_at', String(Date.now()));
    tx.persist(resKey);
    tx.decrby(totalKey(data.token), data.amount_units);
    tx.del(mapKey(paymentCode));
    tx.zrem(expiryZset, `${direction}:${paymentCode}`);
    const out = await tx.exec();
    if (out) return true;
  }
  return false;
}

export async function releaseReservation(paymentCode: string): Promise<boolean> {
  if (!isEnabled()) return true;
  const info = await readReservation(paymentCode);
  if (!info) return false;
  return releaseReservationByKey(info.resKey, info.direction, paymentCode, 'manual');
}

export async function rollbackReservation(paymentCode: string): Promise<boolean> {
  if (!isEnabled()) return true;
  const info = await readReservation(paymentCode);
  if (!info) return false;
  return releaseReservationByKey(info.resKey, info.direction, paymentCode, 'rollback');
}

export async function syncWalletBalances(): Promise<void> {
  if (!isEnabled()) return;
  const client = redis!;
  const walletAddress = (process.env.WALLET_ADDRESS || '').trim();
  if (!walletAddress) {
    ready = false;
    return;
  }
  const network = process.env.STELLAR_NETWORK || 'testnet';
  const { getUsdcBalance, getXlmBalance } = await import('./stellarService');
  const [usdc, xlm] = await Promise.all([
    getUsdcBalance(walletAddress, network),
    getXlmBalance(walletAddress, network),
  ]);
  const pipe = client.multi();
  pipe.set(balanceKey('USDC'), toUnits(usdc).toString(), 'EX', BALANCE_TTL_SEC);
  pipe.set(balanceKey('XLM'), toUnits(xlm).toString(), 'EX', BALANCE_TTL_SEC);
  await pipe.exec();
}

export async function syncVndBalance(): Promise<void> {
  if (!isEnabled()) return;
  const client = redis!;
  const result = await getAccountBalance();
  if (!result.success) {
    console.error('[Reservation] syncVndBalance failed:', result.error);
    ready = false;
    return;
  }
  await client.set(balanceKey('VND'), toUnits(String(result.availableBalance ?? 0)).toString(), 'EX', BALANCE_TTL_SEC);
}

export async function reconcileReservedTotalsFromDb(): Promise<void> {
  if (!isEnabled()) return;
  const client = redis!;

  const buyRows = await db('orders')
    .select('asset_code')
    .sum<{ asset_code: string; total: string }[]>({ total: 'usdt_amount' })
    .where({ direction: 'buy', payment_status: 'pending', order_state: 1 })
    .andWhere('expired_at', '>', db.fn.now())
    .groupBy('asset_code');

  const totals = new Map<string, bigint>([['USDC', 0n], ['XLM', 0n], ['VND', 0n]]);
  for (const row of buyRows) {
    const token = (row.asset_code || 'USDC').toUpperCase();
    totals.set(token, toUnits(row.total || '0'));
  }

  const sellKeys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', 'reservation:sell:*', 'COUNT', 100);
    cursor = nextCursor;
    sellKeys.push(...keys);
  } while (cursor !== '0');

  if (sellKeys.length > 0) {
    const pipe = client.multi();
    for (const key of sellKeys) {
      pipe.hget(key, 'vnd_amount_units');
    }
    const results = await pipe.exec();
    if (results) {
      let vndTotal = 0n;
      for (const [err, val] of results) {
        if (!err && val) vndTotal += BigInt(val as string);
      }
      totals.set('VND', vndTotal);
    }
  }

  const tx = client.multi();
  for (const [token, value] of totals.entries()) {
    tx.set(totalKey(token), value.toString());
  }
  await tx.exec();
}

export function formatUnitsForLog(value: bigint): string {
  return fromUnits(value);
}