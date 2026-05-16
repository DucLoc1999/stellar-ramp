# QR Code and Payment Form

## Guide to creating bank transfer QR codes and building a payment form with QR + Webhooks for automatic payment confirmation.

This guide shows you how to combine **bank transfer QR Codes** with **SePay Webhooks** to build an automated payment flow: customer scans QR → transfers money → system automatically confirms the order.

<Callout type="info" title="Before you start">
Make sure you have:
Linked a bank account on 
my.sepay.vn
Created a webhook to receive transaction notifications — see 
Quick Start
Configured 
payment code
 at 
Company → General Settings → Payment Code Structure
</Callout>

***

### Creating Bank Transfer QR Codes

SePay provides a QR Code image generator at **[qr.sepay.vn](https://qr.sepay.vn/)**. When customers scan the code with their banking app, all transfer details (bank, account number, amount, description) are auto-filled.

#### URL Structure

```
https://qr.sepay.vn/img?acc={ACCOUNT_NUMBER}&bank={BANK_NAME}&amount={AMOUNT}&des={DESCRIPTION}
```

<ParamsTable
  rows={[
{ "name": "acc", "type": "string", "required": true, "description": "Beneficiary bank account number" },
{ "name": "bank", "type": "string", "required": true, "description": "Bank short name. See the list at <a href='https://qr.sepay.vn/banks.json' target='_blank'>qr.sepay.vn/banks.json</a>" },
{ "name": "amount", "type": "integer", "required": false, "description": "Transfer amount (VND)" },
{ "name": "des", "type": "string", "required": false, "description": "Transfer description (URL-encoded)" }
]}
/>

#### Example

```
https://qr.sepay.vn/img?acc=0010000000355&bank=Vietcombank&amount=100000&des=DHA1B2C3D4E5
```

<Image src="/images/user-guide/qr-1.png" alt="Payment QR Code" caption="Sample payment QR Code" />

<Callout type="tip" title="Dynamic QR Codes">
You can generate dynamic QR codes by changing 
`amount`
 and 
`des`
 for each order. Each order gets a unique QR with the 
order code
 in the transfer description so SePay can auto-detect it.
</Callout>

Full QR Code documentation: **[Generate and Embed QR Code](/en/tien-ich-khac/tao-qr-code)**

***

### Building a Payment Form with QR

Below is a guide to create a simple payment form: display order info, QR image, and automatically update status when the customer pays.

#### How It Works

1. Customer places an order → system creates an order with a unique **payment code** (e.g., `DHA1B2C3D4E5`)
2. Payment page displays a QR Code containing the payment code in the transfer description
3. Customer scans QR → makes the transfer
4. SePay detects the transaction → sends webhook to your server with `code = "DHA1B2C3D4E5"`
5. Server updates the order to **Paid**
6. Payment page auto-updates to show **Payment Successful** (via polling or WebSocket)

***

#### Frontend: Payment Page

<!-- No code tabs available -->

***

#### Backend: Create Order and Receive Webhook

<!-- No code tabs available -->

***

#### Sample Database Schema

```sql
-- Orders table
CREATE TABLE `orders` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `code` varchar(50) NOT NULL COMMENT 'Payment code (transfer description)',
    `amount` int(11) NOT NULL COMMENT 'Amount (VND)',
    `status` enum('pending','paid','expired','cancelled') NOT NULL DEFAULT 'pending',
    `paid_at` datetime DEFAULT NULL,
    `created_at` datetime NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Webhook logs table (deduplication)
CREATE TABLE `webhook_logs` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `transaction_id` int(11) NOT NULL COMMENT 'Transaction ID on SePay',
    `body` text NOT NULL,
    `created_at` datetime NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_transaction_id` (`transaction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

***

### Important Notes

<Callout type="warn" title="Secure Payment Codes">
Payment codes (the 
`code`
 field) must be 
unique
 per order and 
hard to guess
. Avoid sequential numbers (
`1, 2, 3...`
). Use prefix + timestamp or random strings (e.g., 
`DH1709123456`
, 
`ORD-A7X9K2`
).
</Callout>

<Callout type="warn" title="Verify Transfer Amount">
Always compare 
`transferAmount`
 from the webhook with the order amount. Only confirm payment when the transferred amount is 
≥
 the order amount. This prevents cases where the customer transfers less than required.
</Callout>

<Callout type="info" title="Respond Quickly">
Webhooks have an 
8-second response timeout
. If your processing is complex (sending emails, calling third-party APIs), respond with 
`{"success": true}`
 immediately and handle business logic asynchronously via a queue.
</Callout>

***

### Next Steps

1. **[Generate and Embed QR Code](/en/tien-ich-khac/tao-qr-code)** — Full QR parameters and bank list
2. **[Create Webhooks](/en/sepay-webhooks/tich-hop-webhook)** — Detailed webhook configuration (events, conditions, retry, authentication)
3. **[Transaction Reconciliation](/en/sepay-webhooks/doi-soat-giao-dich)** — Add reconciliation to catch any missed transactions