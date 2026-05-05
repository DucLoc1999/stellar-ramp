# Stellar Signer Worker

Cloudflare Worker for securely signing and submitting Stellar XLM payments.

## Environment

- `STELLAR_PRIVATE_KEY`: Cloudflare Secret containing the source account secret key starting with `S`
- `INTERNAL_AUTH_TOKEN`: Cloudflare Secret used as the bearer token

## Setup

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

Use `token_address` and `token_code` for token transfers. Omit them for native XLM payments.

## Response

```json
{
  "success": true,
  "hash": "...",
  "ledger": 123456
}
```
