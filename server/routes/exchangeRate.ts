import { RequestHandler } from "express";
import { readFileSync } from "fs";
import { resolve } from "path";
import { getLatestBinancePrice, insertSnapshot } from "../db";

const CONFIG_PATH = resolve("config.json");

function readSpreads(): { buySpread: number; sellSpread: number } {
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    return {
      buySpread: Number(config.buySpread) || 1,
      sellSpread: Number(config.sellSpread) || 1,
    };
  } catch {
    return { buySpread: 1, sellSpread: 1 };
  }
}

export const handleExchangeRate: RequestHandler = (_req, res) => {
  const buyPrice = getLatestBinancePrice("buy");
  const sellPrice = getLatestBinancePrice("sell");

  if (buyPrice === null || sellPrice === null) {
    return void res.status(503).json({ error: "No price data available yet" });
  }

  const { buySpread, sellSpread } = readSpreads();
  const buy = Math.round(buyPrice * buySpread);
  const sell = Math.round(sellPrice * sellSpread);

  insertSnapshot({ exchange: "our", trade_type: "buy", asset: "USDC", fiat: "VND", best_price: buy });
  insertSnapshot({ exchange: "our", trade_type: "sell", asset: "USDC", fiat: "VND", best_price: sell });

  res.json({ buy, sell, buySpread, sellSpread, created_at: new Date().toISOString() });
};
