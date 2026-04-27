import { RequestHandler } from "express";
import { getHistory, Exchange } from "../db";

function historyHandler(exchange: Exchange): RequestHandler {
  return (req, res) => {
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
    const rows = getHistory(exchange, days);
    res.json(rows);
  };
}

export const handleBinanceP2PHistory = historyHandler("binance");
export const handleOKXP2PHistory = historyHandler("okx");
export const handleBybitP2PHistory = historyHandler("bybit");
export const handleOurPriceHistory = historyHandler("our");
export const handleStellarXlmHistory = historyHandler("stellar");
