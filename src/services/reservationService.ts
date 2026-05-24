import Redis from 'ioredis';
import db from '../db';

const MICRO_SCALE = 7;
const RESERVATION_TTL_GRACE_MS = 5 * 60 * 1000;

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

function reservationKey(resId: string): string {
  return `reservation:${resId}`;
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
  const expiredIds = await client.zrangebyscore(expiryZset, 0, nowMs, 'LIMIT', 0, limit);
  for (const resId of expiredIds) {
    await releaseReservationById(resId, 'expired');
  }
}

async function releaseReservationById(resId: string, reason: 'expired' | 'manual' | 'rollback'): Promise<boolean> {
  if (!isEnabled()) return false;
  const client = redis!;
  for (let i = 0; i < 3; i++) {
    await client.watch(reservationKey(resId));
    const data = await client.hgetall(reservationKey(resId));
    if (!data || !data.state || !data.token || !data.amount_units) {
      await client.unwatch();
      await client.zrem(expiryZset, resId);
      return false;
    }
    if (data.state !== 'reserved') {
      await client.unwatch();
      await client.zrem(expiryZset, resId);
      return false;
    }
    const amountUnits = BigInt(data.amount_units);
    const tx = client.multi();
    tx.hset(reservationKey(resId), 'state', 'released', 'release_reason', reason, 'released_at', String(Date.now()));
    tx.persist(reservationKey(resId));
    tx.decrby(totalKey(data.token), amountUnits.toString());
    tx.del(mapKey(data.payment_code));
    tx.zrem(expiryZset, resId);
    const out = await tx.exec();
    if (out) return true;
  }
  return false;
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
  await syncWalletBalances();
  await reconcileReservedTotalsFromDb();
  ready = true;
}

export function startReservationSchedulers(): NodeJS.Timeout[] {
  if (!isEnabled()) return [];
  const sweepMs = Number(process.env.RESERVATION_SWEEP_INTERVAL_MS || 5000);
  const walletSyncMs = Number(process.env.RESERVATION_WALLET_SYNC_INTERVAL_MS || 15000);
  const reconcileMs = Number(process.env.RESERVATION_RECONCILE_INTERVAL_MS || 60000);
  const a = setInterval(() => {
    pruneExpired(Date.now()).catch((err) => console.error('[Reservation] pruneExpired failed:', err));
  }, sweepMs);
  const b = setInterval(() => {
    syncWalletBalances().catch((err) => console.error('[Reservation] syncWalletBalances failed:', err));
  }, walletSyncMs);
  const c = setInterval(() => {
    reconcileReservedTotalsFromDb().catch((err) => console.error('[Reservation] reconcile failed:', err));
  }, reconcileMs);
  a.unref();
  b.unref();
  c.unref();
  return [a, b, c];
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
  token: string;
  amount: string | number;
  expiresAt: Date;
}): Promise<ReserveResult> {
  if (!isEnabled()) return { success: true };
  if (!ready) return { success: false, error: 'RESERVATION_NOT_READY' };
  const client = redis!;
  const token = params.token.toUpperCase();
  const amountUnits = toUnits(params.amount);
  const bufferUnits = parseBufferUnits(token);
  const now = Date.now();
  await pruneExpired(now, 100);
  for (let attempt = 0; attempt < 3; attempt++) {
    const paymentMap = mapKey(params.paymentCode);
    await client.watch(balanceKey(token), totalKey(token), paymentMap);
    const [balanceRaw, reservedRaw, existing] = await client.mget(balanceKey(token), totalKey(token), paymentMap);
    if (existing) {
      await client.unwatch();
      return { success: true };
    }
    if (!balanceRaw) {
      await client.unwatch();
      return { success: false, error: 'RESERVATION_NOT_READY' };
    }
    const balanceUnits = BigInt(balanceRaw);
    const reservedUnits = BigInt(reservedRaw ?? '0');
    const available = balanceUnits - reservedUnits - bufferUnits;
    if (available < amountUnits) {
      await client.unwatch();
      return { success: false, error: 'INSUFFICIENT_LIQUIDITY' };
    }
    const resId = `${params.paymentCode}:${now}`;
    const ttlMs = Math.max(1000, params.expiresAt.getTime() - now + RESERVATION_TTL_GRACE_MS);
    const tx = client.multi();
    tx.incrby(totalKey(token), amountUnits.toString());
    tx.hset(reservationKey(resId), {
      payment_code: params.paymentCode,
      token,
      amount_units: amountUnits.toString(),
      state: 'reserved',
      reserved_at: String(now),
      expires_at: String(params.expiresAt.getTime()),
    });
    tx.pexpire(reservationKey(resId), ttlMs);
    tx.set(paymentMap, resId, 'PX', ttlMs);
    tx.zadd(expiryZset, String(params.expiresAt.getTime()), resId);
    const out = await tx.exec();
    if (out) return { success: true };
  }
  return { success: false, error: 'RESERVATION_CONFLICT' };
}

async function readReservationId(paymentCode: string): Promise<string | null> {
  if (!isEnabled()) return null;
  return redis!.get(mapKey(paymentCode));
}

export async function consumeReservation(paymentCode: string): Promise<boolean> {
  if (!isEnabled()) return true;
  const client = redis!;
  const resId = await readReservationId(paymentCode);
  if (!resId) return false;
  for (let i = 0; i < 3; i++) {
    await client.watch(reservationKey(resId));
    const data = await client.hgetall(reservationKey(resId));
    if (!data || data.state !== 'reserved' || !data.token || !data.amount_units) {
      await client.unwatch();
      return false;
    }
    const tx = client.multi();
    tx.hset(reservationKey(resId), 'state', 'consumed', 'consumed_at', String(Date.now()));
    tx.persist(reservationKey(resId));
    tx.decrby(totalKey(data.token), data.amount_units);
    tx.del(mapKey(paymentCode));
    tx.zrem(expiryZset, resId);
    const out = await tx.exec();
    if (out) return true;
  }
  return false;
}

export async function releaseReservation(paymentCode: string): Promise<boolean> {
  if (!isEnabled()) return true;
  const resId = await readReservationId(paymentCode);
  if (!resId) return false;
  return releaseReservationById(resId, 'manual');
}

export async function rollbackReservation(paymentCode: string): Promise<boolean> {
  if (!isEnabled()) return true;
  const resId = await readReservationId(paymentCode);
  if (!resId) return false;
  return releaseReservationById(resId, 'rollback');
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
  await client.set(balanceKey('USDC'), toUnits(usdc).toString());
  await client.set(balanceKey('XLM'), toUnits(xlm).toString());
}

export async function reconcileReservedTotalsFromDb(): Promise<void> {
  if (!isEnabled()) return;
  const client = redis!;
  const rows = await db('orders')
    .select('asset_code')
    .sum<{ asset_code: string; total: string }[]>({ total: 'usdt_amount' })
    .where({ direction: 'buy', payment_status: 'pending', order_state: 1 })
    .andWhere('expired_at', '>', db.fn.now())
    .groupBy('asset_code');
  const totals = new Map<string, bigint>([['USDC', 0n], ['XLM', 0n]]);
  for (const row of rows) {
    const token = (row.asset_code || 'USDC').toUpperCase();
    totals.set(token, toUnits(row.total || '0'));
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
