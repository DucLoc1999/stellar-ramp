import "dotenv/config";
import express from "express";
import cors from "cors";

const BASE_URL = process.env.VITE_BASE_URL || "http://localhost:3001";

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/ping", (_req, res) => {
    res.json({ message: process.env.PING_MESSAGE ?? "ping" });
  });

  app.get("/api/p2p-rates", async (_req, res) => {
    try {
      const response = await fetch(`${BASE_URL}/landing/p2p-rates`);
      if (!response.ok) throw new Error(`Upstream ${response.status}`);
      const data = await response.json();
      res.json(data);
    } catch {
      res.status(502).json({ error: "Failed to fetch rates from upstream" });
    }
  });

  app.get("/api/p2p-history", async (req, res) => {
    try {
      const days = req.query.days || "7";
      const response = await fetch(`${BASE_URL}/landing/p2p-history?days=${days}`);
      if (!response.ok) throw new Error(`Upstream ${response.status}`);
      const data = await response.json();
      res.json(data);
    } catch {
      res.status(502).json({ error: "Failed to fetch history from upstream" });
    }
  });

  return app;
}
