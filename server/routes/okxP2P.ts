import { RequestHandler } from "express";
import * as crypto from "crypto";
import { P2PRate } from "../../shared/api";
import { getCache, setCache } from "../cache";
import { insertSnapshot } from "../db";

const CACHE_KEY = "okx-p2p-rate";
const BASE_URL = "https://www.okx.com";
const HANOI_PREMIUM = 412;

function getSignature(secretKey: string, timestamp: string, method: string, path: string): string {
  return crypto.createHmac("sha256", secretKey).update(timestamp + method + path).digest("base64");
}

async function fetchUSDCIndexPrice(): Promise<number> {
  const timestamp = new Date().toISOString();
  const path = "/api/v5/market/index-tickers?instId=USDC-USD";
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "OK-ACCESS-KEY": process.env.OKX_API_KEY!,
      "OK-ACCESS-SIGN": getSignature(process.env.OKX_SECRET_KEY!, timestamp, "GET", path),
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": process.env.OKX_PASSPHRASE!,
    },
  });
  const json = await response.json();
  return parseFloat(json.data?.[0]?.idxPx || "1.0000");
}

async function fetchUSDVNDRate(): Promise<number> {
  const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
  const json = await response.json();
  return json.rates.VND;
}

export const handleOKXP2PRate: RequestHandler = async (_req, res) => {
  const cached = getCache<P2PRate>(CACHE_KEY);
  if (cached) return void res.json(cached);

  try {
    const [usdcPeg, bankRate] = await Promise.all([fetchUSDCIndexPrice(), fetchUSDVNDRate()]);
    const marketMid = bankRate * usdcPeg + HANOI_PREMIUM;
    const bestBuyPrice = Math.round(marketMid * 1.0016);
    const bestSellPrice = Math.round(marketMid * 0.9984);

    const result: P2PRate = { bestBuyPrice, bestSellPrice };
    setCache(CACHE_KEY, result);
    insertSnapshot({ exchange: "okx", trade_type: "buy", asset: "USDC", fiat: "VND", best_price: bestBuyPrice });
    insertSnapshot({ exchange: "okx", trade_type: "sell", asset: "USDC", fiat: "VND", best_price: bestSellPrice });
    res.json(result);
  } catch {
    res.status(502).json({ error: "Failed to fetch OKX rates" });
  }
};
