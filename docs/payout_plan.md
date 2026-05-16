# Sell Flow Integration Plan

## Goal

Complete the sell (crypto → VND) workflow end-to-end, matching the buy flow's reliability. Detect incoming USDC to hot wallet, match to sell order, execute VND payout via PayOS, update states, fire callbacks.

---

## Requirements

1. **Detect incoming USDC/XLM** to hot wallet via `stellar-listener`
2. **Match incoming tx** by Stellar memo (`payment_code`) with fallback to amount-based matching
3. **Execute VND payout** to client's bank account via PayOS
4. **Update order state**: CREATED(1) → PROCESSING(2) → COMPLETED(3) / FAILED(4)
5. **Fire callbacks** on every state transition
6. **Support HTTP fallback** when Kafka unavailable (post to `/api/webhooks/stellar-incoming`)
7. **Sell bypass endpoint** for admin/dev (mirrors buy bypass)
8. **Fix buy flow bug** — `disburseUSDC` wrong `where` guard in `confirmPayment`

---

## ProcessingState Enum

**File:** `src/models/types.ts`

```typescript
export const ProcessingState = {
  // Sell flow
  SELL_CREATED: 10,
  SELL_PAYMENT_RECEIVED: 12,
  SELL_PAYOUT_COMPLETED: 13,
  SELL_PAYOUT_FAILED: 14,
  // Buy flow (existing — preserved)
  BUY_DISBURSE_COMPLETED: 14,
  BUY_DISBURSE_FAILED: 15,
} as const;
```

State transitions (sell):

| Step | Order State | Processing State | Payment Status | Action |
|---|---|---|---|---|
| Create order | 1 CREATED | 10 | pending | INSERT, fire callback 0→1 |
| Incoming tx matched | 1→2 PROCESSING | 10→12 | pending→payment_received | validate, store tx_hash, fire callback 1→2 |
| PayOS payout success | 2→3 COMPLETED | 12→13 | payment_received | fire callback 2→3, emit `order_paid` |
| PayOS payout failure | 2→4 FAILED | 12→14 | payment_received | fire callback 2→4 |

---

## User Flow

```
1. Client → POST /api/orders/withdrawal  { amount, asset_code, payment_info, callback }
2. Service creates order (CREATED, processing_state=10)
   └─ fires callback: 0 → CREATED(1)
   └─ returns: { pay_data: { address: <hot_wallet_pubkey> } }
3. Client sends USDC + payment_code (memo) to hot wallet
4. stellar-listener detects incoming tx
   ├─ If Kafka available → emit to "stellar_token_in" topic
   └─ If Kafka not available → POST to /api/webhooks/stellar-incoming
5. Consumer (worker or webhook handler):
   a. Match by memo → finds sell order
      OR match by amount + asset within tolerance (fallback)
   b. Validate sender/token/amount
   c. Updates: payment_status='payment_received', order_state=PROCESSING(2), processing_state=12
   d. Fires callback: CREATED(1) → PROCESSING(2)
   e. Executes VND payout via PayOS
      └─ Success: order_state=COMPLETED(3), processing_state=13, fires callback PROCESSING(2)→COMPLETED(3)
      └─ Failure: order_state=FAILED(4), processing_state=14, fires callback PROCESSING(2)→FAILED(4)
   f. Emits `order_paid` Kafka event on completion
```

---

## Auth

**`/api/webhooks/stellar-incoming`** — uses `sepayAuth` middleware (same as SePay):
```
Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>
```
Header `authorization` must equal `Apikey <SEPAY_WEBHOOK_API_KEY>`. No HMAC, no timestamp/replay protection — same as SePay webhook.

---

## PayOS Integration

**Provider:** PayOS (`@payos/node`) — LIVE payout mode  
**Stub:** `PAYOUT_MODE=stub` for dev (1s sleep, returns success)

### PayoutRequest shape
```typescript
interface PayoutRequest {
  orderId: number;
  amount: number;         // net_vnd in VND
  bankId: string;          // BIN e.g. '970422'
  bankAccountName: string; // account holder name
  bankAccountNo: string;   // account number
  description?: string;    // payment_code as reference
}
```

