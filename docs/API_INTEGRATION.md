# API Integration Guide

## Base URL

```
http://localhost:3000
```

---

## Authentication

### Client → Service (Partner-App-Key)

All order API endpoints require the `Partner-App-Key` header.

### Provider → Service Webhooks

**SePay** uses API key auth:
```
Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>
```

**Stellar incoming:**
```
Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>
```

**Chain** uses HMAC signature auth:
```
X-Webhook-Timestamp: <unix-ms>
X-Webhook-Signature: HMAC-SHA256(secret, timestamp + "." + body_hex)
```

Replay protection: requests older than 5 minutes are rejected.

---

## Supported Assets

| Network | Asset | Contract Address |
|---------|-------|-----------------|
| Mainnet | USDC | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| Testnet | USDC | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| Both | XLM | Native (no address needed) |

---

## Rate Endpoints

Rate endpoints return **our** prices, not raw exchange prices. Rates are based on Binance P2P median with spread + fee applied. Rates are cached for 30 seconds. These endpoints are public (no authentication required).

### Get USDC/VND Rate

```
GET /api/rate/usdt_vnd
```

**Response (200):**
```json
{
  "created_at": "2026-05-11T02:30:00.000Z",
  "buy": 26504,
  "sell": 26358,
  "fee_rate_buy": 0.008,
  "fee_rate_sell": 0.008,
  "min_fee_vnd": 5000
}
```

### Get XLM/VND Rate

```
GET /api/rate/xlm_vnd
```

**Response (200):**
```json
{
  "created_at": "2026-05-11T02:30:00.000Z",
  "buy": 4538,
  "sell": 4238,
  "fee_rate_buy": 0.008,
  "fee_rate_sell": 0.008,
  "min_fee_vnd": 5000
}
```

---

## Order Endpoints

### 1. Create Deposit Order (Buy Crypto)

```
POST /api/orders/deposit
```

**Headers:**
```
Content-Type: application/json
Partner-App-Key: <your-partner-key>
```

**Buy USDC:**
```json
{
  "amount": "100",
  "chain_id": 1,
  "asset_code": "USDC",
  "token_address": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  "recipient": "GABC123...YZ",
  "callback": "https://your-server.com/webhook"
}
```

**Buy XLM (native):**
```json
{
  "amount": "10",
  "chain_id": 1,
  "asset_code": "XLM",
  "token_address": "",
  "recipient": "GABC123...YZ",
  "callback": "https://your-server.com/webhook"
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | string | Yes | Amount to buy (e.g. "100") |
| chain_id | integer | Yes | Network: 1=Stellar testnet, 0=Stellar mainnet |
| asset_code | string | Yes | Token code: `USDC` or `XLM` |
| token_address | string | No* | Token issuer. Required for USDC, empty for XLM |
| recipient | string | Yes | User's Stellar wallet address |
| callback | string | Yes | Webhook URL for state changes |

*For XLM native, `token_address` can be empty string `""` or omitted.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "199",
    "order_type": "buy",
    "code": "DHA1B2C3D4E5",
    "provider": "sepay",
    "amount": 10,
    "currency": "XLM",
    "rate": 4490,
    "asset_code": "XLM",
    "token_address": "",
    "recipient": "GABC123...YZ",
    "chain_id": 1,
    "state": 1,
    "processing_state": 10,
    "body": {
      "qr_link": "https://qr.sepay.vn/img?...",
      "bankInfo": {
        "bankName": "Ngân hàng TMCP Quân đội",
        "bankAccountName": "PHUNG VAN THIEN",
        "bankAccountNumber": "VQRQAITNX0144",
        "transferContent": "DHA1B2C3D4E5",
        "vaAmount": 49900
      }
    },
    "expired_at": { "seconds": 1778467977, "nanos": 875000000 },
    "created_at": { "seconds": 1778466177, "nanos": 861000000 },
    "original_rate": 4440,
    "total_fee_vnd": 5000
  }
}
```

