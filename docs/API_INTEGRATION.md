# API Integration Guide

## Base URL

```
http://localhost:3000
```

---

## Authentication

### Client → Service (Partner-App-Key)

All order API endpoints require the `Partner-App-Key` header:

```
Partner-App-Key: <your-partner-key>
```

Endpoints requiring auth:
- `POST /api/orders/deposit`
- `POST /api/orders/withdrawal`
- `GET /api/orders/:id`
- `POST /api/orders/:id/cancel`

### Provider → Service Webhooks

**SePay** uses API key auth:
```
Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>
```

**Stellar incoming** (fallback when Kafka unavailable):
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

| Asset Code | Type | Token Address | Description |
|------------|------|---------------|-------------|
| `USDC` | Token | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | USDC on Stellar |
| `XLM` | Native | Empty string (`""`) | Stellar Lumens (no token address needed) |

---

## Rate Endpoints

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
    "code": "DH123456",
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
        "transferContent": "DH123456",
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
    "code": "DH789012",
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

**Important:** After creating a withdrawal order, the client must send the crypto to `pay_data.address` with the **payment code as the Stellar memo**. Example: send 10 XLM to `Ghotwallet...` with memo `DH789012`.

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
    "code": "DH123456",
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

**Logic:**
- Only orders in `CREATED(1)` or `PROCESSING(2)` (without irreversible steps) can be cancelled
- For sell orders: if USDC already received at hot wallet, cancellation is rejected

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payment_code": "DH123456",
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
  "code": "DH123456",
  "content": "DH123456",
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

Used when `stellar-listener` cannot reach Kafka and falls back to HTTP POST.

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
  "memo": "DH789012"
}
```

**Response (200):**
```json
{
  "success": true
}
```

---

### 7. Chain Webhook (Sell — External System Trigger)

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
  "order_key": "DH789012",
  "tx_hash": "abc123...",
  "amount": "10.00",
  "address": "GABC123...YZ",
  "chain_id": 1,
  "token_address": "",
  "asset_code": "XLM"
}
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Webhook Callback to Client

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

**State Transitions:**
```
CREATED(1) → PROCESSING(2) → COMPLETED(3)
           ↘ FAILED(4)
CREATED(1) → CANCELLED(5)
```

---

## Processing States

Processing states track detailed progress within each flow.

### Buy Flow (Deposit)

| State | Value | Description |
|-------|-------|-------------|
| BUY_ORDER_CREATED | 10 | Order created, waiting for VND |
| BUY_DISBURSE_COMPLETED | 14 | USDC disbursed to recipient |
| BUY_DISBURSE_FAILED | 15 | USDC disbursement failed |

### Sell Flow (Withdrawal)

| State | Value | Description |
|-------|-------|-------------|
| SELL_CREATED | 10 | Order created, waiting for crypto |
| SELL_PAYMENT_RECEIVED | 12 | Crypto received at hot wallet |
| SELL_PAYOUT_COMPLETED | 13 | VND payout completed |
| SELL_PAYOUT_FAILED | 14 | VND payout failed |

---

## Complete Flow

### Buy Crypto (Deposit)

1. **Client** → `POST /api/orders/deposit` with amount + asset + recipient + callback
2. **Server** → Returns `code`, bank info, `transferContent` (payment code)
3. **Client** → Shows QR code / bank transfer instructions
4. **User** → Transfers VND to SePay with content = `code`
5. **SePay** → `POST /api/webhooks/sepay`
6. **Server** → Updates order to PROCESSING, triggers USDC disbursement via Stellar
7. **Worker** → Sends USDC via Stellar to recipient wallet
8. **Server** → Updates to COMPLETED, POSTs callback with new state

### Sell Crypto (Withdrawal)

1. **Client** → `POST /api/orders/withdrawal` with amount + asset + bank info + callback
2. **Server** → Returns `code`, hot wallet address in `pay_data`
3. **Client** → Instructs user to send crypto to `pay_data.address` with `code` as memo
4. **stellar-listener** → Detects incoming tx (Kafka or HTTP fallback)
5. **Worker/Webhook** → Matches tx to order, validates, updates to PROCESSING
6. **Server** → Executes VND payout to bank via PayOS
7. **Server** → Updates to COMPLETED/FAILED, POSTs callback with new state

---

## Amount Calculation

**Buy (Deposit):**
```
net_vnd = amount × rate + fee_vnd
fee_vnd = max(amount × rate × fee_rate, 5000)
```

**Sell (Withdrawal):**
```
net_vnd = amount × rate - fee_vnd
fee_vnd = max(amount × rate × fee_rate, 5000)
```

Example for buying 10 XLM at rate 4490 VND:
- gross_vnd = 10 × 4490 = 44,900 VND
- fee_vnd = max(44,900 × 0.008, 5000) = 5000 VND (min fee)
- net_vnd = 44,900 + 5000 = 49,900 VND

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

## Environment Variables

```env
# Partner API key (client → service auth)
PARTNER_APP_KEY=your-partner-key

# Callback webhook settings
CALLBACK_TIMEOUT_MS=8000
CALLBACK_RETRY_COUNT=3
CALLBACK_RETRY_DELAY_MS=5000

# Callback signature secret (shared with client)
CALLBACK_SIGNATURE_SECRET=min-32-char-secret

# SePay webhook API key (provider → service auth)
SEPAY_WEBHOOK_API_KEY=

# Chain webhook secret (provider → service auth)
CHAIN_WEBHOOK_SECRET=

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=payment_svc
KAFKA_DISBURSE_TOPIC=disburse_crypto
KAFKA_ORDER_PAID_TOPIC=order_paid
KAFKA_TOKEN_IN_TOPIC=stellar_token_in

# Stellar
STELLAR_NETWORK=testnet
STELLAR_HOT_WALLET_NAME=stellar_hot_wallet
STELLAR_HOT_WALLET_ENCRYPTION_KEY=32-char-key

# Payout (PayOS — VND bank transfer)
PAYOUT_MODE=stub
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=

# CoinGecko API key (for XLM price, optional)
COINGECKO_API_KEY=
```

---

## Swagger UI

Full API docs at: `http://<server-ip>:3000/docs`

---

## Callback Retry

Callbacks are retried up to 3 times with 5-second delays between attempts. All attempts are logged to `callback_logs` table.

Failed callbacks can be queried:
```sql
SELECT * FROM callback_logs WHERE status = 'failed' ORDER BY created_at DESC;
```