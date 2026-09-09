# payment_svc — Seamless fiat ↔ USDC rails

> The frictionless bridge that turns Vietnamese Dong into USDC and back — quietly, reliably, and securely.

`payment_svc` is a backend for partner integrations to move between fiat (VND) and crypto (USDC/XLM). It quotes live prices, collects payments through Vietnamese banks via SePay, and settles on the Stellar network — without forcing partners to reinvent payment infrastructure.

## 🎯 Philosophy

Financial integrations live or die on **trust, traceability, and uptime**. So `payment_svc` is built around three commitments:

1. **Secure by architecture** — hot-wallet secrets never sit in the API process; Stellar transactions are signed in-process via GCP Cloud KMS Ed25519 (ADC-backed), so private keys never touch the application.
2. **Predictable by design** — every state change is observable, audited, and delivered to you through signed webhooks.
3. **Resilient by default** — a durable Kafka pipeline absorbs failures and retries until settlement succeeds.

## 🧱 Architecture

### The Conversion Pipeline

```
Partner (Partner-App-Key)
        │ deposit / withdrawal orders
        ▼
   Fastify API ──► Services ──► PostgreSQL / Kafka
                                        │
                                        ▼
                            disburseWorker ──► GCP Cloud KMS signer ──► Stellar
                                        ▲
            Stellar Listener ──► Kafka / HTTP
```

### Components

| Component | Role |
|---|---|
| **Fastify API** | Order lifecycle, quoting, webhook handling, admin |
| **PostgreSQL / Kafka** | Durability for orders and the disbursement queue |
| **disburseWorker** | Consumes Kafka, executes payments via the signer |
| **GCP Cloud KMS** | Signs + submits Stellar txs in-process; private keys never touch the app |
| **Stellar Listener** | Watches incoming token payments, forwards via Kafka or HTTP |

## ✨ Key Features

### 1. Live Price Engine
Buy/sell quotes built on Binance P2P median, with configurable spreads, per-token fees, minimum fees, and an audit trail for every fee change.

### 2. Bank-Payment Collection
SePay integration for Vietnamese bank transfers (QiR) plus NAPAS card/e-wallet checkout — each order gets a unique `payment_code` embedded in the transfer description.

### 3. Resumable Disbursement
Confirmed fiat payments are enqueued on Kafka and executed on Stellar by a dedicated worker; transactions are signed in-process via GCP Cloud KMS, keeping secrets outside the API process.

### 4. Signed, Replay-Safe Callbacks
Every order state change is POSTed to your URL, HMAC-signed, retried (up to 3×), logged, and protected against replay within a 5-minute window.

### 5. Full Admin & CMS
Operate config, secret rotation, statistics, partners, and KYC users through admin routes — with a JWT-secured control plane.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 22+
- **PostgreSQL**
- **Kafka** (for the disbursement pipeline)

### Installation

```bash
npm install
cp .env.example .env
```

Fill in the required credentials (SePay, DB, Kafka, Stellar, callback secret) inside `.env`.

Stellar signing is done in-process via GCP Cloud KMS Ed25519 (ADC auth; requires `GCP_KMS_*` vars + `STELLAR_HOT_WALLET_PUBLIC_KEY`).

### Database Migrations

Knex needs explicit env vars (it doesn't auto-load `.env`):

```bash
DB_HOST=127.0.0.1 DB_USER=admin DB_PASSWORD=123456 DB_NAME=payment_svc \
  npx tsx node_modules/.bin/knex migrate:latest --knexfile src/knexfile.ts
```

### Run

```bash
npm run dev              # API server
npm run worker:disburse  # Kafka consumer → Stellar payouts
```

## 💵 Usage / Data Flows

### Deposit (Buy USDC)

```
Partner → deposit order (amount, asset, recipient, callback)
   → quote + save order (CREATED) → return payment_code
   → user transfers VND (content = payment_code)
   → SePay webhook confirms + validates amount
   → order PROCESSING → Kafka DISBURSE_CRYPTO
   → signer (GCP Cloud KMS) sends USDC via Stellar
   → order COMPLETED → signed callback to partner
```

### Withdrawal (Sell USDC)

```
Partner → withdrawal order (amount, asset, callback, bank info)
   → save order (CREATED) → callback
   → incoming USDC hits hot wallet (listener/webhook confirms)
   → order PROCESSING → VND payout
   → order COMPLETED → signed callback to partner
```

## 📡 API Overview

| Prefix | Purpose | Auth |
|---|---|---|
| `/api/orders` | Deposit / withdrawal / status / cancel | Partner-App-Key |
| `/api/rate` | Live buy & sell rates | Partner-App-Key |
| `/api/users` | KYC + payment methods | Partner-App-Key |
| `/api/webhooks` | SePay, SePay IPN, Stellar incoming | API key / signature |
| `/config` | Fee & spread config | JWT (write) |
| `/admin` | Login, stats, secret rotation | JWT |
| `/cms` | Admin management, orders, partners | JWT |
| `/landing` | Public rates & history | None |

Full request/response examples live in [`docs/API_INTEGRATION.md`](docs/API_INTEGRATION.md). Interactive docs at `/docs` (Swagger UI).

## 🧭 Order Lifecycle

| State | Code | Meaning |
|---|---|---|
| CREATED | 1 | Awaiting payment |
| PROCESSING | 2 | Payment confirmed, processing |
| COMPLETED | 3 | Finished successfully |
| FAILED | 4 | Failed |
| CANCELLED | 5 | Cancelled |

```
CREATED → PROCESSING → COMPLETED
CREATED → PROCESSING → FAILED
CREATED → CANCELLED
PROCESSING → CANCELLED   (only if no irreversible step)
```

## 🔐 Authentication

| Direction | Method |
|---|---|
| Client → Service (orders) | `Partner-App-Key` header |
| Provider → Service (webhooks) | SePay API key / Stellar bearer / HMAC signature |
| Service → Client (callbacks) | HMAC-SHA256 (`X-Timestamp` + `X-Signature`) |

## 🐳 Docker

Multi-stage `Dockerfile` (builder → production) plus compose files:

```bash
docker compose up -d --build
```

- `payment-api` — Fastify API (healthchecked at `/health`)
- `stellar-listener` — chain event monitor (Kafka or HTTP fallback)

Migrations run in-process on startup, so production needs no `tsx`. Secrets are injected via `.env`.

## 📁 Project Structure

```
payment_svc/
├── src/
│   ├── server.ts               # Entry point
│   ├── app.ts                  # Fastify factory + route registration
│   ├── controllers/            # Request handlers
│   ├── services/               # Business logic (order, price, callback, stellar…)
│   ├── routes/                 # Route + JSON Schema definitions
│   ├── middleware/             # Auth + error handling
│   ├── workers/disburseWorker.ts # Kafka disbursement consumer
│   ├── migrations/             # Knex schema migrations
│   └── db.ts                   # Shared Knex singleton
├── stellar-listener/           # Incoming-token event monitor
├── docs/API_INTEGRATION.md     # Full API reference for partners
└── dist/                       # Compiled output (build)
```

## 🤝 Contributing

Contributions welcome!

1. Fork the repo
2. Create your feature branch
3. Commit and push
4. Open a pull request

## 📄 License

MIT License — see [LICENSE](LICENSE). © 2026 Orbit Labs
