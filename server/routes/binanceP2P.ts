import { RequestHandler } from "express";
import { P2PRate } from "../../shared/api";
import { getCache, setCache } from "../cache";
import { insertSnapshot } from "../db";

const CACHE_KEY = "binance-p2p-rate";
const BINANCE_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

async function fetchBestPrice(tradeType: "BUY" | "SELL"): Promise<number | null> {
  const response = await fetch(BINANCE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      asset: "USDC",
      fiat: "VND",
      merchantCheck: true,
      page: 1,
      payTypes: [],
      publisherType: "merchant",
      rows: 20,
      tradeType,
      transAmount: "150000000",
    }),
  });
  const data = await response.json();
  if (!data.data?.length) return null;
  const prices: number[] = data.data.map((item: any) => Number(item.adv.price));
  return tradeType === "BUY" ? Math.min(...prices) : Math.max(...prices);
}

export const handleBinanceP2PRate: RequestHandler = async (_req, res) => {
  const cached = getCache<P2PRate>(CACHE_KEY);
  if (cached) return void res.json(cached);

  try {
    const [bestBuyPrice, bestSellPrice] = await Promise.all([
      fetchBestPrice("BUY"),
      fetchBestPrice("SELL"),
    ]);
    const result: P2PRate = { bestBuyPrice, bestSellPrice };
    setCache(CACHE_KEY, result);
    if (bestBuyPrice !== null) insertSnapshot({ exchange: "binance", trade_type: "buy", asset: "USDC", fiat: "VND", best_price: bestBuyPrice });
    if (bestSellPrice !== null) insertSnapshot({ exchange: "binance", trade_type: "sell", asset: "USDC", fiat: "VND", best_price: bestSellPrice });
    res.json(result);
  } catch {
    res.status(502).json({ error: "Failed to fetch Binance P2P rates" });
  }
};