---

### 2. Create Withdrawal Order (Sell Crypto)

```
POST /api/orders/withdrawal
```

**Headers:**
```
Content-Type: application/json
Partner-App-Key: <your-partner-key>
```

**Sell USDC:**
```json
{
  "amount": "100",
  "chain_id": 1,
  "asset_code": "USDC",
  "token_address": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  "callback": "https://your-server.com/webhook",
  "payment_info": {
    "bank_id": "970422",
    "full_name": "NGUYEN VAN A",
    "account_type": 0,
    "account_number": "0123456789"
  }
}
```

**Sell XLM:**
```json
{
  "amount": "10",
  "chain_id": 1,
  "asset_code": "XLM",
  "token_address": "",
  "callback": "https://your-server.com/webhook",
  "payment_info": {
    "bank_id": "970422",
    "full_name": "NGUYEN VAN A",
    "account_type": 0,
    "account_number": "0123456789"
  }
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | string | Yes | Amount to sell |
| chain_id | integer | Yes | Network: 1=Stellar testnet, 0=Stellar mainnet |
| asset_code | string | Yes | Token code: `USDC` or `XLM` |
| token_address | string | No* | Token issuer. Required for USDC, empty for XLM |
| callback | string | Yes | Webhook URL for state changes |
| payment_info | object | Yes | Bank payout info |
| payment_info.bank_id | string | Yes | Bank BIN (e.g. "970422" for MBBank) |
| payment_info.full_name | string | Yes | Account holder name |
| payment_info.account_type | integer | Yes | Account type |
| payment_info.account_number | string | Yes | Account number |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "200",
    "order_type": "sell",
    "code": "DHZ9Y8X7W6V",
    "provider": "chain",
    "amount": 10,
    "currency": "XLM",
    "rate": 4238,
    "asset_code": "XLM",
    "chain_id": 1,
    "state": 1,
    "processing_state": 10,
    "pay_data": {
      "address": "G_hot_wallet_address..."
    },
    "payment_info": {
      "bank_id": "970422",
      "bank_account_name": "NGUYEN VAN A",
      "bank_account_no": "0123456789"
    },
    "expired_at": { "seconds": 1778467977, "nanos": 875000000 },
    "created_at": { "seconds": 1778466177, "nanos": 861000000 }
  }
}
```

---

### 3. Get Order Status

```
GET /api/orders/:payment_code
```

**Headers:**
```
Partner-App-Key: <your-partner-key>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "199",
    "order_type": "buy",
    "code": "DHA1B2C3D4E5",
    "amount": 10,
    "currency": "XLM",
    "state": 1,
    "processing_state": 10,
    "transaction_hash": null,
    "created_at": { "seconds": 1778466177, "nanos": 861000000 },
    "updated_at": { "seconds": 1778466177, "nanos": 861000000 }
  }
}
```

---

### 4. Cancel Order

```
POST /api/orders/:payment_code/cancel
```

**Headers:**
```
Content-Type: application/json
Partner-App-Key: <your-partner-key>
```

**Body (optional):**
```json
{
  "reason": "User requested cancellation"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payment_code": "DHA1B2C3D4E5",
    "order_state": 5,
    "cancelled_at": "2026-05-11T02:30:00.000Z"
  }
}
```

**Error Response (409):**
```json
{
  "success": false,
  "error": {
    "code": "CANCEL_NOT_ALLOWED",
    "message": "Order cannot be cancelled",
    "retriable": false,
    "trace_id": "req-123"
  }
}
```

---

## Webhook Endpoints

### 5. SePay Webhook (Buy — Deposit Confirmation)

```
POST /api/webhooks/sepay
```

**Headers:**
```
Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>
Content-Type: application/json
```

