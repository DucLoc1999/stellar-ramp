# Payment Service — System Overview

## What it is

A VND ↔ crypto exchange gateway. Partners integrate via API to let their users buy crypto (deposit VND → receive USDC/XLM on Stellar) or sell crypto (send USDC/XLM → receive VND payout).

## Core Concepts

| Concept | Description |
|---|---|
| **Direction** | `buy` = VND in → USDC/XLM out. `sell` = USDC/XLM in → VND out. |
| **Payment code** | `DH` + 10 alphanum (e.g. `DHA1B2C3D4E5`). Anchor for the entire order lifecycle. Used as SePay transfer description and Stellar memo. |
| **Reservation** | Redis-backed liquidity guard. Reserves the asset before order creation to prevent overselling. |
| **Order state** | `CREATED(1) → PROCESSING(2) → COMPLETED(3)` or `FAILED(4)` or `CANCELLED(5)` |
| **Processing state** | Sub-state within an order: 10=created, 12=sell payment received, 13=disburse triggered, 14=completed, 15=failed |

---

## Architecture

```mermaid
graph TB
    subgraph Clients
        Partner[Partner App]
        Admin[Admin UI]
    end

    subgraph "Payment Service (Fastify)"
        direction TB
        API["/api/orders\n/api/rate\n/api/users\n/config"]
        CMS["/cms"]
        AdminAPI["/admin"]
        Bypass["/bypass"]
        WebhookAPI["/api/webhooks"]
    end

    subgraph Services
        OrderSvc[orderService]
        PriceSvc[priceService]
        ReservSvc[reservationService]
        StellarSvc[stellarService]
        SepaySvc[sepayService]
        CallbackSvc[callbackService]
        PayoutSvc[payoutService]
        ConfigSvc[configService]
    end

    subgraph "External Systems"
        SePay[SePay PG\nVA / QR]
        StellarHorizon[Stellar Horizon\nAPI]
        StellarWorker[Stellar Worker\nhttp://worker]
        Binance[Binance P2P\nprice feed]
        BankPayout[Bank Payout\nAPI]
    end

    subgraph "Infrastructure"
        PG[(PostgreSQL)]
        Redis[(Redis\nreservations)]
        Kafka[Kafka]
    end

    subgraph "Background"
        DisburseWorker[disburseWorker\nKafka consumer]
        ExpiryScheduler[orderExpiryScheduler\ncron]
        SnapshotScheduler[snapshotLandingPageScheduler]
    end

    Partner -->|partner-app-key| API
    Admin -->|JWT| AdminAPI
    SePay -->|Apikey| WebhookAPI
    StellarHorizon -->|HMAC sig| WebhookAPI

    API --> OrderSvc
    WebhookAPI --> SepaySvc
    WebhookAPI --> OrderSvc

    OrderSvc --> PriceSvc
    OrderSvc --> ReservSvc
    OrderSvc --> StellarSvc
    OrderSvc --> CallbackSvc
    OrderSvc --> PayoutSvc
    OrderSvc --> PG

    PriceSvc --> Binance
    PriceSvc --> ConfigSvc
    ConfigSvc --> PG

    ReservSvc --> Redis
    ReservSvc --> StellarHorizon
    ReservSvc --> PayoutSvc

    StellarSvc --> StellarWorker
    StellarSvc --> StellarHorizon
    StellarSvc --> Kafka

    DisburseWorker -->|consumes DISBURSE_CRYPTO| Kafka
    DisburseWorker --> StellarSvc
    DisburseWorker --> Kafka

    CallbackSvc -->|POST + HMAC| Partner
    CallbackSvc --> PG

    PayoutSvc --> BankPayout

    ExpiryScheduler --> OrderSvc
```

---

## Buy Flow (VND → USDC)

```mermaid
sequenceDiagram
    actor User
    participant Partner
    participant PaymentSvc
    participant Redis
    participant SePay
    participant Kafka
    participant DisburseWorker
    participant StellarWorker
    participant Stellar

    Partner->>PaymentSvc: POST /api/orders/deposit
    PaymentSvc->>Stellar: checkTrustline(recipient)
    PaymentSvc->>Redis: reserveForOrder(USDC, amount)
    PaymentSvc->>SePay: createSepayOrder(net_vnd)
    PaymentSvc->>DB: INSERT orders (CREATED, ps=10)
    PaymentSvc->>Partner: callback(CREATED)
    PaymentSvc-->>Partner: { payment_code, bank_info, QR }

    User->>SePay: Transfer VND to VA/bank
    SePay->>PaymentSvc: POST /api/webhooks/sepay (Apikey)
    PaymentSvc->>DB: dedup check (webhook_logs)
    PaymentSvc->>DB: UPDATE orders → PROCESSING
    PaymentSvc->>Redis: consumeReservation
    PaymentSvc->>Partner: callback(PROCESSING)

    alt Kafka available
        PaymentSvc->>Kafka: emit DISBURSE_CRYPTO
        Kafka->>DisburseWorker: consume
        DisburseWorker->>StellarWorker: POST /disburse
    else Direct
        PaymentSvc->>StellarWorker: POST /disburse
    end

    StellarWorker->>Stellar: submit tx
    Stellar-->>StellarWorker: tx hash
    StellarWorker-->>DisburseWorker: { success, hash }
    DisburseWorker->>DB: UPDATE orders → COMPLETED (ps=14)
    DisburseWorker->>Kafka: emit ORDER_PAID
    PaymentSvc->>Partner: callback(COMPLETED, tx_hash)
```

