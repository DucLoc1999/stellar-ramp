import { RequestHandler } from "express";
import { P2PRate } from "../../shared/api";
import { getCache, setCache } from "../cache";
import { insertSnapshot } from "../db";

const CACHE_KEY = "bybit-p2p-rate";

const BROWSER_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
};

async function fetchBestPrice(isBuying: boolean): Promise<number | null> {
  const response = await fetch("https://api2.bybit.com/fiat/otc/item/online", {
    method: "POST",
    headers: BROWSER_HEADERS,
    body: JSON.stringify({
      tokenId: "USDC",
      currencyId: "VND",
      side: isBuying ? "1" : "0",
      size: "10",
      page: "1",
      amount: "",
      authMaker: true,
      canTrade: false,
    }),
  });
  const json = await response.json();
  if (json.ret_code !== 0 || !json.result?.items?.length) return null;
  return Number(json.result.items[0].price);
}

export const handleBybitP2PRate: RequestHandler = async (_req, res) => {
  const cached = getCache<P2PRate>(CACHE_KEY);
  if (cached) return void res.json(cached);

  try {
    const [bestBuyPrice, bestSellPrice] = await Promise.all([
      fetchBestPrice(true),
      fetchBestPrice(false),
    ]);
    const result: P2PRate = { bestBuyPrice, bestSellPrice };
    setCache(CACHE_KEY, result);
    if (bestBuyPrice !== null) insertSnapshot({ exchange: "bybit", trade_type: "buy", asset: "USDC", fiat: "VND", best_price: bestBuyPrice });
    if (bestSellPrice !== null) insertSnapshot({ exchange: "bybit", trade_type: "sell", asset: "USDC", fiat: "VND", best_price: bestSellPrice });
    res.json(result);
  } catch {
    res.status(502).json({ error: "Failed to fetch Bybit P2P rates" });
  }
};