**Body:**
```json
{
  "id": 123456789,
  "gateway": "MBBank",
  "transactionDate": "2026-05-11T02:30:00",
  "accountNumber": "VQRQAITNX0144",
  "code": "DHA1B2C3D4E5",
  "content": "DHA1B2C3D4E5",
  "transferType": "in",
  "transferAmount": 49900,
  "accumulated": 49900,
  "subAccount": null,
  "referenceCode": "REF123456",
  "description": "Chuyen tien"
}
```

**Response (200):**
```json
{
  "success": true
}
```

---

### 6. Stellar Incoming Webhook (Sell — Fallback)

```
POST /api/webhooks/stellar-incoming
```

**Headers:**
```
Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>
Content-Type: application/json
```

**Body:**
```json
{
  "txHash": "abc123...",
  "from": "GABC123...YZ",
  "to": "Ghotwallet...",
  "amount": "10.0000000",
  "asset": "XLM",
  "tokenIssuer": "",
  "timestamp": "2026-05-11T02:30:00Z",
  "walletLabel": "hot_wallet_1",
  "memo": "DHZ9Y8X7W6V"
}
```

**Response (200):**
```json
{
  "success": true
}
```

**Status: Not implemented.**

---

## Webhook Callback to Client

Service POSTs to client's `callback` URL when order state changes.

**Headers:**
```
Content-Type: application/json
X-Timestamp: <unix-ms>
X-Signature: HMAC-SHA256(secret, timestamp + "." + body_hex)
```

**Body:**
```json
{
  "id": "199",
  "topic": "order.state.change",
  "ts": "2026-05-11T02:30:00.000Z",
  "payload": {
    "order_id": "199",
    "old_order_state": 1,
    "new_order_state": 2,
    "old_processing_state": 10,
    "new_processing_state": 12
  }
}
```

### Callback Signature Verification (Node.js)

```javascript
const crypto = require('crypto');

function verifyCallback(secret, timestamp, body, signature) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
  
  const now = Date.now();
  const timestampNum = parseInt(timestamp, 10);
  const isFresh = Math.abs(now - timestampNum) <= 300000; // 5 min
  
  return isValid && isFresh;
}
```

---

## Order States

| State | Name | Description |
|-------|------|-------------|
| 1 | CREATED | Order created, waiting for payment |
| 2 | PROCESSING | Payment confirmed, processing |
| 3 | COMPLETED | Order finished successfully |
| 4 | FAILED | Order failed |
| 5 | CANCELLED | Order cancelled |

---

## Error Response Schema

All errors follow this format:

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

### Error Codes

| Code | HTTP Status | Retriable | Description |
|------|-------------|-----------|-------------|
| `ORDER_NOT_FOUND` | 404 | false | Order not found |
| `INVALID_AMOUNT` | 400 | false | Invalid amount format |
| `CANCEL_NOT_ALLOWED` | 409 | false | Order cannot be cancelled |
| `VALIDATION_ERROR` | 400 | false | Request validation failed |
| `UNAUTHORIZED` | 401 | false | Authentication failed |
| `AUTH_NOT_CONFIGURED` | 503 | true | Auth not configured |
| `INTERNAL_ERROR` | 500 | true | Internal server error |
| `CHAIN_EVENT_MISMATCH` | 400 | false | Chain/Stellar event validation failed |
| `UNSUPPORTED_TOKEN` | 400 | false | Token not supported |

Every response includes `X-Trace-ID` header for debugging.

---

## Order Redirect Pages

### Success Redirect

```
GET /api/orders/:id/success
```

**Parameters:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Numeric order ID or payment code |

**Response (302):** Redirects to `${DOMAIN}/order/{payment_code}?payment=success`

---

### Error Redirect

```
GET /api/orders/:id/error
```

**Parameters:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Numeric order ID or payment code |

**Response (302):** Redirects to `${DOMAIN}/order/{payment_code}?payment=error`

---

### Cancel Redirect

```
GET /api/orders/:id/cancel
```

