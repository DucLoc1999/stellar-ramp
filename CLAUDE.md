# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Runtime**: Node.js, TypeScript (ES2022, CommonJS output)
- **Web**: Fastify 4
- **DB**: PostgreSQL via Knex 3 (`pg` driver)
- **Payments**: `sepay-pg-node` (SePay sandbox/prod PG integration)
- **Queue**: kafkajs (Kafka)
- **Blockchain**: `@stellar/stellar-sdk` (Stellar network)

## Docker

Production image uses multi-stage build (builder → production). Migration runs in-process on startup via `onReady` hook — no `tsx` required in prod. Entrypoint only handles log dir permissions before handing off to `node dist/server.js`.

## Commands

```bash
npm run dev              # tsx watch — restarts on file changes
npm run build            # tsc → dist/
npm run start            # node dist/server.js
npm run worker:disburse  # Kafka consumer for USDT disbursement
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
| `/admin` | `routes/adminRoutes.ts` | `controllers/adminController.ts` | JWT |
| `/api/rate` | `routes/priceRoutes.ts` | `controllers/priceController.ts` | None |
| `/config` | `routes/configRoutes.ts` | `controllers/configController.ts` | JWT (write) |
| `/api/orders` | `routes/orderRoutes.ts` | `controllers/orderController.ts` | None |
| `/api/webhooks` | `routes/webhookRoutes.ts` | `controllers/webhookController.ts` | Apikey |

**Workers:**
- `src/workers/disburseWorker.ts` — consumes Kafka `DISBURSE_CRYPTO` topic, executes Stellar payment, updates order state

**Layers:**
- `controllers/` — request handlers, delegate to services
- `services/` — business logic
- `models/types.ts` — shared interfaces (OrderState, DepositRequest, etc.)
- `routes/` — Fastify route registration + JSON Schema
- `middlewares/` — errorHandler, sepayAuth, adminAuth

**API docs** served at `/docs` (Swagger UI).

## Data Flow: Deposit (Buy USDT)

1. Client → `POST /api/orders/deposit` with `{ amount, chain_id, token_address, recipient, callback }`
2. `orderService.createDeposit()` → `priceService.getQuote('buy')` → `binanceService` + `configService`
3. Order saved to DB with `payment_status: 'pending'`, `order_state: 1 (CREATED)`. Callback fired.
4. Client receives payment_code (e.g., `USDT247-A3F8B2C1`), checkout URL / QR code / bank info
5. User transfers VND to SePay bank with content = `payment_code`
6. SePay → `POST /api/webhooks/sepay` → `sepayService.handleSepayWebhook()` matches `code`, validates amount
7. `orderService.confirmPayment()` → updates to `payment_received`, `order_state: 2 (PROCESSING)`, emits `DISBURSE_CRYPTO` to Kafka
8. **disburseWorker** consumes Kafka, executes Stellar payment from hot wallet to `recipient`
9. On success: updates `order_state: 3 (COMPLETED)`, emits `ORDER_PAID` to Kafka
10. Callback POSTed to client's `callback` URL

## Data Flow: Withdrawal (Sell USDT)

1. Client → `POST /api/orders/withdrawal` with `{ amount, chain_id, token_address, callback, payment_info }`
2. Order saved with bank details, `order_state: 1 (CREATED)`. Callback fired.
3. External system sends USDT to hot wallet, then calls webhook/updateOrderState
4. On completion: updates `order_state: 3 (COMPLETED)`, processes VND payout (TBD)

## Order States

| State | Name |
|-------|------|
| 1 | CREATED |
| 2 | PROCESSING |
| 3 | COMPLETED |
| 4 | FAILED |
| 5 | CANCELLED |

## Callback Webhooks

When `order_state` changes, POST to client's callback URL:
```json
{
  "id": "order_id",
  "topic": "order.state.change",
  "ts": 1714034400000,
  "payload": {
    "order_id": 1,
    "old_order_state": 1,
    "new_order_state": 2
  }
}
```
Best-effort, 8s timeout.

## Key Services

- `binanceService.ts` — Binance P2P median price, 30s cache
- `configService.ts` — config table cache, fee audit log
- `priceService.ts` — quote calculation with spreads/fees
- `sepayPgService.ts` — SePay checkout session
- `orderService.ts` — deposit/withdrawal creation, confirmPayment, updateOrderState, triggerDisburse
- `queueService.ts` — Kafka producer: emitDisburseCrypto, emitOrderPaid
- `stellarService.ts` — Stellar payment: initStellarServer, loadHotWallet, disburseUSDT
- `encryptionService.ts` — AES-256-GCM encrypt/decrypt for wallet secrets
- `callbackService.ts` — webhook callback to client
- `sepayService.ts` — webhook handler, deduplication

## Key Tables

- `orders` — order records
- `config` — runtime config (spreads, fee rates)
- `webhook_logs` — deduplication
- `fee_audit_log` — fee change audit
- `system_wallets` — encrypted Stellar hot wallet

## DB Singleton

`src/db.ts` — shared Knex instance, pool min:2/max:10. Import as `import db from '../db'`.

## Migrations

`src/migrations/` — numbered `000_` through `007_`. Dual .ts/.js handling in dev/prod via `src/db.ts` migrationSource.

## Env / Secrets

All via `import 'dotenv/config'`. See `.env.example`:

| Variable | Description |
|---|---|
| `SEPAY_KEY` | SePay SDK secret_key |
| `SEPAY_WEBHOOK_API_KEY` | Webhook auth (Apikey header) |
| `SEPAY_ENV` | sandbox/production |
| `KAFKA_BROKERS` | Kafka address:port |
| `KAFKA_CLIENT_ID` | Kafka client ID |
| `KAFKA_DISBURSE_TOPIC` | Default: disburse_crypto |
| `KAFKA_ORDER_PAID_TOPIC` | Default: order_paid |
| `STELLAR_NETWORK` | testnet/public |
| `STELLAR_HOT_WALLET_NAME` | Default: stellar_hot_wallet |
| `STELLAR_HOT_WALLET_ENCRYPTION_KEY` | 32+ char key for AES-256-GCM |

## Payment Code

`USDT247-<8-char>` — unique order identifier. Used as SePay transfer description.

## tsconfig

`module: "ES2022"` + `moduleResolution: "Bundler"`. Build output to `dist/`. `package.json` must have `"type": "commonjs"`.