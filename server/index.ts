import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleBinanceP2PRate } from "./routes/binanceP2P";
import { handleOKXP2PRate } from "./routes/okxP2P";
import { handleBybitP2PRate } from "./routes/bybitP2P";
import { handleBinanceP2PHistory, handleOKXP2PHistory, handleBybitP2PHistory, handleOurPriceHistory } from "./routes/p2pHistory";
import { handleExchangeRate } from "./routes/exchangeRate";

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/ping", (_req, res) => {
    res.json({ message: process.env.PING_MESSAGE ?? "ping" });
  });

  app.get("/api/exchange-rate", handleExchangeRate);
  app.get("/api/binance-p2p-rate", handleBinanceP2PRate);
  app.get("/api/okx-p2p-rate", handleOKXP2PRate);
  app.get("/api/bybit-p2p-rate", handleBybitP2PRate);
  app.get("/api/our-price-history", handleOurPriceHistory);
  app.get("/api/binance-p2p-history", handleBinanceP2PHistory);
  app.get("/api/okx-p2p-history", handleOKXP2PHistory);
  app.get("/api/bybit-p2p-history", handleBybitP2PHistory);

  return app;
}