**Parameters:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Numeric order ID or payment code |

**Response (302):** Redirects to `${DOMAIN}/order/{payment_code}?payment=cancel`

---

## Landing Page Endpoints

### Get All P2P Rates

```
GET /api/landing/p2p-rates
```

**Response (200):**
```json
{
  "binance": {
    "usdc": { "bestBuyPrice": 26510, "bestSellPrice": 26400 },
    "xlm": { "bestBuyPrice": 4540, "bestSellPrice": 4480 }
  },
  "okx": { ... },
  "bybit": { ... },
  "our": {
    "usdc": { "buy": 26504, "sell": 26358, "fee_rate_buy": 0.008, "fee_rate_sell": 0.008, "min_fee_vnd": 5000 },
    "xlm": { "buy": 4538, "sell": 4238, "fee_rate_buy": 0.008, "fee_rate_sell": 0.008, "min_fee_vnd": 5000 }
  }
}
```

---

### Get P2P Price History

```
GET /api/landing/p2p-history?days=7
```

**Querystring:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | integer | 7 | History window (1–30 days) |

**Response (200):**
```json
{
  "binance": [{ "created_at": 1746931200, "buy": 26510, "sell": 26400 }],
  "okx": [...],
  "bybit": [...],
  "our": [...]
}
```

---

## Bypass Endpoints

**For testing only.** These endpoints bypass normal payment flow using `ADMIN_BOOTSTRAP_PASSWORD`. Do not expose in production.

### Bypass Buy Payment

```
POST /api/bypass/bypass-payment
```

**Body:**
```json
{
  "admin_key": "your-bootstrap-password",
  "order_id": 123
}
```

**Response (200):**
```json
{ "success": true }
```

**Error (400):**
```json
{ "success": false, "error": "ORDER_NOT_ELIGIBLE" }
```

Possible errors: `INVALID_ADMIN_CODE`, `ORDER_NOT_FOUND`, `NOT_BUY_ORDER`, `ORDER_NOT_ELIGIBLE`, `CONFIRMATION_FAILED`

---

### Bypass Sell Payment

```
POST /api/bypass/bypass-sell-payment
```

**Body:**
```json
{
  "admin_key": "your-bootstrap-password",
  "order_id": 456
}
```

**Response (200):**
```json
{ "success": true }
```

**Error (400):**
```json
{ "success": false, "error": "ORDER_NOT_FOUND" }
```

Possible errors: `INVALID_ADMIN_CODE`, `ORDER_NOT_FOUND`, `NOT_SELL_ORDER`, `ORDER_NOT_ELIGIBLE`

---

## Admin Endpoints

### Login

```
POST /admin/login
```

**Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "token_type": "Bearer",
    "expires_in": 43200
  }
}
```

**Error (401):**
```json
{ "success": false, "error": "Invalid credentials" }
```

---

### Get Statistics

```
GET /admin/stats?from=2026-01-01&to=2026-12-31
```

**Headers:**
```
Authorization: Bearer <jwt>
```

**Querystring:**
| Field | Type | Description |
|-------|------|-------------|
| `from` | string (ISO date) | Start date (optional) |
| `to` | string (ISO date) | End date (optional) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "from": "2026-01-01T00:00:00.000Z",
    "to": "2026-12-31T00:00:00.000Z",
    "totals": {
      "count": 1523,
      "net_vnd": 152300000,
      "fee_vnd": 1218400,
      "usdt_amount": 6100
    },
    "by_direction": {
      "buy": { "count": 1000, "net_vnd": 100000000, "fee_vnd": 800000, "usdt_amount": 4000 },
      "sell": { "count": 523, "net_vnd": 52300000, "fee_vnd": 418400, "usdt_amount": 2100 }
    }
  }
}
```

---

### Rotate Callback Secret

```
PATCH /admin/callback-secret
```

