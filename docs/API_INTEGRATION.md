# API Integration Guide

## Base URL

```
http://localhost:3000
```

## Authentication

### Client → Service (Partner-App-Key)

All order API endpoints require the `Partner-App-Key` header:

```
Partner-App-Key: <your-partner-key>
```

Endpoints requiring auth:
- `POST /api/orders/deposit`
- `POST /api/orders/withdrawal`
- `GET /api/orders/:payment_code`
- `POST /api/orders/:payment_code/cancel`

### Provider → Service Webhooks

**SePay** uses API key auth:
```
Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>
```

**Chain** uses HMAC signature auth:
```
X-Webhook-Timestamp: <unix-ms>
X-Webhook-Signature: HMAC-SHA256(secret, timestamp + "." + body_hex)
X-Webhook-Id: <optional-idempotency-key>
```

Replay protection: requests older than 5 minutes are rejected.

---

## Endpoints

### 1. Create Deposit Order (Buy USDT)

```
POST /api/orders/deposit
```

**Headers:**
```
Content-Type: application/json
Partner-App-Key: <your-partner-key>
```

**Body:**
```json
{
  "amount": "100",
  "chain_id": 56,
  "token_address": "0x55d39818f045F98f3F44C2E95c2B4dEd51F6f78a",
  "recipient": "0xYourBSCWalletAddress",
  "callback": "https://your-server.com/webhook"
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | string | Yes | USDT amount (e.g. "100") |
| chain_id | integer | Yes | Chain ID: 56=BSC, 20=TRC20, 1=ERC20 |
| token_address | string | Yes | USDT contract address |
| recipient | string | Yes | User's wallet to receive USDT |
| callback | string | Yes | Webhook URL for state changes |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "payment_code": "USDT247-A3F8B2C1",
    "checkout_url": "https://checkout.sepay.vn/...",
    "direction": "buy",
    "usdt_amount": 100,
    "rate": 26500,
    "net_vnd": 2650000,
    "fee_rate": 0.008,
    "fee_vnd": 21200,
    "order_state": 1,
    "form_fields": {...}
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid partner key",
    "retriable": false,
    "trace_id": "req-123"
  }
}
```

---

### 2. Create Withdrawal Order (Sell USDT)

```
POST /api/orders/withdrawal
```

**Headers:**
```
Content-Type: application/json
Partner-App-Key: <your-partner-key>
```

**Body:**
```json
{
  "amount": "100",
  "chain_id": 56,
  "token_address": "0x55d39818f045F98f3F44C2E95c2B4dEd51F6f78a",
  "callback": "https://your-server.com/webhook",
  "payment_info": {
    "bank_id": "MBBank",
    "full_name": "NGUYEN VAN A",
    "account_type": 1,
    "account_number": "0123456789"
  }
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | string | Yes | USDT amount (sell amount) |
| chain_id | integer | Yes | Chain ID |
| token_address | string | Yes | USDT contract address |
| callback | string | Yes | Webhook URL for state changes |
| payment_info | object | Yes | Bank payout info |
| payment_info.bank_id | string | Yes | Bank name (MBBank, Techcombank, etc.) |
| payment_info.full_name | string | Yes | Account holder name (no accents) |
| payment_info.account_type | integer | Yes | Account type |
| payment_info.account_number | string | Yes | Account number |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "payment_code": "USDT247-B4C5D6E7",
    "direction": "sell",
    "usdt_amount": 100,
    "rate": 26500,
    "net_vnd": 2650000,
    "fee_rate": 0.008,
    "fee_vnd": 21200,
    "order_state": 1
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

**Example:**
```
GET /api/orders/USDT247-A3F8B2C1
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "payment_code": "USDT247-A3F8B2C1",
    "direction": "buy",
    "usdt_amount": 100,
    "rate": 26500,
    "net_vnd": 2650000,
    "fee_rate": 0.008,
    "fee_vnd": 21200,
    "order_state": 1,
    "payment_status": "pending",
    "transaction_hash": null,
    "error_message": null,
    "created_at": "2026-04-24T10:00:00.000Z",
    "updated_at": "2026-04-24T10:00:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found",
    "retriable": false,
    "trace_id": "req-123"
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

**Logic:**
- Only orders in `CREATED(1)` or `PROCESSING(2)` (without irreversible steps) can be cancelled
- If `PROCESSING` and payment already received (`sepay_transaction_id` set), cancellation is rejected

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payment_code": "USDT247-A3F8B2C1",
    "order_state": 5,
    "cancelled_at": "2026-04-24T10:00:00.000Z"
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

### 5. SePay Webhook (Deposit Confirmation)

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
  "transactionDate": "2026-04-24T10:00:00",
  "accountNumber": "0123456789",
  "code": "USDT247-A3F8B2C1",
  "content": "USDT247-A3F8B2C1",
  "transferType": "in",
  "transferAmount": 2650000,
  "accumulated": 2650000,
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

