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
| `/api/orders` | `routes/orderRoutes.ts` | `controllers/orderController.ts` | **Partner-App-Key** |
| `/api/webhooks` | `routes/webhookRoutes.ts` | `controllers/webhookController.ts` | Apikey / Webhook signature |

**Workers:**
- `src/workers/disburseWorker.ts` — consumes Kafka `DISBURSE_CRYPTO` topic, executes Stellar payment, updates order state

**Layers:**
- `controllers/` — request handlers, delegate to services
- `services/` — business logic
- `models/types.ts` — shared interfaces (OrderState, DepositRequest, etc.)
- `routes/` — Fastify route registration + JSON Schema
- `middlewares/` — errorHandler, sepayAuth, adminAuth, partnerAuth, chainWebhookAuth

**API docs** served at `/docs` (Swagger UI).

## Authentication

### Client → Service (Partner-App-Key)
All order endpoints require `Partner-App-Key` header:
- `POST /api/orders/deposit`
- `POST /api/orders/withdrawal`
- `GET /api/orders/:payment_code`
- `POST /api/orders/:payment_code/cancel`

### Provider → Service Webhooks
- **SePay**: `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>`
- **Chain**: `X-Webhook-Signature` + `X-Webhook-Timestamp` (HMAC-SHA256)

### Callback to Client
Service signs callbacks with `X-Timestamp` + `X-Signature` (HMAC-SHA256). Client verifies.

## Data Flow: Deposit (Buy USDT)

1. Client → `POST /api/orders/deposit` with `{ amount, chain_id, token_address, recipient, callback }`
2. `orderService.createDeposit()` → `priceService.getQuote('buy')` → `binanceService` + `configService`
3. Order saved to DB with `payment_status: 'pending'`, `order_state: 1 (CREATED)`. Callback fired (with retry + signature).
4. Client receives payment_code (e.g., `USDT247-A3F8B2C1`), checkout URL / QR code / bank info
5. User transfers VND to SePay bank with content = `payment_code`
6. SePay → `POST /api/webhooks/sepay` → `sepayService.handleSepayWebhook()` matches `code`, validates amount
7. `orderService.confirmPayment()` → updates to `payment_received`, `order_state: 2 (PROCESSING)`, emits `DISBURSE_CRYPTO` to Kafka
8. **disburseWorker** consumes Kafka, executes Stellar payment from hot wallet to `recipient`
9. On success: updates `order_state: 3 (COMPLETED)`, emits `ORDER_PAID` to Kafka
10. Callback POSTed to client's `callback` URL (with HMAC signature, retry up to 3×)

## Data Flow: Withdrawal (Sell USDT)

1. Client → `POST /api/orders/withdrawal` with `{ amount, chain_id, token_address, callback, payment_info }`
2. Order saved with bank details, `order_state: 1 (CREATED)`. Callback fired.
3. External system sends USDT to hot wallet
4. External system → `POST /api/webhooks/chain` with tx confirmation
5. `orderService.handleChainEvent()` validates address/amount, updates to `order_state: 2 (PROCESSING)`
6. VND payout executed (stub), updates to `order_state: 3 (COMPLETED)`
7. Callback POSTed to client's `callback` URL

## Order States

| State | Name |
|---|---|
| 1 | CREATED |
| 2 | PROCESSING |
| 3 | COMPLETED |
| 4 | FAILED |
| 5 | CANCELLED |

**State Transitions:**
- `CREATED(1) → PROCESSING(2) → COMPLETED(3)`
- `CREATED(1) → PROCESSING(2) → FAILED(4)`
- `CREATED(1) → CANCELLED(5)`
- `PROCESSING(2) → CANCELLED(5)` (only if no irreversible step: no sepay_transaction_id)

## Callback Webhooks

When `order_state` changes, POST to client's callback URL with HMAC signature:

**Headers:**
```
Content-Type: application/json
X-Timestamp: <unix-ms>
X-Signature: HMAC-SHA256(secret, timestamp + "." + body)
```

**Body:**
```json
{
  "id": "1",
  "topic": "order.state.change",
  "ts": "2026-04-24T10:00:00.000Z",
  "payload": {
    "order_id": "1",
    "old_order_state": 1,
    "new_order_state": 2
  }
}
```

**Features:**
- Retry: 3 attempts with 5s delay between attempts
- Logging: all attempts logged to `callback_logs` table
- Signature: HMAC-SHA256 with dual-secret support (rotation window)
- Replay protection: 5-minute window