**Headers:**
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "secret": "new-secret-at-least-32-characters-long"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "rotated_at": "2026-05-11T02:30:00.000Z"
  }
}
```

**Error (400):** `Secret must be at least 32 characters`
**Error (400):** `Rotation already in progress. Wait 5 minutes.`

---

## Config Endpoints

### Get Fee Config

```
GET /config/fees
```

Returns global spreads, fee rates, and per-token (USDC, XLM) overrides.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "spread_buy": 50,
    "spread_sell": 50,
    "fee_rate_buy": 0.008,
    "fee_rate_sell": 0.008,
    "usdc_min_fee": 5000,
    "xlm_min_fee": 5000,
    "usdc_spread_buy": 50,
    "usdc_spread_sell": 50,
    "usdc_fee_rate_buy": 0.008,
    "usdc_fee_rate_sell": 0.008,
    "usdc_min_order_amount": 1,
    "xlm_spread_buy": 50,
    "xlm_spread_sell": 50,
    "xlm_fee_rate_buy": 0.008,
    "xlm_fee_rate_sell": 0.008,
    "xlm_min_order_amount": 1
  }
}
```

---

### Get Token Fee Config

```
GET /config/fee/:token
```

**Parameters:**
| Field | Type | Description |
|-------|------|-------------|
| `token` | string | Token code (`USDC` or `XLM`) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "USDC",
    "buy": {
      "spread": 50,
      "fee_rate": 0.008,
      "min_fee": 5000,
      "min_order_amount": 1,
      "max_order_amount": null,
      "source": "binance"
    },
    "sell": { ... }
  }
}
```

**Error (404):**
```json
{ "success": false, "error": "Token config not found" }
```

---

### Update Config (Admin)

```
PATCH /config
```

**Headers:**
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Body (all fields optional):**
```json
{
  "spread_buy": 50,
  "spread_sell": 50,
  "fee_rate_buy": 0.008,
  "fee_rate_sell": 0.008,
  "usdc_min_fee": 5000,
  "xlm_min_fee": 5000,
  "USDC_buy": { "spread": 50, "fee_rate": 0.008, "min_fee": 5000, "min_order_amount": 1, "max_order_amount": 100000 },
  "USDC_sell": { "spread": 50, "fee_rate": 0.008, "min_fee": 5000 },
  "XLM_buy": { "spread": 50, "fee_rate": 0.008, "min_fee": 5000 },
  "XLM_sell": { "spread": 50, "fee_rate": 0.008, "min_fee": 5000 }
}
```

**Response (200):** Same as `GET /config/fees` (updated values)

**Error (400):**
```json
{ "success": false, "error": "No config fields provided" }
```

---

## CMS Endpoints

### CMS Login

```
POST /cms/login
```

**Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "token_type": "Bearer",
    "expires_in": 43200
  }
}
```

---

### Create Admin

```
POST /cms/admins
```

**Body:**
```json
{
  "key": "cms-create-admin-key",
  "email": "newadmin@example.com",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "email": "newadmin@example.com"
  }
}
```

---

### Create Partner

```
POST /cms/partner
```

**Headers:**
```
Authorization: Bearer <jwt>
```

**Body:**
```json
{
  "name": "Partner Name",
  "fee_buy": 0.001,
  "fee_sell": 0.001,
  "active": true
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "part_abc123",
    "name": "Partner Name",
    "key": "pk_live_abc...",
    "fee_buy": 0.001,
    "fee_sell": 0.001,
    "active": true,
    "created_at": "2026-05-11T02:30:00.000Z",
    "updated_at": null
  }
}
```

---

### List Partners

```
GET /cms/partner
```

**Headers:**
```
Authorization: Bearer <jwt>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "part_abc123",
      "name": "Partner Name",
      "key": "pk_live_abc...",
      "fee_buy": 0.001,
      "fee_sell": 0.001,
      "active": true,
      "created_at": "2026-05-11T02:30:00.000Z",
      "updated_at": null
    }
  ]
}
```

