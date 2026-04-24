# API Integration Guide

## Base URL

```
http://<server-ip>:3000
```

## Endpoints

### 1. Create Deposit Order (Buy USDT)

```
POST /api/orders/deposit
```

**Headers:**
```
Content-Type: application/json
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

---

### 2. Get Order Status

```
GET /api/orders/:payment_code
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
    "order_state": 1,
    "payment_status": "pending"
  }
}
```

---

### 3. SePay Webhook (for deposit confirmation)

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

## Webhook Callback

When order state changes, backend POSTs to `callback` URL:

```json
{
  "id": "order_id",
  "topic": "order.state.change",
  "ts": 1714034400000,
  "payload": {
    "order_id": 1,
    "old_order_state": 1,
    "new_order_state": 2
  }
}
```

**Order States:**
| State | Name |
|-------|------|
| 1 | CREATED |
| 2 | PROCESSING |
| 3 | COMPLETED |
| 4 | FAILED |
| 5 | CANCELLED |

---

## Complete Flow

1. **Client** → `POST /api/orders/deposit`
2. **Server** → Returns `payment_code`, `checkout_url`, bank info
3. **Client** → Shows QR code / bank transfer instructions
4. **User** → Banks transfer VND with content = `payment_code`
5. **SePay** → `POST /api/webhooks/sepay` (or client polls)
6. **Server** → Updates order to PROCESSING, emits to Kafka
7. **Worker** → Consumes Kafka, sends USDT via Stellar, updates to COMPLETED
8. **Server** → POSTs callback with new state

---

## Environment Variables

Add to `.env`:

```env
# Kafka (required for disbursement)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=payment_svc
KAFKA_DISBURSE_TOPIC=disburse_crypto
KAFKA_ORDER_PAID_TOPIC=order_paid

# Stellar (required for USDT transfer)
STELLAR_NETWORK=testnet
STELLAR_HOT_WALLET_NAME=stellar_hot_wallet
STELLAR_HOT_WALLET_ENCRYPTION_KEY=<32-char-key>
```

---

## Swagger UI

Full API docs at: `http://<server-ip>:3000/docs`