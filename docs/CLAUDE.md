# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A Fastify + TypeScript backend that powers a **Telegram bot for USDT trading** (buy/sell USDT for Vietnamese Dong). The bot integrates with an external payment API (HSPay) and uses grammY for Telegram bot interactions. All UI messages are in Vietnamese.

## Commands

```bash
# Development (hot-reload)
npm run dev

# Build
npm run build

# Lint / format
npm run lint
npm run lint:fix
npm run format

# Database migrations
npm run migrate:latest      # run all pending migrations
npm run migrate:rollback    # rollback last migration
npm run migrate:status      # check migration status
npm run migrate:make        # create new migration file

# Docker (production)
make up          # start
make down        # stop
make rebuild     # rebuild and start
make logs        # follow logs
make health      # check /health endpoint
```

## Architecture

**Request flow:** `Routes → Controllers → Services → DB (MySQL via Knex)`

Active HTTP routes:
- `POST /api/telegram/webhook` — receives updates from Telegram (grammY processes them)
- `POST /api/webhooks/payment` — receives payment status updates from HSPay

Disabled routes (security): `teleUserRoutes`, `paymentRoutes` — their logic is available via the service layer, but HTTP access is intentionally blocked.

**Key services:**
- `src/services/telegramService.ts` — core bot logic: all conversation states, message templates (Vietnamese), grammY bot setup
- `src/services/paymentService.ts` — order creation/management via HSPay API
- `src/services/webhookService.ts` — handles HSPay payment status callbacks, notifies users
- `src/services/kycService.ts` — KYC verification flow
- `src/services/s3Service.ts` — S3 upload for KYC images
- `src/services/fptAiVisionService.ts` — AI vision for ID document verification
- `src/services/notificationQueueService.ts` — queues Telegram notifications
- `src/services/referralService.ts` — referral system

**Database:** MySQL via Knex. Migrations live in `database/migrations/`. The app auto-runs migrations on startup (`src/utils/migrationRunner.ts`). Tables: `tele_users`, `orders`, `payment_information`, `kyc`, `referrals`.

**Config:** `src/config/app.ts` (app/telegram/pay config from env), `src/config/database.ts` (mysql2 pool), `src/config/knex.ts` (knex instance for migrations and queries).

**Observability:** Sentry (`src/instrument.ts` imported first in `server.ts`), pino with rolling file logs in `./logs/`.

## Environment Variables

Required in `.env`:
```
NODE_ENV, PORT, HOST, LOG_LEVEL
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
TELEGRAM_BOT_TOKEN
API_PAY, PARTNER_APP_KEY
WEBHOOK_PUBLIC_KEY
SENTRY_DSN (optional)
URL_SWAGGER (optional, for prod Swagger URL)
```

## Deployment

Docker-based. The app connects to an **external MySQL** at a configured host (not a docker-compose service). Port defaults to `8001` in production. The `docker-entrypoint.sh` handles file permissions for mounted `./logs` and `./data` volumes.