---

### Get Partner

```
GET /cms/partner/:id
```

**Headers:**
```
Authorization: Bearer <jwt>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "part_abc123",
    "name": "Partner Name",
    "key": "pk_live_abc...",
    "fee_buy": 0.001,
    "fee_sell": 0.001,
    "active": true,
    "created_at": "2026-05-11T02:30:00.000Z",
    "updated_at": null
  }
}
```

---

### Get CMS Config

```
GET /cms/config
```

**Headers:**
```
Authorization: Bearer <jwt>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "available_price_sources": ["binance", "okx", "bybit", "our"],
    "configs": {
      "usdc": {
        "buy": { "source": "binance", "spread": 50, "fee_rate": 0.008, "min_fee": 5000, "min_order_amount": 1, "max_order_amount": null },
        "sell": { "source": "binance", "spread": 50, "fee_rate": 0.008, "min_fee": 5000, "min_order_amount": 1, "max_order_amount": null }
      },
      "xlm": { "buy": {...}, "sell": {...} }
    }
  }
}
```

---

### Update CMS Config

```
PATCH /cms/config
```

**Headers:**
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "usdc": {
    "buy": { "spread": 50, "fee_rate": 0.008, "min_fee": 5000, "min_order_amount": 1, "max_order_amount": 100000 },
    "sell": { "spread": 50, "fee_rate": 0.008 }
  },
  "xlm": {
    "buy": { "spread": 50, "fee_rate": 0.008 },
    "sell": { "spread": 50, "fee_rate": 0.008 }
  }
}
```

**Response (200):** Same format as `GET /cms/config` (updated values)

**Error (400):**
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "No config fields provided" } }
```

---

### Get Rates (Public)

```
GET /cms/rates
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "usdc": { "buy": 26504, "sell": 26358 },
    "xlm": { "buy": 4538, "sell": 4238 }
  }
}
```

---

### Get Fee Audit Log

```
GET /cms/admin/audit
```

**Headers:**
```
Authorization: Bearer <jwt>
```

**Response (200):**
```json
[
  {
    "id": "1",
    "action": "UPDATE_CONFIG",
    "details": "{\"key\":\"usdc_buy_spread\",\"old\":\"60\",\"new\":\"50\"}",
    "createdAt": "2026-05-11T02:30:00.000Z",
    "user": { "name": "admin@example.com", "email": "admin@example.com" }
  }
]
```

---

### Get Buy Orders

```
GET /cms/orders/buy
```

**Headers:**
```
Authorization: Bearer <jwt>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "updated_at": "2026-05-11T02:30:00.000Z",
      "payment_code": "DHA1B2C3D4E5",
      "transaction_hash": "abc123...",
      "recipient": "GABC123...YZ",
      "usdc_amount": 10,
      "asset_code": "XLM",
      "rate": 4490,
      "net_vnd": 49490,
      "fee_vnd": 5000,
      "order_state": 3
    }
  ]
}
```

---

### Get Sell Orders

```
GET /cms/orders/sell
```

**Headers:**
```
Authorization: Bearer <jwt>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "updated_at": "2026-05-11T02:30:00.000Z",
      "payment_code": "DHZ9Y8X7W6V",
      "transaction_hash": "def456...",
      "usdc_amount": 10,
      "asset_code": "XLM",
      "rate": 4238,
      "net_vnd": 42380,
      "fee_vnd": 5000,
      "order_state": 3,
      "payment_info": { "bank_id": "970422", "bank_account_name": "NGUYEN VAN A", "bank_account_no": "0123456789" }
    }
  ]
}
```

---

### Change Admin Password

```
PATCH /cms/admin/password
```

**Headers:**
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

**Response (200):**
```json
{ "success": true }
```

**Error (400):** `New password must be at least 8 characters`
**Error (401):** `Current password is incorrect`