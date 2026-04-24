# Quick Start

## SePay Webhooks allow your application to receive real-time transaction notifications whenever money flows in or out of your linked bank account. Instead of constantly polling, SePay proactively sends transaction data to your specified URL.

<Callout type="info" title="Sandbox Environment">
If you need a 
test environment
, register an account at 
my.dev.sepay.vn
. Here you can create simulated transactions and webhooks for development purposes. After registration, please 
contact
 SePay to activate your account.
</Callout>

***

### Integration Overview

The diagram below illustrates the complete integration flow — from configuring webhooks, generating payment QR codes, receiving transaction notifications via webhook, to periodic transaction reconciliation.

<Mermaid title="SePay Webhooks Flow">
sequenceDiagram
participant C as Customer
participant Bank as Bank
participant SP as SePay
participant SV as Your Server
participant DB as Database

C->>Bank: Transfer money
Bank-->>SP: New transaction detected
SP->>SV: POST webhook (JSON)
SV->>SV: Verify API Key / OAuth 2.0
SV->>DB: Save transaction
SV->>DB: Update order status
SV-->>SP: {"success": true}

Note over SV,SP: Periodic reconciliation
SV->>SP: GET /transactions (API)
SP-->>SV: Transaction list
SV->>DB: Match & supplement
</Mermaid>

***

### How It Works

1. A customer transfers money to your bank account
2. SePay detects the new transaction and sends a **POST request** to your configured webhook URL
3. Your server receives the data, processes it and responds with `{"success": true}`

***

### Quick start

##### Step 1: Create a Webhook on Dashboard

<Steps>
  <Step title="Access WebHooks">
    Log in to **[my.sepay.vn](https://my.sepay.vn)** → select **[WebHooks](https://my.sepay.vn/webhooks)** menu.
  </Step>

  <Step title="Add a New WebHook">
    Click the **+ Add webhooks** button and fill in:

    * **Name:** Any name to identify the webhook
    * **Select Event:** Choose when to trigger the webhook: *money in*, *money out*, or *both*
    * **Select Conditions:** Choose the bank account(s) that will trigger webhooks
    * **Call URL:** The endpoint that will receive webhooks. To build a custom receiver, see the **[PHP guide](/en/sepay-webhooks/lap-trinh-webhooks/lap-trinh-webhook)** or **[Node.js guide](/en/sepay-webhooks/lap-trinh-webhooks/lap-trinh-webhook-nodejs)**
    * **Authentication:** Choose **OAuth 2.0**, **API Key** or **No authentication**
  </Step>

  <Step title="Complete">
    Click **Add** to finish the integration.
  </Step>
</Steps>

Full configuration details: **[Create Webhooks](/en/sepay-webhooks/tich-hop-webhook)**

***

##### Step 2: WebHook Payload Data

SePay sends a **POST request** with the following JSON payload:

<Response title="JSON">
```json
{
  "id": 92704,
  "gateway": "Vietcombank",
  "transactionDate": "2023-03-25 14:02:37",
  "accountNumber": "0123499999",
  "code": null,
  "content": "chuyen tien mua iphone",
  "transferType": "in",
  "transferAmount": 2277000,
  "accumulated": 19077000,
  "subAccount": null,
  "referenceCode": "MBVCB.3278907687",
  "description": ""
}
```
</Response>

<ParamsTable
  rows={[
{ "name": "id", "type": "integer", "description": "Transaction ID on SePay" },
{ "name": "gateway", "type": "string", "description": "Bank brand name" },
{ "name": "transactionDate", "type": "string", "description": "Transaction time from the bank" },
{ "name": "accountNumber", "type": "string", "description": "Bank account number" },
{ "name": "code", "type": "string", "description": "Payment code, automatically detected by SePay based on <strong>Company → General Settings</strong>. Can be <code>null</code> if not detected." },
{ "name": "content", "type": "string", "description": "Transfer description" },
{ "name": "transferType", "type": "string", "description": "Transaction type: <code>in</code> = deposit, <code>out</code> = withdrawal" },
{ "name": "transferAmount", "type": "integer", "description": "Transaction amount (VND)" },
{ "name": "accumulated", "type": "integer", "description": "Account balance (accumulated)" },
{ "name": "subAccount", "type": "string", "description": "Sub-account (virtual account / VA). Can be <code>null</code>." },
{ "name": "referenceCode", "type": "string", "description": "Reference code from SMS" },
{ "name": "description", "type": "string", "description": "Full SMS message content" }
]}
/>

***

##### Step 3: Sample Webhook Receiver Code

<!-- No code tabs available -->

Detailed guides for saving transactions to MySQL: **[PHP](/en/sepay-webhooks/lap-trinh-webhooks/lap-trinh-webhook)** · **[Node.js](/en/sepay-webhooks/lap-trinh-webhooks/lap-trinh-webhook-nodejs)**

***

##### Step 4: Recognizing Successful WebHooks

<Callout type="warn" title="Important">
When receiving a webhook from SePay, your server must respond correctly for SePay to mark it as successful:
OAuth 2.0:
 Response body 
`{"success": true}`
 — HTTP Status Code 
`201`
API Key:
 Response body 
`{"success": true}`
 — HTTP Status Code 
`200`
 or 
`201`
No authentication:
 Response body 
`{"success": true}`
 — HTTP Status Code 
`200`
 or 
`201`
If the response does not meet these conditions, SePay will consider the webhook 
failed
.
</Callout>

**Timeout parameters:**

<ParamsTable
  rows={[
{ "name": "Connection timeout", "description": "5 seconds" },
{ "name": "Response timeout", "description": "8 seconds — Maximum wait time for a response" }
]}
/>

***

##### Step 5: Testing WebHooks

1. **Demo account:** Go to **[Transactions](https://my.sepay.vn/transactions)** → **Simulate Transaction** to create a test transaction. See the **[Simulate Transaction guide](/en/tien-ich-khac/gia-lap-giao-dich)**.
2. **Real account:** Send a small amount to your bank account to trigger a real transaction.
3. **View logs:** Go to **Logs → [WebHooks Log](https://my.sepay.vn/webhookslog)** to see all sent webhooks.
4. **Per-transaction view:** Go to **[Transactions](https://my.sepay.vn/transactions) → Auto column → select Pay** to see webhooks for each transaction.

***

### Next Steps

1. **[QR Code and Payment Form](/en/sepay-webhooks/tao-qr-va-form-thanh-toan)** — Create bank transfer QR codes and build an auto-confirming payment page
2. **[Create Webhooks](/en/sepay-webhooks/tich-hop-webhook)** — Detailed webhook configuration (events, conditions, retry, authentication)
3. **[Webhooks Programming (PHP)](/en/sepay-webhooks/lap-trinh-webhooks/lap-trinh-webhook)** — Step-by-step guide to save transactions to MySQL with PHP
4. **[Webhooks Programming (Node.js)](/en/sepay-webhooks/lap-trinh-webhooks/lap-trinh-webhook-nodejs)** — Step-by-step guide with Node.js + Express
5. **[Transaction Reconciliation](/en/sepay-webhooks/doi-soat-giao-dich)** — Ensure no transactions are missed