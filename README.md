# payment_svc

Price engine, fee management and SePay payment gateway integration.

## Architecture
- Node.js + TypeScript (Fastify 4, PostgreSQL/Knex 3)
- Cloudflare Worker (`stellar_signer_worker/`) for Stellar USDC payments

## Setup
```bash
npm install
cp .env.example .env
# Edit .env with your DB, SePay, and Worker credentials
```

## Development
```bash
npm run dev          # Watch mode (tsx)
npm run build       # Build to dist/
npm run start      # Run production build
```

## Workers
```bash
npm run worker:disburse  # Kafka consumer for USDC disbursement
```

## Production
```bash
./start-prod.sh    # Migrate → Build → Start
```

## API Endpoints
- `GET /health` — Health check
- `/api/rate/*` — Price engine
- `/api/orders/*` — Order management
- `/config/*` — Configuration API
- `/api/webhooks/sepay` — SePay IPN (requires `SEPAY_KEY`)

## Payment Flow

### Deposit (Buy USDC)
```
Client → POST /api/orders/deposit
    → Order created (state=CREATED)
    → User transfers VND to SePay
    → SePay webhook → confirmPayment
    → Kafka: DISBURSE_CRYPTO
    → disburseWorker → stellar_signer_worker
    → USDC sent to recipient wallet
    → Order state=COMPLETED
```

### Withdrawal (Sell USDC)
```
Client → POST /api/orders/withdrawal
    → Order created (state=CREATED)
    → External sends USDC to hot wallet
    → Chain webhook → confirmPayment
    → VND payout (stub)
    → Order state=COMPLETED
```

## Order States
| State | Name |
|-------|------|
| 1 | CREATED |
| 2 | PROCESSING |
| 3 | COMPLETED |
| 4 | FAILED |
| 5 | CANCELLED |

### Processing Sub-states (state=2)
| State | Name |
|-------|------|
| 10 | WAITING_FIAT_DEPOSIT |
| 11 | FIAT_CONFIRMED |
| 12 | FIAT_FAILED |
| 13 | WAITING_USDC_TRANSFER |
| 14 | USDC_SENT |
| 15 | USDC_FAILED |
| 16 | WAITING_ADMIN_APPROVAL |

## Env Variables
See `.env.example` for required configuration.