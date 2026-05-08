import { RequestHandler } from "express";
import { insertSnapshot } from "../db";

const RATE_API_URL = "https://payment-api.dev.seerbot.io/api/rate/usdt_vnd";

export const handleExchangeRate: RequestHandler = async (_req, res) => {
  let data: { created_at: string; buy: number; sell: number; fee_rate_buy: number; fee_rate_sell: number };

  try {
    const response = await fetch(RATE_API_URL, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`API responded with ${response.status}`);
    data = await response.json();
  } catch (err) {
    return void res.status(503).json({ error: "Failed to fetch rate data" });
  }

  const { buy, sell, fee_rate_buy, fee_rate_sell, created_at } = data;

  insertSnapshot({ exchange: "our", trade_type: "buy", asset: "USDC", fiat: "VND", best_price: buy });
  insertSnapshot({ exchange: "our", trade_type: "sell", asset: "USDC", fiat: "VND", best_price: sell });

  res.json({ buy, sell, fee_rate_buy, fee_rate_sell, created_at });
};
