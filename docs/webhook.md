# Webhooks Programming (Node.js)

## Program a simple webhook URL using Node.js (Express) to receive and store transaction information from SePay.

<Callout type="tip" title="PHP">
If you use PHP, see 
Webhooks Programming (PHP)
.
</Callout>

This article will guide you to build a simple application using **[Node.js](https://nodejs.org/)** (Express) to receive and store transactions sent by SePay, using **[MySQL](https://en.wikipedia.org/wiki/MySQL)** as the database.

### Step 1: Create a database and assign permissions.

Create a database named `webhooks_receiver`, MySQL user `webhooks_receiver` with password `EL2vKpfpDLsz`.

Access the MySQL Command Line and execute the following commands:

<TextBlock title="MySQL">
```text
create database webhooks_receiver;
create user 'webhooks_receiver'@'localhost' identified by 'EL2vKpfpDLsz';
grant all privileges on webhooks_receiver.* to  'webhooks_receiver'@'localhost' identified by 'EL2vKpfpDLsz';
```
</TextBlock>

<Callout type="info" title="Note">
For security reasons, you should change 
EL2vKpfpDLsz
 to a different password.
</Callout>

### Step 2: Create a table to store transaction information.

Execute the table creation command in MySQL Command Line:

<TextBlock title="MySQL">
```text
use webhooks_receiver;
CREATE TABLE \`tb_transactions\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`gateway\` varchar(100) NOT NULL,
  \`transaction_date\` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  \`account_number\` varchar(100) DEFAULT NULL,
  \`sub_account\` varchar(250) DEFAULT NULL,
  \`amount_in\` decimal(20,2) NOT NULL DEFAULT 0.00,
  \`amount_out\` decimal(20,2) NOT NULL DEFAULT 0.00,
  \`accumulated\` decimal(20,2) NOT NULL DEFAULT 0.00,
  \`code\` varchar(250) DEFAULT NULL,
  \`transaction_content\` text DEFAULT NULL,
  \`reference_number\` varchar(255) DEFAULT NULL,
  \`body\` text DEFAULT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (\`id\`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
```
</TextBlock>

### Step 3: Initialize project and install packages.

<TextBlock title="Terminal">
```text
mkdir webhooks-receiver && cd webhooks-receiver
npm init -y
npm install express mysql2
```
</TextBlock>

### Step 4: Create the webhook receiver file.

Create `receiver.js` with the following content:

<Node title="receiver.js">
```js
const express = require('express');
const mysql = require('mysql2');

const app = express();
app.use(express.json());

// Connect to MySQL
const db = mysql.createConnection({
host: 'localhost',
user: 'webhooks_receiver',
password: 'EL2vKpfpDLsz',
database: 'webhooks_receiver'
});

db.connect((err) => {
if (err) {
  console.error('MySQL connection failed:', err.message);
  process.exit(1);
}
console.log('Connected to MySQL');
});

// Endpoint to receive webhook from SePay
app.post('/webhook', (req, res) => {
const data = req.body;

if (!data || !data.gateway) {
  return res.json({ success: false, message: 'No data' });
}

const amountIn = data.transferType === 'in' ? data.transferAmount : 0;
const amountOut = data.transferType === 'out' ? data.transferAmount : 0;

const sql = \`INSERT INTO tb_transactions
  (gateway, transaction_date, account_number, sub_account,
   amount_in, amount_out, accumulated, code,
   transaction_content, reference_number, body)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`;

const values = [
  data.gateway,
  data.transactionDate,
  data.accountNumber,
  data.subAccount,
  amountIn,
  amountOut,
  data.accumulated,
  data.code,
  data.content,
  data.referenceCode,
  data.description
];

db.query(sql, values, (err) => {
  if (err) {
    return res.json({
      success: false,
      message: 'Can not insert record to mysql: ' + err.message
    });
  }
  res.status(200).json({ success: true });
});
});

app.listen(3000, () => {
console.log('Webhook receiver running on port 3000');
});
```
</Node>

Start the server:

<TextBlock title="Terminal">
```text
node receiver.js
```
</TextBlock>

### Step 5: Add a new Webhook in the WebHooks menu.

Note the parameters:

* Call URL: **[https://your-website.tld:3000/webhook](https://your-website.tld:3000/webhook)**
* Authentication type: **No authentication**

### Step 6: Create a simulated transaction

Create a simulated transaction by logging into your *Demo* account under **Transactions → Simulate Transaction**. Select the correct bank account associated with the webhook you created.

### Step 7: View results

After creating the simulated transaction, go to **Transactions** → Click the **Pay** icon under the **Auto** column to view the WebHooks results, or visit **[WebHooks Log](https://my.sepay.vn/webhookslog)**.

### Step 8: Verify data

Check if the data has been stored in the database using the following queries:

<TextBlock title="MYSQL">
```text
use webhooks_receiver;
select * from tb_transactions \\G;
```
</TextBlock>

<Callout type="info" title="Note">
The example above does not authenticate the source call. For security, you should allowlist 
SePay's IP addresses
 or use an authentication method.
For API Key, verify the 
`Authorization`
 header in the request:
```javascript
app.post('/webhook', (req, res) => {
  const apiKey = req.headers['authorization'];
  if (apiKey !== 'Apikey YOUR_API_KEY') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  // ... handle webhook
});
```
</Callout>