### PayOS call
```typescript
payOS.payouts.batch.create({
  referenceId: `payout_${orderId}_${Date.now()}`,
  category: ['withdrawal'],
  validateDestination: true,
  payouts: [{
    referenceId: `payout_${orderId}_1`,
    amount: req.amount,
    description: req.description || `Withdrawal ${req.orderId}`,
    toBin: req.bankId,
    toAccountNumber: req.bankAccountNo,
    toAccountName: req.bankAccountName,  // included for validation
  }],
});
```

---

## Features

### F1 — VND Payout Worker (primary path)

**File:** `src/workers/vndPayoutWorker.ts`

Consumes `stellar_token_in` Kafka topic (`KAFKA_TOKEN_IN_TOPIC`).

```
stellar_token_in → VndPayoutWorker → orderService.processSellPayment()
```

**Message shape:**
```json
{
  "txHash": "...",
  "from": "G...",
  "to": "G...",
  "amount": "100.0000000",
  "asset": "USDC",
  "tokenIssuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  "timestamp": "...",
  "walletLabel": "hot_wallet_1",
  "memo": "DHA1B2C3D4E5"
}
```

**Logic:**
1. Parse message `{ txHash, from, to, amount, asset, tokenIssuer, memo? }`
2. Find sell order: `payment_code = memo`, `direction='sell'`, `order_state=CREATED`
   - Fallback: `usdt_amount` within 1% tolerance, ordered by `created_at ASC`
3. Validate asset, tokenIssuer, amount (1% tolerance)
4. Update: `payment_status='payment_received'`, `order_state=PROCESSING(2)`, `processing_state=12`, `transaction_hash=txHash`
5. Fire callback: `1→2, 10→12`
6. Execute VND payout via `payoutService.executePayout()`
   - Success: `order_state=COMPLETED(3)`, `processing_state=13`, fire callback `2→3, 12→13`, emit `order_paid`
   - Failure: `order_state=FAILED(4)`, `processing_state=14`, fire callback `2→4, 12→14`
7. Retry: 3 attempts (1s / 5s / 15s delays). On max retries → mark FAILED
8. Emit `order_paid` Kafka event on success

**Pattern:** mirrors `src/workers/disburseWorker.ts` exactly

---

### F2 — VND Payout Service

**File:** `src/services/payoutService.ts`

Handles PayOS batch payout.

```typescript
interface PayoutRequest {
  orderId: number;
  amount: number;         // net_vnd in VND
  bankId: string;
  bankAccountName: string;
  bankAccountNo: string;
  description?: string;
}

interface PayoutResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export async function executePayout(req: PayoutRequest, forceStub = false): Promise<PayoutResult>
```

- **STUB mode** (`PAYOUT_MODE=stub` or `forceStub=true`): sleep 1s, return `{ success: true, transactionId: 'stub-<timestamp>' }`
- **LIVE mode** (`PAYOUT_MODE=live`): call `payOS.payouts.batch.create()`, return batch `id` as `transactionId`

Env vars: `PAYOUT_MODE`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`

---

### F3 — Stellar Incoming Webhook (HTTP fallback)

**File:** `src/routes/webhookRoutes.ts` + `src/controllers/webhookController.ts`

**Route:** `POST /api/webhooks/stellar-incoming`  
**Auth:** `sepayAuth` (Apikey header)

```typescript
// src/routes/webhookRoutes.ts
app.post('/stellar-incoming', {
  preHandler: sepayAuth,
  schema: {
    body: {
      type: 'object',
      required: ['txHash', 'amount', 'asset'],
      properties: {
        txHash: { type: 'string' },
        from: { type: 'string' },
        amount: { type: 'string' },
        asset: { type: 'string' },
        tokenIssuer: { type: 'string' },
        memo: { type: 'string' },
      },
    },
  },
}, handleStellarIncoming);
```

**Handler:** `handleStellarIncoming` in `webhookController.ts` — calls `processSellPayment()` directly (same logic as worker, synchronous).

---

### F4 — Sell Bypass Endpoint (admin/dev)

**File:** `src/routes/bypassRoutes.ts`

```http
POST /bypass-sell-payment
Body: { admin_key, order_id }
```

**Service:** `bypassSellPayment(adminKey, orderId)` in `orderService.ts`
- Admin key check (same as `bypassPayment`)
- Validate `direction='sell'`, order in CREATED state, payment still pending
- Calls `processSellPayment()` with `forceStub=true`
- Returns `{ success: true }` or `{ error: '...' }`

---

### F5 — Stellar-listener Memo Capture

**File:** `stellar-listener/src/index.ts`

In `processTransaction`, extract `tx.memo` and `tx.memo_type` and include in emitted `TokenTransferEvent`:

```typescript
const event: TokenTransferEvent = {
  txHash: tx.hash,
  memo: tx.memo || '',
  memoType: tx.memo_type || '',
  from: op.from,
  to: op.to,
  amount,
  asset: assetCode,
  tokenIssuer,
  timestamp,
  walletLabel,
};
```

Update `TokenTransferEvent` interface: add `memo?: string; memoType?: string;`.

---

### F6 — Fix Buy Flow Bug

**File:** `src/services/stellarService.ts`

In `confirmPayment` (~line 193), before calling `triggerDisburse`:

```typescript
await db('orders')
  .where({ payment_code: params.payment_code })
  .update({ order_state: OrderState.PROCESSING });
