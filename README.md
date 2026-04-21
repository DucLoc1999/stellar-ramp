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
- `/api/price/*` — Price engine
- `/api/orders/*` — Order management
- `/config/*` — Admin API (requires `ADMIN_API_KEY`)
- `/api/webhooks/sepay` — SePay IPN (requires `SEPAY_KEY`)

## Env Variables
See `.env.example` for required configuration.