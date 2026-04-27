import { RequestHandler } from "express";
import { readFileSync } from "fs";
import { resolve } from "path";
import axios from "axios";
import { getCache, setCache } from "../cache";
import { insertSnapshot } from "../db";
import { ExchangeRatesResponse } from "../../shared/api";

const CACHE_KEY = "xlm-exchange-rate";
const CONFIG_PATH = resolve("config.json");
const CG_URL = "https://api.coingecko.com/api/v3/simple/price";

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

async function fetchXlmVnd(): Promise<{ buy: number; sell: number } | null> {
  const apiKey = process.env.CG_API_KEY;
  if (!apiKey) throw new Error("CG_API_KEY is not set");

  const response = await axios.get(CG_URL, {
    params: { ids: "stellar", vs_currencies: "vnd" },
    headers: { "x-cg-demo-api-key": apiKey },
  });

  const spotVnd: number | undefined = response.data?.stellar?.vnd;
  if (!spotVnd) return null;

  const { buySpread, sellSpread } = readSpreads();
  return {
    buy: Math.round(spotVnd * buySpread),
    sell: Math.round(spotVnd * sellSpread),
  };
}

export const handleXlmExchangeRate: RequestHandler = async (_req, res) => {
  const cached = getCache<ExchangeRatesResponse>(CACHE_KEY);
  if (cached) return void res.json(cached);

  try {
    const prices = await fetchXlmVnd();
    if (!prices) {
      return void res.status(503).json({ error: "Failed to derive XLM/VND price" });
    }
    const result: ExchangeRatesResponse = {
      ...prices,
      created_at: new Date().toISOString(),
    };
    setCache(CACHE_KEY, result);
    insertSnapshot({ exchange: "stellar", trade_type: "buy",  asset: "XLM", fiat: "VND", best_price: prices.buy });
    insertSnapshot({ exchange: "stellar", trade_type: "sell", asset: "XLM", fiat: "VND", best_price: prices.sell });
    res.json(result);
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 429) {
        return void res.status(429).json({ error: "CoinGecko rate limit exceeded" });
      }
      return void res.status(502).json({ error: "CoinGecko API error", detail: err.response?.data });
    }
    res.status(500).json({ error: err?.message ?? "Failed to fetch XLM exchange rate" });
  }
};