```

**Why:** `disburseUSDC` has `where({ order_state: OrderState.PROCESSING })` guard, but order is still CREATED when `triggerDisburse` is called. Setting state to PROCESSING before call fixes the guard.

**Deferred:** premature COMPLETED callback fix (Kafka path) — lower priority, non-blocking for sell flow.

---

## Env Vars to Add

**`.env.example`:**
```
PAYOUT_MODE=stub
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
```

---

## Package Changes

**`package.json`:**
- Add `@payos/node` to dependencies
- Add script: `"worker:vnd-payout": "tsx src/workers/vndPayoutWorker.ts"`

---

## Files Summary

### Files to Create
| File | Purpose |
|---|---|
| `src/services/payoutService.ts` | PayOS VND payout (stub + live) |
| `src/workers/vndPayoutWorker.ts` | Kafka consumer for `stellar_token_in` |

### Files to Modify
| File | Changes |
|---|---|
| `src/models/types.ts` | Add `ProcessingState` enum |
| `src/services/orderService.ts` | Add `processSellPayment()`, `bypassSellPayment()`, remove `handleChainEvent()`, fix F6 |
| `src/services/stellarService.ts` | Fix `confirmPayment` — set order_state=PROCESSING before `triggerDisburse` |
| `src/controllers/webhookController.ts` | Add `handleStellarIncoming` handler |
| `src/routes/webhookRoutes.ts` | Add `POST /api/webhooks/stellar-incoming` (sepayAuth) |
| `src/routes/bypassRoutes.ts` | Add `POST /bypass-sell-payment` |
| `stellar-listener/src/index.ts` | Capture memo in `TokenTransferEvent` |
| `.env.example` | Add `PAYOUT_MODE`, `PAYOS_*` vars |
| `package.json` | Add `@payos/node` dep + worker script |

---

## Reference Files

| File | What it provides |
|---|---|
| `src/workers/disburseWorker.ts` | Worker pattern (retry, DB update, emit events) |
| `src/services/orderService.ts:286-330` | `createWithdrawal()` — sell order creation |
| `src/services/orderService.ts:475-512` | `bypassPayment()` — buy bypass pattern |
| `src/services/orderService.ts:182-212` | `confirmPayment()` — where F6 bug lives |
| `src/services/callbackService.ts` | Callback firing with retry + HMAC |
| `src/services/queueService.ts` | `emitOrderPaid`, `emitDisburseCrypto` |
| `src/routes/bypassRoutes.ts` | Bypass route pattern |
| `src/middlewares/sepayAuth.ts` | Apikey auth (used by stellar-incoming) |
| `src/middlewares/errorHandler.ts` | Error codes and reply format |
| `stellar-listener/src/index.ts` | Stellar tx detection, Kafka emit, HTTP fallback |
| `.env.example` | All env vars reference |

---

## Implementation Order

1. **A1 + A2** — Add `ProcessingState` enum to `types.ts`, add env vars to `.env.example`, add `@payos/node` to `package.json`
2. **A3** — Create `payoutService.ts` (stub + live PayOS)
3. **A4** — Create `vndPayoutWorker.ts` (Kafka consumer)
4. **A5** — Update `stellar-listener` to emit memo
5. **B1** — Add `processSellPayment()` to `orderService.ts` (replaces `handleChainEvent`)
6. **B2** — Add `bypassSellPayment()` to `orderService.ts`
7. **B3** — Fix F6: set `order_state=PROCESSING` in `confirmPayment`
8. **B4** — Add `handleStellarIncoming` to `webhookController.ts`
9. **B5** — Add route to `webhookRoutes.ts`
10. **B6** — Add `/bypass-sell-payment` to `bypassRoutes.ts`

---

---

# Plan A — Payout Infrastructure

> Files: `payoutService.ts`, `vndPayoutWorker.ts`, `types.ts`, `.env.example`, `package.json`, `stellar-listener/src/index.ts`
>
> Agent: Implement independently. No dependency on Plan B files.

## A1 — `src/models/types.ts` — Add ProcessingState enum

Add after existing `OrderState` export:

```typescript
export const ProcessingState = {
  SELL_CREATED: 10,
  SELL_PAYMENT_RECEIVED: 12,
  SELL_PAYOUT_COMPLETED: 13,
  SELL_PAYOUT_FAILED: 14,
  BUY_DISBURSE_COMPLETED: 14,
  BUY_DISBURSE_FAILED: 15,
} as const;
```

## A2 — `.env.example` — Add payout vars

Add at end:

```
PAYOUT_MODE=stub
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
```

## A3 — `package.json` — Add dep + script

- Add `@payos/node` to `dependencies`
- Add to `scripts`: `"worker:vnd-payout": "tsx src/workers/vndPayoutWorker.ts"`

## A4 — `src/services/payoutService.ts` — Create

```typescript
import { PayOS } from '@payos/node';

