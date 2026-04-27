import path from "path";
import { createServer } from "./index";
import * as express from "express";

const app = createServer();
const port = process.env.PORT || 3000;

const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../dist");

app.use(express.static(distPath));

app.get("*splat", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`🚀 Stellar Ramp server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});

process.on("SIGTERM", () => { console.log("🛑 SIGTERM received"); process.exit(0); });
process.on("SIGINT",  () => { console.log("🛑 SIGINT received");  process.exit(0); });
