# Payment Service API Documentation

## Overview

Fastify + TypeScript backend for USDT trading (buy/sell USDT for Vietnamese Dong). Integrates with SePay for fiat payments and Stellar for crypto disbursement.

## Base URL

```
http://localhost:3000
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/orders/deposit` | Partner-App-Key | Create buy order (USDT) |
| POST | `/api/orders/withdrawal` | Partner-App-Key | Create sell order (USDT) |
| GET | `/api/orders/:payment_code` | Partner-App-Key | Get order status |
| POST | `/api/orders/:payment_code/cancel` | Partner-App-Key | Cancel order |
| POST | `/api/webhooks/sepay` | SePay API key | Deposit confirmation |
| POST | `/api/webhooks/chain` | Chain signature | Withdrawal completion |
| POST | `/admin/login` | None | Admin JWT login |
| GET | `/admin/stats` | JWT | Order statistics |
| PATCH | `/admin/callback-secret` | JWT | Rotate callback secret |

## Authentication

### Partner-App-Key (Client → Service)

```bash
Partner-App-Key: <your-key>
```

### Webhook Signature (Provider → Service)

```bash
X-Webhook-Timestamp: <unix-ms>
X-Webhook-Signature: HMAC-SHA256(secret, timestamp + "." + body)
```

### Callback Signature (Service → Client)

Service signs callbacks with `X-Signature` header. Client verifies using shared `CALLBACK_SIGNATURE_SECRET`.

See `docs/API_INTEGRATION.md` for full details including:
- Request/response examples
- Error codes
- Callback verification code
- State machine diagram

## Swagger UI

Full API docs at: `http://localhost:3000/docs`