export interface PayoutRequest {
  orderId: number;
  amount: number;
  bankId: string;
  bankAccountName: string;
  bankAccountNo: string;
  description?: string;
}

export interface PayoutResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

let payOSInstance: PayOS | null = null;

function getPayOS(): PayOS {
  if (!payOSInstance) {
    payOSInstance = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID!,
      apiKey: process.env.PAYOS_API_KEY!,
      checksumKey: process.env.PAYOS_CHECKSUM_KEY!,
    });
  }
  return payOSInstance;
}

export async function executePayout(req: PayoutRequest, forceStub = false): Promise<PayoutResult> {
  if (process.env.PAYOUT_MODE === 'stub' || forceStub) {
    await new Promise((r) => setTimeout(r, 1000));
    return { success: true, transactionId: `stub-${Date.now()}` };
  }

  const payOS = getPayOS();
  try {
    const batch = await payOS.payouts.batch.create({
      referenceId: `payout_${req.orderId}_${Date.now()}`,
      category: ['withdrawal'],
      validateDestination: true,
      payouts: [{
        referenceId: `payout_${req.orderId}_1`,
        amount: req.amount,
        description: req.description || `Withdrawal ${req.orderId}`,
        toBin: req.bankId,
        toAccountNumber: req.bankAccountNo,
        toAccountName: req.bankAccountName,
      }],
    });
    return { success: true, transactionId: batch.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
```

## A5 — `src/workers/vndPayoutWorker.ts` — Create

Follow `disburseWorker.ts` pattern exactly:

- Consume topic from env `KAFKA_TOKEN_IN_TOPIC` (default: `stellar_token_in`)
- Message interface:
  ```typescript
  interface StellarTokenInEvent {
    txHash: string;
    from: string;
    to: string;
    amount: string;
    asset: string;
    tokenIssuer: string;
    memo?: string;
    walletLabel: string;
  }
  ```
- Import and call `processSellPayment` from orderService:
  ```typescript
  import { processSellPayment } from '../services/orderService';
  // in process loop:
  await processSellPayment({ txHash, from, amount, asset, tokenIssuer, memo });
  ```
- Retry: 3 attempts with 1s/5s/15s delays. On max retries → mark FAILED with processing_state=14, fire callback
- On success: emit `order_paid` via `emitOrderPaid` from queueService
- Same SIGINT cleanup, Kafka consumer group `${clientId}-vnd-payout-group`

## A6 — `stellar-listener/src/index.ts` — Capture memo

**TokenTransferEvent interface** — add:
```typescript
memo?: string;
memoType?: string;
```

**processTransaction** — in event building (~line 193):
```typescript
const event: TokenTransferEvent = {
  txHash: tx.hash,
  memo: tx.memo || '',
  memoType: tx.memo_type || '',
  from: op.from,
  // ... rest unchanged
};
```

---

---

# Plan B — Order Flow Integration

> Files: `orderService.ts`, `stellarService.ts`, `webhookController.ts`, `webhookRoutes.ts`, `bypassRoutes.ts`
>
> Agent: Implement independently. No dependency on Plan A files.

## B1 — `src/services/orderService.ts` — processSellPayment + bypassSellPayment

### Remove
- `handleChainEvent()` (lines 421-473) — entirely replaced by `processSellPayment`

### Add: processSellPayment

```typescript
export async function processSellPayment(params: {
  txHash: string;
  from?: string;
  amount: string;
  asset: string;
  tokenIssuer?: string;
  memo?: string;
}): Promise<{ success: boolean; error?: string }>
```

**Logic:**
1. **Find order:**
   - If `memo` non-empty: `db('orders').where({ payment_code: memo, direction: 'sell', order_state: OrderState.CREATED }).first()`
   - Fallback: amount within 1% tolerance, `direction='sell'`, `order_state=CREATED`, ordered by `created_at ASC`
2. **Validate:**
   - Order exists
   - Asset matches `order.asset_code`
   - Token issuer matches `order.token_address`
   - Amount within 1% of `order.usdt_amount`
3. **Update to PROCESSING:**
   ```typescript
   await db('orders').where({ id: order.id }).update({
     payment_status: 'payment_received',
     order_state: OrderState.PROCESSING,
      processing_state: 12,  // ProcessingState.SELL_PAYMENT_RECEIVED
     transaction_hash: txHash,
   });
   ```
4. **Fire callback:** `fireCallback(order.callback, order.id, 1, 2, 10, 12)` (oldState→newState, oldProc→newProc)
5. **Parse payment_info** for bank details:
   ```typescript
   const payInfo = typeof order.payment_info === 'string'
     ? JSON.parse(order.payment_info)
     : order.payment_info;
   ```
6. **Execute payout:**
   ```typescript
   const payoutResult = await executePayout({
     orderId: order.id,
     amount: Number(order.net_vnd),
     bankId: order.bank_id || payInfo?.bank_id,
     bankAccountName: order.bank_account_name || payInfo?.full_name,
     bankAccountNo: order.bank_account_no || payInfo?.account_number,
     description: order.payment_code,
   });
   ```
7. **Result:**
   - **Success:** update to `order_state=COMPLETED(3)`, `processing_state=13`, fire callback `2→3, 12→13`, call `emitOrderPaid({ orderId, amount, txHash, paymentCode })`
   - **Failure:** update to `order_state=FAILED(4)`, `processing_state=14`, fire callback `2→4, 12→14`
8. **Retry:** call payout up to 3 times before marking failed

Import at top:
```typescript
import { executePayout } from './payoutService';
import { emitOrderPaid } from './queueService';
```

### Add: bypassSellPayment

```typescript
export async function bypassSellPayment(adminKey: string, orderId: number): Promise<{ success?: boolean; error?: string }> {
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!bootstrapPassword || adminKey !== bootstrapPassword) {
    return { error: 'INVALID_ADMIN_CODE' };
  }

  const order = await db('orders').where({ id: orderId }).first();
  if (!order) return { error: 'ORDER_NOT_FOUND' };
  if (order.direction !== 'sell') return { error: 'NOT_SELL_ORDER' };
  if (order.order_state !== OrderState.CREATED) return { error: 'ORDER_NOT_ELIGIBLE' };
  if (order.payment_status !== 'pending') return { error: 'PAYMENT_ALREADY_RECEIVED' };

  const result = await processSellPayment({
    txHash: `bypass-${Date.now()}`,
    amount: String(order.usdt_amount),
    asset: order.asset_code || 'USDC',
    tokenIssuer: order.token_address,
    // use order.payment_code directly
  });

  return result.success ? { success: true } : { error: result.error };
}
```

## B2 — `src/services/stellarService.ts` — Fix F6

In `confirmPayment` (~line 193, before the `triggerDisburse` call), add:

```typescript
await db('orders')
  .where({ payment_code: params.payment_code })
  .update({ order_state: OrderState.PROCESSING });
```

This ensures the order is PROCESSING when `disburseUSDC` checks `where({ order_state: OrderState.PROCESSING })`.

## B3 — `src/controllers/webhookController.ts` — Add handleStellarIncoming

Add import:
```typescript
import { processSellPayment } from '../services/orderService';
```

Add handler:
```typescript
interface StellarIncomingBody {
  txHash: string;
  from?: string;
  amount: string;
  asset: string;
  tokenIssuer?: string;
  memo?: string;
}

export async function handleStellarIncoming(
  req: FastifyRequest<{ Body: StellarIncomingBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { txHash, from, amount, asset, tokenIssuer, memo } = req.body;
  const result = await processSellPayment({ txHash, from, amount, asset, tokenIssuer, memo });
  if (!result.success) {
    return createErrorReply(reply, 'CHAIN_EVENT_MISMATCH', result.error || 'Processing failed', req.id);
  }
  return reply.send({ success: true });
}
```

## B4 — `src/routes/webhookRoutes.ts` — Add stellar-incoming route

Add after the sepay route (sepayAuth is pre-applied globally):

```typescript
app.post('/stellar-incoming', {
  preHandler: sepayAuth,
  schema: {
    tags: ['Webhooks'],
    summary: 'Stellar incoming webhook — fallback when Kafka unavailable',
    body: {
      type: 'object',
      required: ['txHash', 'amount', 'asset'],
      properties: {
        txHash: { type: 'string' },
        from: { type: 'string' },
        amount: { type: 'string' },
        asset: { type: 'string' },
        tokenIssuer: { type: 'string' },
        memo: { type: 'string' },
      },
    },
    response: {
      200: { type: 'object', properties: { success: { type: 'boolean' } } },
      400: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'object' } } },
    },
  },
}, handleStellarIncoming);
```

Import handler:
```typescript
import { handleStellarIncoming } from '../controllers/webhookController';
```

## B5 — `src/routes/bypassRoutes.ts` — Add bypass-sell-payment

Add route after existing `/bypass-payment`:

```typescript
app.post<{ Body: { admin_key: string; order_id: number } }>('/bypass-sell-payment', {
  schema: {
    tags: ['Bypass'],
    summary: 'Bypass payment for sell order (admin key)',
    body: {
      type: 'object',
      required: ['admin_key', 'order_id'],
      properties: {
        admin_key: { type: 'string' },
        order_id: { type: 'integer' },
      },
    },
  },
}, async (req, reply) => {
  const { admin_key, order_id } = req.body;
  const { bypassSellPayment } = await import('../services/orderService');
  const result = await bypassSellPayment(admin_key, order_id);
  if (result.error) return reply.status(400).send({ success: false, error: result.error });
  return reply.send({ success: true });
});
```

---

## Plan B Dependencies on Plan A

- `processSellPayment` imports `executePayout` from `payoutService.ts` (Plan A)
- `processSellPayment` imports `emitOrderPaid` from `queueService.ts` (already exists)
- `vndPayoutWorker` (Plan A) imports `processSellPayment` from `orderService.ts` (Plan B)

**Build order:** Plan A files must be implemented first, then Plan B. At runtime, both modules import each other cyclically via the worker — but since `vndPayoutWorker` is a standalone process, the cycle resolves at startup (worker imports orderService, orderService doesn't import the worker).

---

## Verification

After both plans complete:

```bash
# Build
npm run build

# Type check
npx tsc --noEmit

# Run workers
npm run worker:disburse &
npm run worker:vnd-payout &

# Test sell flow (stub mode):
# 1. POST /api/orders/withdrawal (creates order, returns hot wallet address)
# 2. Simulate stellar-listener calling /api/webhooks/stellar-incoming with memo=payment_code
# 3. Check order state → COMPLETED(3), callback fired
```