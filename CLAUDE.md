# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Runtime**: Node.js, TypeScript (ES2022, CommonJS output)
- **Web**: Fastify 4
- **DB**: MySQL via Knex 3 (`mysql2` driver)
- **Payments**: `sepay-pg-node` (SePay sandbox/prod PG integration)

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

**Entrypoint** `src/server.ts` — top-level `await` (ES2022 module). Registers plugins in order: cors → swagger → swaggerUi → 4 route prefixes:

| Prefix | File | Auth |
|---|---|---|
| `/api/price` | `priceRoutes.ts` | None |
| `/config` | `adminRoutes.ts` | `X-Admin-Key` header |
| `/api/orders` | `orderRoutes.ts` | None |
| `/api/webhooks` | `sepayWebhookRoutes.ts` | `X-Secret-Key` header |

**API docs** served at `/docs` (Swagger UI).

**Data flow for a buy order:**
1. Caller hits `POST /api/orders/checkout` with `{ usdt_amount }`
2. `orderService` → `priceService.getQuote()` → `binanceService` (Binance P2P, 30 s cache) + `configService` (spread/fee from DB)
3. `orderService` → `sepayPgService.createCheckoutSession()` → SePay SDK returns `checkout_url` + `form_fields`
4. Order saved to DB with `payment_status: 'pending'`
5. Caller polls `GET /api/orders/:payment_code` until `payment_status` changes
6. SePay fires `POST /api/webhooks/sepay` IPN → `sepayService.handleSepayIpn()` matches by `order.order_invoice_number`, sets `payment_received`

**Key services:**
- `binanceService.ts` — fetches median of top-5 Binance P2P listings (BUY + SELL sides separately), 30 s in-memory TTL cache, returns stale on failure
- `configService.ts` — reads `config` table into a `Map` cache; `updateConfig()` writes through to DB and cache; logs `fee_rate_*` changes to `fee_audit_log`
- `priceService.ts` — combines binance prices + spreads into buy/sell rates; computes full quotes with fees
- `sepayPgService.ts` — thin wrapper around `SePayPgClient`; `createCheckoutSession()` calls `initCheckoutUrl()` + `initOneTimePaymentFields()`
- `sepayService.ts` — IPN handler: validates `notification_type === 'ORDER_PAID'` + `order_status === 'CAPTURED'` + `transaction_status === 'APPROVED'`

**DB singleton**: `src/db.ts` — shared Knex instance, pool min:2/max:10. Import as `import db from '../db'`.

**Migrations**: `src/migrations/` numbered `001_`, `002_`, `003_`. Knex config in `src/knexfile.ts` (dual-export: `export default` + `module.exports` for CLI compatibility).

## Env / Secrets

All env vars loaded via `import 'dotenv/config'` in `src/server.ts`. See `.env.example` for the full list. Critical:

- `SEPAY_KEY` — used by both `sepayPgService` (SDK `secret_key`) and `sepayAuth` middleware (`X-Secret-Key` header validation). If unset, all webhook requests return 401.
- `ADMIN_API_KEY` — guards all `/config/*` routes.
- `SEPAY_ENV` — `sandbox` (default) or `production`.

## Config Table

Runtime-tunable values stored in the `config` DB table (key/value strings):

| Key | Default | Effect |
|---|---|---|
| `spread_buy` | `50` | VND added to Binance mid for buy rate |
| `spread_sell` | `50` | VND subtracted from Binance mid for sell rate |
| `fee_rate_buy` | `0.008` | 0.8% fee on buy orders |
| `fee_rate_sell` | `0.008` | 0.8% fee on sell orders |

Admin endpoint `GET /config/fees` reads these. Changes to `fee_rate_*` are automatically logged to `fee_audit_log`.

## Payment Code

Orders use `USDT247-<8-char-alphanumeric>` as unique identifier (stored as `payment_code`). This is also the `order_invoice_number` sent to SePay, and what SePay echoes back in the IPN `order.order_invoice_number` field.

## tsconfig Notes

`module: "ES2022"` + `moduleResolution: "Bundler"` — required for top-level `await` in `src/server.ts` to type-check. `tsx` handles this at runtime regardless. Build output goes to `dist/`.

## Notes

- `package.json` must have `"type": "commonjs"` for Node to load `dist/` as CJS.
