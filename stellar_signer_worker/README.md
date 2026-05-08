# Stellar Signer Worker

Cloudflare Worker for securely signing and submitting Stellar XLM/USDC payments.

## Responsibilities

**This worker only handles source wallet validation:**
- Checks XLM balance ≥ 0.00001 (gas for fees)
- For token transfers: checks source has trustline + sufficient balance
- Signs and submits Stellar transaction

**Client/recipient validation is done by payment_svc before calling this worker.**

## Environment

```bash
npm install
npx wrangler secret put STELLAR_PRIVATE_KEY
npx wrangler secret put INTERNAL_AUTH_TOKEN
npx wrangler deploy
```

## Request

`POST /`

Headers:

```http
Authorization: Bearer <INTERNAL_AUTH_TOKEN>
Content-Type: application/json
```

Body:

```json
{
  "destination": "G...",
  "amount": "1.25",
  "memo": "optional memo",
  "network": "TESTNET",
  "token_code": "USDC",
  "token_address": "G..."
}
```

- Omit `token_code` + `token_address` for native XLM payments
- Include both for token transfers (USDC, etc.)

## Response

```json
{
  "success": true,
  "hash": "...",
  "ledger": 123456
}
```

## Error Codes

| Error | Cause |
|-------|-------|
| `INSUFFICIENT_GAS` | XLM balance < 0.00001 |
| `WALLET_NO_TRUSTLINE` | Source missing trustline |
| `WALLET_NOT_AUTHORIZED` | Source trustline frozen |
| `INSUFFICIENT_TOKEN_BALANCE` | Source has less tokens than payment amount |