---

## Sell Flow (USDC → VND)

```mermaid
sequenceDiagram
    actor User
    participant Partner
    participant PaymentSvc
    participant Redis
    participant Stellar
    participant BankAPI

    Partner->>PaymentSvc: POST /api/orders/withdrawal
    PaymentSvc->>Redis: reserveForOrder(VND, net_vnd)
    PaymentSvc->>DB: INSERT orders (CREATED, ps=10)
    PaymentSvc->>Partner: callback(CREATED)
    PaymentSvc-->>Partner: { payment_code, hot_wallet_address }

    User->>Stellar: Send USDC to hot wallet\nmemo = payment_code
    Stellar->>PaymentSvc: POST /api/webhooks/chain (HMAC)
    PaymentSvc->>DB: dedup (webhook_logs, tx_hash)
    PaymentSvc->>DB: validate asset + issuer + exact amount
    PaymentSvc->>DB: UPDATE → PROCESSING (ps=12)
    PaymentSvc->>Partner: callback(PROCESSING)

    PaymentSvc->>BankAPI: executePayout(bank_id, account, net_vnd)
    alt Payout success
        BankAPI-->>PaymentSvc: ok
        PaymentSvc->>DB: UPDATE → COMPLETED (ps=13)
        PaymentSvc->>Kafka: emit ORDER_PAID
        PaymentSvc->>Partner: callback(COMPLETED)
    else Payout fail
        BankAPI-->>PaymentSvc: error
        PaymentSvc->>DB: UPDATE → FAILED (ps=14)
        PaymentSvc->>Redis: releaseReservation
        PaymentSvc->>Partner: callback(FAILED)
    end
```

---

## Order State Machine

```mermaid
stateDiagram-v2
    [*] --> CREATED : createDeposit / createWithdrawal\nps=10
    CREATED --> PROCESSING : SePay webhook (buy)\nor chain webhook (sell)\nps=12/13
    CREATED --> CANCELLED : manual cancel\nor order expired
    PROCESSING --> COMPLETED : disburse success (buy, ps=14)\nor payout success (sell, ps=13)
    PROCESSING --> FAILED : disburse fail (buy, ps=15)\nor payout fail (sell, ps=14)
    COMPLETED --> [*]
    FAILED --> [*]
    CANCELLED --> [*]
```

---

## Key Design Decisions

| Concern | Approach |
|---|---|
| Liquidity guard | Redis reservations with optimistic locking (WATCH/MULTI). Prevents overselling before order hits DB. Released on cancel/expiry, consumed on completion. |
| Disbursement | Kafka → DisburseWorker → StellarWorker (external HTTP). Falls back to direct call if Kafka unavailable. DisburseWorker retries up to 3× with backoff. |
| Deduplication | `webhook_logs.sepay_transaction_id` (buy) and `webhook_logs.tx_hash` (sell) prevent double-processing. |
| Callbacks | HMAC-SHA256 signed (`X-Signature`), 3 retries × 5s delay, dual-secret rotation with 5min overlap window. All attempts logged in `callback_logs`. |
| Pricing | Binance P2P median + configurable spread + fee (platform + per-partner). 30s in-memory cache. Fallback to CoinGecko. |
| Auth tiers | `partner-app-key` (order API) / `Apikey` (SePay webhook) / HMAC-SHA256 (chain webhook) / JWT (admin) |
| Order expiry | Scheduler periodically scans CREATED orders past `expired_at`, cancels them, and releases Redis reservations. |
| V2 APIs | `deposit_v2` / `withdrawal_v2` resolve `recipient` and `bank_info` from stored user + payment_method records instead of requiring them in each request. |

---

## Route Map

| Prefix | Auth | Purpose |
|---|---|---|
| `GET /health` | None | Health check |
| `/api/rate` | None | Price quotes |
| `/api/orders` | `partner-app-key` | Order CRUD (deposit, withdrawal, cancel, status) |
| `/api/users` | `partner-app-key` | User + payment method management |
| `/api/webhooks/sepay` | `Apikey` | SePay payment notifications |
| `/api/webhooks/chain` | HMAC-SHA256 | Stellar chain payment notifications |
| `/config` | JWT (writes) | Runtime config (spreads, fees, secrets) |
| `/admin` | JWT | Stats, secret rotation, bypass tools |
| `/cms` | — | CMS routes |
| `/landing` | — | Landing page snapshot |
| `/docs` | None | Swagger UI |

---

## Database Tables

| Table | Purpose |
|---|---|
| `orders` | All order records with full state history |
| `config` | Runtime config (spreads, fee rates, callback secrets) |
| `webhook_logs` | Deduplication log for SePay + chain webhooks |
| `callback_logs` | Per-attempt log for outbound callbacks |
| `fee_audit_log` | Audit trail for fee/spread changes |
| `system_wallets` | Encrypted Stellar hot wallet secrets (AES-256-GCM) |
| `admins` | Admin users for JWT auth |
| `partners` | Partner records with per-partner fee overrides |
| `users` | End-user records |
| `payment_methods` | User-stored crypto wallets and bank accounts |
