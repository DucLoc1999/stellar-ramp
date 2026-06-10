# payment_svc — Secure fiat ↔ USDC backend

Reliable rails for partners to convert VND ↔ USDC using SePay for fiat collection and Stellar for USDC disbursement.

Goals
- Secure, auditable order lifecycle for partner integrations
- Reliable webhook-driven fiat collection (SePay) and resilient disbursement pipeline
- Safe Stellar payouts with an external signer worker and encrypted hot wallet secrets

Tech stack
- Node.js + TypeScript, Fastify 4
- PostgreSQL via Knex 3, Kafka (kafkajs)
- Stellar SDK for USDC, Cloudflare Worker signer
- SePay SDK for payment gateway integration

Delivered features (headline)
- Deposit & withdrawal order flows
- Price engine with spreads and fee audit logs
- SePay IPN handler with deduplication
- Kafka-based disbursement pipeline → Stellar payouts
- Signed, retryable callbacks with logging and replay protection
- Admin endpoints for config and secret rotation

Quickstart (very short)
1. Install: `npm install`
2. Copy env: `cp .env.example .env` and edit required vars
3. Run migrations (Knex requires explicit env):
   `DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... npx tsx node_modules/.bin/knex migrate:latest --knexfile src/knexfile.ts`
4. Start dev server: `npm run dev`
5. Run worker: `npm run worker:disburse`

Important config
See `.env.example` for all variables. Most-critical: `SEPAY_KEY`, `PARTNER_APP_KEY`, `CALLBACK_SIGNATURE_SECRET`, Kafka and Stellar credentials.

Architecture (one line)
Client → Fastify → Services → DB / Kafka → disburseWorker → Cloudflare signer → Stellar

Where to look next
- `src/app.ts` — app factory and routes
- `src/services/` — business logic (orderService, priceService, callbackService)
- `src/workers/disburseWorker.ts` — Kafka consumer for disbursement
- `docs/API_INTEGRATION.md` — integration details for partners

Troubleshooting (quick)
- If disbursements fail: check Kafka connectivity, STELLAR_HOT_WALLET_ENCRYPTION_KEY, and worker logs
- If callbacks fail: verify `CALLBACK_SIGNATURE_SECRET` and inspect `callback_logs`

For full operational details, API examples and schema notes, see `docs/API_INTEGRATION.md` and the `src/` codebase.