## Error Response Schema

All errors return standardized format with `X-Trace-ID` header:

```json
{
  "success": false,
  "error": {
    "code": "MACHINE_CODE",
    "message": "Human-readable message",
    "retriable": true,
    "trace_id": "req-123"
  }
}
```

**Error codes**: ORDER_NOT_FOUND, INVALID_AMOUNT, CANCEL_NOT_ALLOWED, VALIDATION_ERROR, UNAUTHORIZED, AUTH_NOT_CONFIGURED, INTERNAL_ERROR, CHAIN_EVENT_MISMATCH

## Key Services

- `binanceService.ts` — Binance P2P median price, 30s cache
- `configService.ts` — config table cache, fee audit log
- `priceService.ts` — quote calculation with spreads/fees
- `sepayPgService.ts` — SePay checkout session
- `orderService.ts` — deposit/withdrawal creation, confirmPayment, cancelOrder, handleChainEvent, formatOrderResponse
- `queueService.ts` — Kafka producer: emitDisburseCrypto, emitOrderPaid
- `stellarService.ts` — Stellar payment: initStellarServer, loadHotWallet, disburseUSDT
- `encryptionService.ts` — AES-256-GCM encrypt/decrypt for wallet secrets
- `callbackService.ts` — webhook callback with retry (3×), logging, HMAC signature, dual-secret rotation
- `sepayService.ts` — webhook handler, deduplication

## Key Tables

- `orders` — order records (includes `cancelled_at`, `cancel_reason` for Plan 2)
- `config` — runtime config (spreads, fee rates, callback secrets for rotation)
- `webhook_logs` — deduplication
- `callback_logs` — callback attempt logging (Plan 2)
- `fee_audit_log` — fee change audit
- `system_wallets` — encrypted Stellar hot wallet
- `admins` — admin users for JWT auth

## DB Singleton

`src/db.ts` — shared Knex instance, pool min:2/max:10. Import as `import db from '../db'`.

## Migrations

`src/migrations/` — numbered `000_` through `009_`. Dual .ts/.js handling in dev/prod via `src/db.ts` migrationSource.

- `008_create_callback_logs.ts` — callback attempt logging
- `009_add_cancel_fields.ts` — cancel order support

## Env / Secrets

All via `import 'dotenv/config'`. See `.env.example`:

| Variable | Description |
|---|---|
| `SEPAY_KEY` | SePay SDK secret_key |
| `SEPAY_WEBHOOK_API_KEY` | Webhook auth (Apikey header) |
| `SEPAY_ENV` | sandbox/production |
| `PARTNER_APP_KEY` | Client → Service auth header |
| `CALLBACK_TIMEOUT_MS` | Callback HTTP timeout (default 8000) |
| `CALLBACK_RETRY_COUNT` | Callback retry attempts (default 3) |
| `CALLBACK_RETRY_DELAY_MS` | Callback retry delay (default 5000) |
| `CALLBACK_SIGNATURE_SECRET` | HMAC secret for callback signing |
| `CHAIN_WEBHOOK_SECRET` | HMAC secret for chain webhook |
| `KAFKA_BROKERS` | Kafka address:port |
| `KAFKA_CLIENT_ID` | Kafka client ID |
| `KAFKA_DISBURSE_TOPIC` | Default: disburse_crypto |
| `KAFKA_ORDER_PAID_TOPIC` | Default: order_paid |
| `STELLAR_NETWORK` | testnet/public |
| `STELLAR_HOT_WALLET_NAME` | Default: stellar_hot_wallet |
| `STELLAR_HOT_WALLET_ENCRYPTION_KEY` | 32+ char key for AES-256-GCM |
| `ADMIN_JWT_SECRET` | JWT signing secret for admin routes |

## Payment Code

`USDT247-<8-char>` — unique order identifier. Used as SePay transfer description.

## tsconfig

`module: "ES2022"` + `moduleResolution: "Bundler"`. Build output to `dist/`. `package.json` must have `"type": "commonjs"`.

## Admin Endpoints

- `POST /admin/login` — JWT login
- `GET /admin/stats` — order statistics (JWT required)
- `PATCH /admin/callback-secret` — rotate callback HMAC secret (JWT required)

## Integration

See `docs/API_INTEGRATION.md` for full API documentation including:
- All endpoints with request/response examples
- Authentication details
- Callback signature verification code
- Error codes
- Complete flow diagrams