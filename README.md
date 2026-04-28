# payment_svc

Price engine, fee management and SePay payment gateway integration.

## Stack
- Node.js + TypeScript (Fastify 4, MySQL/Knex 3)

## Setup
```bash
npm install
cp .env.example .env
# Edit .env with your DB and SePay credentials
```

## Development
```bash
npm run dev          # Watch mode (tsx)
npm run build       # Build to dist/
npm run start      # Run production build
```

## Production
```bash
./start-prod.sh    # Migrate → Build → Start
```

## API Endpoints
- `GET /health` — Health check
- `/api/rate/*` — Price engine
- `/api/orders/*` — Order management
- `/config/*` — configuration API 
- `/api/webhooks/sepay` — SePay IPN (requires `SEPAY_KEY`)

## Payment Flow

### Full Order State Update Flow
```
User (Telegram)
    ↓ create buy/sell order
Payment API → creates order (state=1 CREATED)
    ↓
Payment Server processes internally
    ↓ sends webhook
Our webhook endpoint → update DB
    ↓
Telegram notification to user
```

### States (from webhook perspective)
| State | Name |
|-------|------|
| 1 | CREATED |
| 2 | PROCESSING |
| 3 | COMPLETED |
| 4 | FAILED |
| 5 | CLOSED |

### Processing Sub-states (only when state=2)
| State | Name |
|-------|------|
| 10 | WAITING_FIAT_DEPOSIT |
| 11 | FIAT_CONFIRMED |
| 12 | FIAT_FAILED |
| 13 | WAITING_USDT_TRANSFER |
| 14 | USDT_CONFIRMED |
| 15 | USDT_FAILED |
| 16 | WAITING_ADMIN_APPROVAL |

### State Transitions
```
10 (WAITING_FIAT_DEPOSIT)
    ↓ user transfers fiat
11 (FIAT_CONFIRMED)
    ↓ system sends USDT
13 (WAITING_USDT_TRANSFER)
    ↓ blockchain confirmed
14 (USDT_CONFIRMED)
    ↓
3 (COMPLETED)

Alternative paths:
10 → 12 (FIAT_FAILED) → 4 (FAILED)
13 → 15 (USDT_FAILED) → 4 (FAILED)
any → 16 (WAITING_ADMIN_APPROVAL) → manual review
```

## Env Variables
See `.env.example` for required configuration.