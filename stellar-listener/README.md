# Stellar Listener

Monitors Stellar wallet addresses for incoming token payments and forwards events to Kafka or HTTP fallback.

## Prerequisites

- Node.js 18+
- Access to Stellar Horizon (testnet or public)
- Kafka broker (optional, fallback to HTTP if not available)

## Installation

Install the required dependency in the project root:

```bash
npm install js-yaml @types/js-yaml --save-dev
```

## Configuration

Edit `config.yaml`:

```yaml
stellar:
  network: testnet                # testnet | public
  wallets:
    - address: "G..."
      label: "hot_wallet_1"

assets:
  - code: "USDC"
    issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"

kafka:
  brokers: "localhost:9092"
  client_id: "payment_svc"
  topic: "stellar_token_in"

fallback:
  enabled: true
  url: "http://localhost:3000/api/webhooks/stellar-incoming"
  auth_token: ""
  timeout_ms: 10000
```

### Config Fields

| Section | Field | Description |
|---------|-------|-------------|
| `stellar.network` | | `testnet` or `public` (mainnet) |
| `stellar.wallets` | address | Stellar public key to monitor |
| | label | Friendly label for the wallet |
| `assets` | code | Token code (e.g., USDC, XLM) |
| | issuer | Token issuer public key (empty for native XLM) |
| `kafka.brokers` | | Comma-separated Kafka broker addresses. If `localhost:9092` or empty, Kafka is disabled and fallback is used. |
| `kafka.client_id` | | Kafka client ID |
| `kafka.topic` | | Target Kafka topic |
| `fallback.enabled` | | Enable HTTP fallback |
| `fallback.url` | | POST endpoint URL |
| `fallback.auth_token` | | Bearer token for auth (optional) |
| `fallback.timeout_ms` | | Request timeout in ms |

## Running

### Via tsx (development)

```bash
npx tsx stellar-listener/src/index.ts
```

### Via npm script (in project root)

```bash
npm run worker:stellar-listen
```

## Output Behavior

1. **Kafka configured**: Events are sent to Kafka topic. If Kafka fails, fallback is attempted.
2. **Kafka not configured**: Events are sent via HTTP POST to `fallback.url` only.
3. **Fallback disabled + no Kafka**: Script exits with error.

## Message Schema

### Kafka / HTTP Payload

```json
{
  "txHash": "a1b2c3...",
  "from": "GABC...",
  "to": "GDEF...",
  "amount": "100.0000000",
  "asset": "USDC",
  "tokenIssuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  "timestamp": "2026-05-13T10:00:00Z",
  "walletLabel": "hot_wallet_1"
}
```

### HTTP Headers

```
Content-Type: application/json
Authorization: Bearer <auth_token>   (if configured)
```

## Graceful Shutdown

- `SIGINT` / `SIGTERM` closes all SSE streams and disconnects Kafka producer before exit.

## Future Enhancements

- Local retry queue for failed events
- Cursor persistence (start from last processed ledger)
- Metrics / health check endpoint