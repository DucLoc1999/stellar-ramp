import { RequestHandler } from "express";
import { P2PRate } from "../../shared/api";
import { getCache, setCache } from "../cache";
import { insertSnapshot } from "../db";

const CACHE_KEY = "okx-p2p-rate";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
};

async function fetchBestPrice(side: "buy" | "sell"): Promise<number | null> {
  const url = new URL("https://www.okx.com/v3/c2c/tradingOrders/books");
  url.searchParams.append("quoteCurrency", "VND");
  url.searchParams.append("baseCurrency", "USDC");
  // OKX "side" is the merchant's perspective: "sell" = merchant sells USDC = user buys USDC
  url.searchParams.append("side", side === "buy" ? "sell" : "buy");
  url.searchParams.append("paymentMethod", "all");
  url.searchParams.append("userType", "certified");

  const response = await fetch(url.toString(), { headers: BROWSER_HEADERS });
  const json = await response.json();
  const okxSide = side === "buy" ? "sell" : "buy";
  if (json.code !== 0 || !json.data[okxSide]?.length) return null;
  const ads: any[] = json.data[okxSide].filter((ad: any) => parseFloat(ad.availableAmount) > 1000);
  if (!ads.length) return null;
  const prices = ads.map((ad: any) => parseFloat(ad.price));
  return side === "buy" ? Math.max(...prices) : Math.min(...prices);
}

export const handleOKXP2PRate: RequestHandler = async (_req, res) => {
  const cached = getCache<P2PRate>(CACHE_KEY);
  if (cached) return void res.json(cached);

  try {
    const [bestBuyPrice, bestSellPrice] = await Promise.all([
      fetchBestPrice("buy"),
      fetchBestPrice("sell"),
    ]);
    const result: P2PRate = { bestBuyPrice, bestSellPrice };
    setCache(CACHE_KEY, result);
    if (bestBuyPrice !== null) insertSnapshot({ exchange: "okx", trade_type: "buy", asset: "USDC", fiat: "VND", best_price: bestBuyPrice });
    if (bestSellPrice !== null) insertSnapshot({ exchange: "okx", trade_type: "sell", asset: "USDC", fiat: "VND", best_price: bestSellPrice });
    res.json(result);
  } catch {
    res.status(502).json({ error: "Failed to fetch OKX P2P rates" });
  }
};
