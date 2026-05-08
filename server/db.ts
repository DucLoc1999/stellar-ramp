import { DatabaseSync } from "node:sqlite";
import path from "path";

export type Exchange = "binance" | "okx" | "bybit" | "our";
export type TradeType = "buy" | "sell";

export interface P2PSnapshot {
  exchange: Exchange;
  trade_type: TradeType;
  asset: string;
  fiat: string;
  best_price: number;
}

const DB_PATH = path.resolve("stellar_ramp.db");
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS p2p_prices (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    exchange   TEXT    NOT NULL,
    trade_type TEXT    NOT NULL,
    asset      TEXT    NOT NULL,
    fiat       TEXT    NOT NULL,
    best_price REAL    NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_p2p_created_at ON p2p_prices (created_at);
`);

// Seed mock data for 30 days if the table is empty or stale (latest record > 1 day old)
const countRow = db.prepare("SELECT COUNT(*) AS c FROM p2p_prices").get() as { c: number };
const latestRow = db.prepare("SELECT MAX(created_at) AS ts FROM p2p_prices").get() as { ts: number | null };
const isEmpty = countRow.c === 0 || latestRow.ts === null || Date.now() - latestRow.ts > 24 * 60 * 60 * 1000;
if (isEmpty) {
  db.exec("DELETE FROM p2p_prices");
  const insert = db.prepare(
    "INSERT INTO p2p_prices (exchange, trade_type, asset, fiat, best_price, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const MOCK_CONFIG: Record<Exchange, { buyBase: number; sellBase: number; drift: number }> = {
    binance: { buyBase: 25_700, sellBase: 25_900, drift: 300 },
    okx:     { buyBase: 25_650, sellBase: 25_850, drift: 280 },
    bybit:   { buyBase: 25_680, sellBase: 25_880, drift: 320 },
    our:     { buyBase: 25_600, sellBase: 25_950, drift: 300 },
  };
  const now = Date.now();

  for (let day = 29; day >= 0; day--) {
    const ts = now - day * 24 * 60 * 60 * 1000;
    const noise = Math.sin(day * 0.7) * 0.5 + Math.cos(day * 1.3) * 0.5;
    for (const exchange of ["binance", "okx", "bybit", "our"] as Exchange[]) {
      const { buyBase, sellBase, drift } = MOCK_CONFIG[exchange];
      insert.run(exchange, "buy",  "USDC", "VND", Math.round(buyBase  + noise * drift), ts);
      insert.run(exchange, "sell", "USDC", "VND", Math.round(sellBase + noise * drift), ts);
    }
  }

  for (let hour = 23; hour >= 0; hour--) {
    const ts = now - hour * 60 * 60 * 1000;
    const noise = Math.sin(hour * 0.9) * 0.5 + Math.cos(hour * 0.4) * 0.5;
    for (const exchange of ["binance", "okx", "bybit", "our"] as Exchange[]) {
      const { buyBase, sellBase, drift } = MOCK_CONFIG[exchange];
      insert.run(exchange, "buy",  "USDC", "VND", Math.round(buyBase  + noise * drift * 0.3), ts);
      insert.run(exchange, "sell", "USDC", "VND", Math.round(sellBase + noise * drift * 0.3), ts);
    }
  }
}

export interface HistoryRow {
  created_at: number;
  buy: number | null;
  sell: number | null;
}

export function getHistory(exchange: Exchange, days: number): HistoryRow[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const bucketMs = days === 1 ? 60_000 : 86_400_000;
  return db.prepare(`
    SELECT
      (created_at / ${bucketMs}) * ${bucketMs} AS created_at,
      MAX(CASE WHEN trade_type = 'buy'  THEN best_price END) AS buy,
      MAX(CASE WHEN trade_type = 'sell' THEN best_price END) AS sell
    FROM p2p_prices
    WHERE exchange = ? AND created_at >= ?
    GROUP BY created_at / ${bucketMs}
    ORDER BY created_at ASC
  `).all(exchange, cutoff) as unknown as HistoryRow[];
}

export function getLatestBinancePrice(tradeType: TradeType): number | null {
  const row = db.prepare(`
    SELECT best_price FROM p2p_prices
    WHERE exchange = 'binance' AND trade_type = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(tradeType) as unknown as { best_price: number } | undefined;
  return row?.best_price ?? null;
}

export function insertSnapshot(snapshot: P2PSnapshot): void {
  const now = Date.now();
  db.prepare(`
    INSERT INTO p2p_prices (exchange, trade_type, asset, fiat, best_price, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(snapshot.exchange, snapshot.trade_type, snapshot.asset, snapshot.fiat, snapshot.best_price, now);
  db.prepare(`DELETE FROM p2p_prices WHERE created_at < ?`).run(now - THIRTY_DAYS_MS);
}
