# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Runtime**: Node.js, TypeScript (ES2022, CommonJS output)
- **Web**: Fastify 4
- **DB**: PostgreSQL via Knex 3 (`pg` driver)
- **Payments**: `sepay-pg-node` (SePay sandbox/prod PG integration)

## Docker

Production image uses multi-stage build (builder → production). Migration runs in-process on startup via `onReady` hook — no `tsx` required in prod. Entrypoint only handles log dir permissions before handing off to `node dist/server.js`.

## Commands

```bash
npm run dev              # tsx watch — restarts on file changes
npm run build            # tsc → dist/
npm run start            # node dist/server.js
npm run migrate          # knex migrate:latest --knexfile src/knexfile.ts
npm run migrate:rollback # knex migrate:rollback --knexfile src/knexfile.ts
npx tsc --noEmit         # type-check without emitting
```

Migrations require explicit env vars (Knex doesn't auto-load dotenv):
```bash
DB_HOST=127.0.0.1 DB_USER=admin DB_PASSWORD=123456 DB_NAME=payment_svc \
  npx tsx node_modules/.bin/knex migrate:latest --knexfile src/knexfile.ts
```

`./start-prod.sh` handles migrate + build + start in one step.

No lint, test, or format scripts are configured.

## Architecture

**Entrypoint** `src/server.ts` — slim startup. Imports `buildApp()` from `./app`.

**App factory** `src/app.ts` — builds Fastify instance, registers plugins in order: cors → swagger → swaggerUi → errorHandler → routes:

| Prefix | Route File | Handler File | Auth |
|---|---|---|---|
| `/api/rate` | `routes/priceRoutes.ts` | `controllers/priceController.ts` | None |
| `/config` | `routes/configRoutes.ts` | `controllers/configController.ts` | None |
| `/api/orders` | `routes/orderRoutes.ts` | `controllers/orderController.ts` | None |
| `/api/webhooks` | `routes/webhookRoutes.ts` | `controllers/webhookController.ts` | Apikey |

**Layers:**
- `controllers/` — request handlers, delegate to services
- `services/` — business logic (unchanged)
- `models/types.ts` — shared interfaces (OrderState, DepositRequest, etc.)
- `routes/` — Fastify route registration + JSON Schema
- `middlewares/` — errorHandler, sepayAuth

**API docs** served at `/docs` (Swagger UI).

**Data flow for a deposit (buy USDT):**
1. Client hits `POST /api/orders/deposit` with `{ amount, chain_id, token_address, recipient, callback }`
2. `orderService.createDeposit()` → `priceService.getQuote('buy')` → `binanceService` (Binance P2P, 30 s cache) + `configService` (spread/fee from DB)
3. `orderService` → `sepayPgService.createCheckoutSession()` → SePay SDK returns `checkout_url` + `form_fields`
4. Order saved to DB with `payment_status: 'pending'`, `order_state: 1 (CREATED)`. Callback fired.
5. Client receives checkout URL / QR code / bank info. Can also poll `GET /api/orders/:payment_code`.
6. SePay detects bank deposit → fires `POST /api/webhooks/sepay` → `sepayService.handleSepayWebhook()` matches `code` to `payment_code`, deduplicates via `webhook_logs`, validates `transferAmount >= net_vnd`, sets `payment_received` + `order_state: 2 (PROCESSING)`. Callback fired to client's `callback` URL.
7. External system handles actual USDT transfer and updates order state to COMPLETED via `updateOrderState()`.

**Data flow for a withdrawal (sell USDT):**
1. Client hits `POST /api/orders/withdrawal` with `{ amount, chain_id, token_address, callback, payment_info }` — saves order with bank details, `order_state: 1 (CREATED)`. Full processing logic TBD.

**Order states:** 1=Created, 2=Processing, 3=Completed, 4=Failed, 5=Cancelled

**Callback webhooks:** When `order_state` changes, the service POSTs `{ id, topic: "order.state.change", ts, payload: { order_id, old_order_state, new_order_state } }` to the order's `callback` URL (best-effort, 8 s timeout).

**Key services:**
- `binanceService.ts` — fetches median of top-5 Binance P2P listings (BUY + SELL sides separately), 30 s in-memory TTL cache, returns stale on failure
- `configService.ts` — reads `config` table into a `Map` cache; `updateConfig()` writes through to DB and cache; logs `fee_rate_*` changes to `fee_audit_log`
- `priceService.ts` — combines binance prices + spreads into buy/sell rates; computes full quotes with fees
- `sepayPgService.ts` — thin wrapper around `SePayPgClient`; `createCheckoutSession()` calls `initCheckoutUrl()` + `initOneTimePaymentFields()`
- `orderService.ts` — `createDeposit()` (buy USDT: quote + SePay checkout + save), `createWithdrawal()` (sell USDT: quote + save, logic TBD), `confirmPayment()` (marks `payment_received`, transitions to PROCESSING state, fires callback), `updateOrderState()` (generic state transition + callback)
- `callbackService.ts` — `fireCallback(url, orderId, oldState, newState)` — best-effort POST to client's callback URL with order state change event
- `sepayService.ts` — webhook handler: deduplicates via `webhook_logs` table, filters `transferType === 'in'`, matches `code` to `payment_code`, validates `transferAmount >= net_vnd`, calls `confirmPayment()`

**DB singleton**: `src/db.ts` — shared Knex instance, pool min:2/max:10. Import as `import db from '../db'`.

**Migrations**: `src/migrations/` numbered `000_` through `005_`. Knex config in `src/knexfile.ts` (dual-export: `export default` + `module.exports` for CLI compatibility). In production, migrations run automatically via `db.migrate.latest()` in the Fastify `onReady` hook — no separate migration step needed. A custom `migrationSource` in `src/db.ts` maps `.ts` names (stored in DB) to compiled `.js` files in `dist/migrations/`.

## Env / Secrets

All env vars loaded via `import 'dotenv/config'` in `src/server.ts` (via app.ts). See `.env.example` for the full list. Critical:

- `SEPAY_KEY` — used by `sepayPgService` (SDK `secret_key`) for creating checkout sessions.
- `SEPAY_WEBHOOK_API_KEY` — used by `sepayAuth` middleware to validate the `Authorization: Apikey` header on incoming webhooks. If unset, all webhook requests return 401.
- `SEPAY_ENV` — `sandbox` (default) or `production`.

## Config Table

Runtime-tunable values stored in the `config` DB table (key/value strings):

| Key | Default | Effect |
|---|---|---|
| `spread_buy` | `50` | VND added to Binance mid for buy rate |
| `spread_sell` | `50` | VND subtracted from Binance mid for sell rate |
| `fee_rate_buy` | `0.008` | 0.8% fee on buy orders |
| `fee_rate_sell` | `0.008` | 0.8% fee on sell orders |

Public endpoint `GET /config/fees` reads these. Changes to `fee_rate_*` are automatically logged to `fee_audit_log`.

## Payment Code

Orders use `USDT247-<8-char-alphanumeric>` as unique identifier (stored as `payment_code`). This is also the `order_invoice_number` sent to SePay SDK, and what SePay echoes back in the webhook `code` field (auto-detected from transfer description).

## tsconfig Notes

`module: "ES2022"` + `moduleResolution: "Bundler"` — required for top-level `await` in `src/server.ts` to type-check. `tsx` handles this at runtime regardless. Build output goes to `dist/`.

## Notes

- `package.json` must have `"type": "commonjs"` for Node to load `dist/` as CJS.