### 6. Chain Webhook (Withdrawal Completion)

```
POST /api/webhooks/chain
```

**Headers:**
```
X-Webhook-Timestamp: <unix-ms>
X-Webhook-Signature: HMAC-SHA256(secret, timestamp + "." + body_hex)
Content-Type: application/json
```

**Body:**
```json
{
  "order_key": "USDT247-B4C5D6E7",
  "tx_hash": "abc123...",
  "amount": "100.00",
  "address": "GA7ZFU7U6PRFWNK6W7LQHLQR7YLSSXEGQBWAFWALNQI2E3CR4THWIC2D",
  "chain_id": 56
}
```

**Validation:**
1. Timestamp replay check (5-minute window)
2. Signature verification against `CHAIN_WEBHOOK_SECRET`
3. Order lookup by `order_key`
4. Address must match `orders.recipient`
5. Amount must match `orders.usdt_amount` within 1% tolerance

**Response (200):**
```json
{
  "success": true
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "CHAIN_EVENT_MISMATCH",
    "message": "Address mismatch",
    "retriable": false,
    "trace_id": "req-123"
  }
}
```

---

## Webhook Callback

When order state changes, backend POSTs to client's `callback` URL:

**Headers:**
```
Content-Type: application/json
X-Timestamp: <unix-ms>
X-Signature: HMAC-SHA256(secret, timestamp + "." + body_hex)
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

### Callback Signature Verification (Node.js)

```javascript
const crypto = require('crypto');

function verifyCallback(secret, timestamp, body, signature) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
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
| 2 | PROCESSING | Payment confirmed, processing (disbursing/paying out) |
| 3 | COMPLETED | Order finished successfully |
| 4 | FAILED | Order failed |
| 5 | CANCELLED | Order cancelled |

**State Transitions:**
```
CREATED(1) → PROCESSING(2) → COMPLETED(3)
           ↘ FAILED(4)
CREATED(1) → CANCELLED(5)
PROCESSING(2) → CANCELLED(5) [only if no irreversible step]
```

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
| `CHAIN_EVENT_MISMATCH` | 400 | false | Chain event validation failed |

Every response includes `X-Trace-ID` header for debugging.

---

## Amount Units

- **Deposit**: `amount` is USDT (user pays VND to get USDT)
- **Withdrawal**: `amount` is USDT (user sends USDT to receive VND)
- Fee is calculated in VND and displayed alongside USDT amounts

---

## Environment Variables

Add to `.env`:

```env
# Partner API key (client → service auth)
PARTNER_APP_KEY=your-partner-key

# Callback webhook settings
CALLBACK_TIMEOUT_MS=8000
CALLBACK_RETRY_COUNT=3
CALLBACK_RETRY_DELAY_MS=5000

# Callback signature secret (shared with client)
CALLBACK_SIGNATURE_SECRET=min-32-char-secret

# Chain webhook secret (provider → service auth)
CHAIN_WEBHOOK_SECRET=your-webhook-secret

# Kafka (required for disbursement)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=payment_svc
KAFKA_DISBURSE_TOPIC=disburse_crypto

# Stellar (required for USDT transfer)
STELLAR_NETWORK=testnet
STELLAR_HOT_WALLET_NAME=stellar_hot_wallet
STELLAR_HOT_WALLET_ENCRYPTION_KEY=32-char-key
```

---

## Swagger UI

Full API docs at: `http://<server-ip>:3000/docs`

---

## Complete Flow

### Buy USDT (Deposit)

1. **Client** → `POST /api/orders/deposit` with USDT amount + recipient + callback
2. **Server** → Returns `payment_code`, `checkout_url`, bank info
3. **Client** → Shows QR code / bank transfer instructions
4. **User** → Banks transfer VND with content = `payment_code`
5. **SePay** → `POST /api/webhooks/sepay`
6. **Server** → Updates order to PROCESSING, emits to Kafka
7. **Worker** → Consumes Kafka, sends USDT via Stellar, updates to COMPLETED
8. **Server** → POSTs callback with new state (includes HMAC signature)

### Sell USDT (Withdrawal)

1. **Client** → `POST /api/orders/withdrawal` with USDT amount + bank info + callback
2. **Server** → Returns `payment_code`, order in CREATED state
3. **User** → Sends USDT to our hot wallet
4. **External system** → Detects USDT received → `POST /api/webhooks/chain`
5. **Server** → Validates, updates to PROCESSING
6. **Server** → Executes VND payout (stub), updates to COMPLETED
7. **Server** → POSTs callback with new state

---

## Callback Retry

Callbacks are retried up to 3 times with 5-second delays between attempts. All attempts are logged to `callback_logs` table for visibility.

Failed callbacks can be queried:
```sql
SELECT * FROM callback_logs WHERE status = 'failed' ORDER BY created_at DESC;
```