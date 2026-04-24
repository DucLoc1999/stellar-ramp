# Transaction Reconciliation

## Guide to reconciling transactions between your system and SePay to ensure no transactions are missed.

### Why is transaction reconciliation needed?

When integrating SePay Webhooks, your system receives transactions **in real-time**. However, in some cases webhooks may not reach your system:

* Your server is temporarily **down** (downtime, deploy, restart)
* **Network errors** between SePay and your server
* Webhook **timeout** (server takes too long to process)
* **Maximum retry attempts exceeded** (7 retries)

To ensure **no transactions are missed**, you need to perform periodic reconciliation by calling the **[Transaction API](/en/sepay-api/api-giao-dich)** and matching with the data in your database.

***

### Reconciliation Process

#### 1. Fetch transactions from SePay

Call the API to get the list of transactions within the reconciliation period:

<Endpoint method="GET" path="https://my.sepay.vn/userapi/transactions/list" />

<ParamsTable
  rows={[
{ "name": "transaction_date_min", "type": "string", "description": "Start time, format <code>YYYY-MM-DD HH:mm:ss</code>" },
{ "name": "transaction_date_max", "type": "string", "description": "End time, format <code>YYYY-MM-DD HH:mm:ss</code>" },
{ "name": "account_number", "type": "string", "description": "Filter by bank account number (optional)" },
{ "name": "limit", "type": "integer", "description": "Maximum number of transactions returned (default: 5000)" }
]}
/>

Example: Fetch all transactions on 01/03/2026

<Node title="cURL">
```js
curl -X GET "https://my.sepay.vn/userapi/transactions/list?transaction_date_min=2026-03-01%2000:00:00&transaction_date_max=2026-03-01%2023:59:59" \\
-H "Content-Type: application/json" \\
-H "Authorization: Bearer YOUR_API_TOKEN"
```
</Node>

#### 2. Match with your database

Compare the transaction list from SePay with the transactions stored in your database. Use the **`id`** field (SePay transaction ID) to identify which transactions are missing.

#### 3. Add missing transactions

For transactions that exist on SePay but not in your database, save them and process the corresponding business logic (e.g., update order status).

***

### Sample Reconciliation Code

<CodeTabs>
  <Code label="PHP">
    ```php
    <?php
    $sepayToken = 'YOUR_API_TOKEN';
    
    // Connect to database
    $conn = new mysqli('localhost', 'webhooks_receiver', 'EL2vKpfpDLsz', 'webhooks_receiver');
    if ($conn->connect_error) {
        die('MySQL connection failed: ' . $conn->connect_error);
    }
    
    // Fetch transactions from SePay in the last 24 hours
    $dateMin = date('Y-m-d H:i:s', strtotime('-24 hours'));
    $dateMax = date('Y-m-d H:i:s');
    
    $url = 'https://my.sepay.vn/userapi/transactions/list?'
        . http_build_query([
            'transaction_date_min' => $dateMin,
            'transaction_date_max' => $dateMax
        ]);
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $sepayToken
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    $sepayTransactions = $data['transactions'] ?? [];
    echo count($sepayTransactions) . " transactions from SePay\n";
    
    // Get saved reference_numbers
    $result = $conn->query(
        "SELECT reference_number FROM tb_transactions WHERE created_at >= '{$dateMin}'"
    );
    $existingRefs = [];
    while ($row = $result->fetch_assoc()) {
        $existingRefs[$row['reference_number']] = true;
    }
    
    // Find and add missing transactions
    $missingCount = 0;
    foreach ($sepayTransactions as $tx) {
        if (!isset($existingRefs[$tx['reference_number']])) {
            echo "Missing: ID={$tx['id']}, amount={$tx['amount_in']}, ref={$tx['reference_number']}\n";
    
            $stmt = $conn->prepare(
                'INSERT INTO tb_transactions
                    (gateway, transaction_date, account_number, sub_account,
                     amount_in, amount_out, accumulated, code,
                     transaction_content, reference_number, body)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->bind_param('ssssdddssss',
                $tx['bank_brand_name'],
                $tx['transaction_date'],
                $tx['bank_account_id'],
                $tx['bank_sub_acc_id'],
                $tx['amount_in'],
                $tx['amount_out'],
                $tx['accumulated'],
                $tx['code'],
                $tx['transaction_content'],
                $tx['reference_number'],
                $tx['description']
            );
            $stmt->execute();
            $missingCount++;
        }
    }
    
    echo "Done. Added {$missingCount} transactions.\n";
    $conn->close();
    ?>
    ```
  </Code>
  <Code label="NodeJS">
    ```js
    const axios = require('axios');
    const mysql = require('mysql2/promise');
    
    const SEPAY_TOKEN = 'YOUR_API_TOKEN';
    
    async function reconcile() {
      const db = await mysql.createConnection({
        host: 'localhost',
        user: 'webhooks_receiver',
        password: 'EL2vKpfpDLsz',
        database: 'webhooks_receiver'
      });
    
      // Fetch transactions from SePay in the last 24 hours
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dateMin = yesterday.toISOString().slice(0, 19).replace('T', ' ');
      const dateMax = now.toISOString().slice(0, 19).replace('T', ' ');
    
      const response = await axios.get(
        'https://my.sepay.vn/userapi/transactions/list',
        {
          params: { transaction_date_min: dateMin, transaction_date_max: dateMax },
          headers: {
            'Authorization': `Bearer ${SEPAY_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
    
      const sepayTxs = response.data.transactions || [];
      console.log(`SePay returned ${sepayTxs.length} transactions`);
    
      const [rows] = await db.query(
        'SELECT reference_number FROM tb_transactions WHERE created_at >= ?',
        [dateMin]
      );
      const existingRefs = new Set(rows.map(r => r.reference_number));
    
      let missingCount = 0;
      for (const tx of sepayTxs) {
        if (!existingRefs.has(tx.reference_number)) {
          console.log(`Missing: ID=${tx.id}, amount=${tx.amount_in}, ref=${tx.reference_number}`);
          await db.query(
            `INSERT INTO tb_transactions
              (gateway, transaction_date, account_number, sub_account,
               amount_in, amount_out, accumulated, code,
               transaction_content, reference_number, body)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tx.bank_brand_name, tx.transaction_date,
              tx.bank_account_id, tx.bank_sub_acc_id,
              tx.amount_in || 0, tx.amount_out || 0,
              tx.accumulated || 0, tx.code,
              tx.transaction_content, tx.reference_number, tx.description
            ]
          );
          missingCount++;
        }
      }
    
      console.log(`Done. Added ${missingCount} transactions.`);
      await db.end();
    }
    
    reconcile().catch(console.error);
    ```
  </Code>
  <Code label="Python">
    ```python
    import requests
    import mysql.connector
    from datetime import datetime, timedelta
    
    SEPAY_TOKEN = 'YOUR_API_TOKEN'
    
    def reconcile():
        db = mysql.connector.connect(
            host='localhost',
            user='webhooks_receiver',
            password='EL2vKpfpDLsz',
            database='webhooks_receiver'
        )
        cursor = db.cursor(dictionary=True)
    
        # Fetch transactions from SePay in the last 24 hours
        now = datetime.now()
        yesterday = now - timedelta(hours=24)
        date_min = yesterday.strftime('%Y-%m-%d %H:%M:%S')
        date_max = now.strftime('%Y-%m-%d %H:%M:%S')
    
        res = requests.get(
            'https://my.sepay.vn/userapi/transactions/list',
            params={'transaction_date_min': date_min, 'transaction_date_max': date_max},
            headers={
                'Authorization': f'Bearer {SEPAY_TOKEN}',
                'Content-Type': 'application/json'
            }
        )
        transactions = res.json().get('transactions', [])
        print(f'SePay returned {len(transactions)} transactions')
    
        cursor.execute(
            'SELECT reference_number FROM tb_transactions WHERE created_at >= %s',
            (date_min,)
        )
        existing_refs = {row['reference_number'] for row in cursor.fetchall()}
    
        missing = 0
        for tx in transactions:
            if tx['reference_number'] not in existing_refs:
                print(f"Missing: ID={tx['id']}, amount={tx['amount_in']}, ref={tx['reference_number']}")
                cursor.execute(
                    '''INSERT INTO tb_transactions
                        (gateway, transaction_date, account_number, sub_account,
                         amount_in, amount_out, accumulated, code,
                         transaction_content, reference_number, body)
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                    (
                        tx['bank_brand_name'], tx['transaction_date'],
                        tx['bank_account_id'], tx['bank_sub_acc_id'],
                        tx.get('amount_in', 0), tx.get('amount_out', 0),
                        tx.get('accumulated', 0), tx['code'],
                        tx['transaction_content'], tx['reference_number'],
                        tx['description']
                    )
                )
                missing += 1
    
        db.commit()
        print(f'Done. Added {missing} transactions.')
        cursor.close()
        db.close()
    
    reconcile()
    ```
  </Code>
  <Code label="Ruby">
    ```ruby
    require 'net/http'
    require 'uri'
    require 'json'
    require 'mysql2'
    
    SEPAY_TOKEN = 'YOUR_API_TOKEN'
    
    db = Mysql2::Client.new(
      host: 'localhost',
      username: 'webhooks_receiver',
      password: 'EL2vKpfpDLsz',
      database: 'webhooks_receiver'
    )
    
    # Fetch transactions from SePay in the last 24 hours
    date_min = (Time.now - 86400).strftime('%Y-%m-%d %H:%M:%S')
    date_max = Time.now.strftime('%Y-%m-%d %H:%M:%S')
    
    uri = URI('https://my.sepay.vn/userapi/transactions/list')
    uri.query = URI.encode_www_form(
      transaction_date_min: date_min,
      transaction_date_max: date_max
    )
    
    req = Net::HTTP::Get.new(uri)
    req['Content-Type'] = 'application/json'
    req['Authorization'] = "Bearer #{SEPAY_TOKEN}"
    
    res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(req) }
    transactions = JSON.parse(res.body)['transactions'] || []
    puts "SePay returned #{transactions.length} transactions"
    
    existing = db.query(
      "SELECT reference_number FROM tb_transactions WHERE created_at >= '#{date_min}'"
    ).map { |r| r['reference_number'] }.to_set
    
    missing = 0
    transactions.each do |tx|
      unless existing.include?(tx['reference_number'])
        puts "Missing: ID=#{tx['id']}, amount=#{tx['amount_in']}, ref=#{tx['reference_number']}"
        stmt = db.prepare(
          'INSERT INTO tb_transactions (gateway, transaction_date, account_number, ' \
          'sub_account, amount_in, amount_out, accumulated, code, ' \
          'transaction_content, reference_number, body) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        )
        stmt.execute(
          tx['bank_brand_name'], tx['transaction_date'], tx['bank_account_id'],
          tx['bank_sub_acc_id'], tx['amount_in'] || 0, tx['amount_out'] || 0,
          tx['accumulated'] || 0, tx['code'], tx['transaction_content'],
          tx['reference_number'], tx['description']
        )
        missing += 1
      end
    end
    
    puts "Done. Added #{missing} transactions."
    db.close
    ```
  </Code>
  <Code label="Java">
    ```java
    import java.net.http.*;
    import java.net.URI;
    import java.net.URLEncoder;
    import java.sql.*;
    import java.time.LocalDateTime;
    import java.time.format.DateTimeFormatter;
    import java.util.HashSet;
    import org.json.*;
    
    public class Reconcile {
      static final String SEPAY_TOKEN = "YOUR_API_TOKEN";
    
      public static void main(String[] args) throws Exception {
        Connection db = DriverManager.getConnection(
          "jdbc:mysql://localhost/webhooks_receiver",
          "webhooks_receiver", "EL2vKpfpDLsz"
        );
    
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        String dateMax = LocalDateTime.now().format(fmt);
        String dateMin = LocalDateTime.now().minusHours(24).format(fmt);
    
        // Fetch transactions from SePay in the last 24 hours
        String url = "https://my.sepay.vn/userapi/transactions/list"
          + "?transaction_date_min=" + URLEncoder.encode(dateMin, "UTF-8")
          + "&transaction_date_max=" + URLEncoder.encode(dateMax, "UTF-8");
    
        HttpRequest request = HttpRequest.newBuilder()
          .uri(URI.create(url))
          .header("Content-Type", "application/json")
          .header("Authorization", "Bearer " + SEPAY_TOKEN)
          .GET().build();
    
        HttpResponse<String> response = HttpClient.newHttpClient()
          .send(request, HttpResponse.BodyHandlers.ofString());
    
        JSONArray transactions = new JSONObject(response.body())
          .optJSONArray("transactions");
        if (transactions == null) transactions = new JSONArray();
        System.out.println("SePay returned " + transactions.length() + " transactions");
    
        HashSet<String> existingRefs = new HashSet<>();
        PreparedStatement ps = db.prepareStatement(
          "SELECT reference_number FROM tb_transactions WHERE created_at >= ?");
        ps.setString(1, dateMin);
        ResultSet rs = ps.executeQuery();
        while (rs.next()) existingRefs.add(rs.getString("reference_number"));
    
        int missing = 0;
        PreparedStatement insert = db.prepareStatement(
          "INSERT INTO tb_transactions (gateway, transaction_date, account_number, " +
          "sub_account, amount_in, amount_out, accumulated, code, " +
          "transaction_content, reference_number, body) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    
        for (int i = 0; i < transactions.length(); i++) {
          JSONObject tx = transactions.getJSONObject(i);
          String ref = tx.optString("reference_number");
          if (!existingRefs.contains(ref)) {
            System.out.println("Missing: ID=" + tx.opt("id") + ", ref=" + ref);
            insert.setString(1, tx.optString("bank_brand_name"));
            insert.setString(2, tx.optString("transaction_date"));
            insert.setString(3, tx.optString("bank_account_id"));
            insert.setString(4, tx.optString("bank_sub_acc_id"));
            insert.setDouble(5, tx.optDouble("amount_in", 0));
            insert.setDouble(6, tx.optDouble("amount_out", 0));
            insert.setDouble(7, tx.optDouble("accumulated", 0));
            insert.setString(8, tx.optString("code"));
            insert.setString(9, tx.optString("transaction_content"));
            insert.setString(10, ref);
            insert.setString(11, tx.optString("description"));
            insert.executeUpdate();
            missing++;
          }
        }
        System.out.println("Done. Added " + missing + " transactions.");
        db.close();
      }
    }
    ```
  </Code>
  <Code label="Go">
    ```go
    package main
    
    import (
      "database/sql"
      "encoding/json"
      "fmt"
      "io"
      "net/http"
      "net/url"
      "time"
      _ "github.com/go-sql-driver/mysql"
    )
    
    const sepayToken = "YOUR_API_TOKEN"
    
    func main() {
      db, err := sql.Open("mysql",
        "webhooks_receiver:EL2vKpfpDLsz@tcp(localhost)/webhooks_receiver?parseTime=true")
      if err != nil { panic(err) }
      defer db.Close()
    
      // Fetch transactions from SePay in the last 24 hours
      now := time.Now()
      dateMin := now.Add(-24 * time.Hour).Format("2006-01-02 15:04:05")
      dateMax := now.Format("2006-01-02 15:04:05")
    
      apiURL := "https://my.sepay.vn/userapi/transactions/list?" + url.Values{
        "transaction_date_min": {dateMin},
        "transaction_date_max": {dateMax},
      }.Encode()
    
      req, _ := http.NewRequest("GET", apiURL, nil)
      req.Header.Set("Content-Type", "application/json")
      req.Header.Set("Authorization", "Bearer "+sepayToken)
    
      resp, err := http.DefaultClient.Do(req)
      if err != nil { panic(err) }
      defer resp.Body.Close()
      body, _ := io.ReadAll(resp.Body)
    
      var data struct {
        Transactions []map[string]interface{} `json:"transactions"`
      }
      json.Unmarshal(body, &data)
      fmt.Printf("SePay returned %d transactions\n", len(data.Transactions))
    
      rows, _ := db.Query(
        "SELECT reference_number FROM tb_transactions WHERE created_at >= ?", dateMin)
      existing := map[string]bool{}
      for rows.Next() {
        var ref string
        rows.Scan(&ref)
        existing[ref] = true
      }
    
      missing := 0
      for _, tx := range data.Transactions {
        ref, _ := tx["reference_number"].(string)
        if !existing[ref] {
          fmt.Printf("Missing: ID=%v, amount=%v, ref=%s\n", tx["id"], tx["amount_in"], ref)
          db.Exec(
            `INSERT INTO tb_transactions
              (gateway, transaction_date, account_number, sub_account,
               amount_in, amount_out, accumulated, code,
               transaction_content, reference_number, body)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            tx["bank_brand_name"], tx["transaction_date"], tx["bank_account_id"],
            tx["bank_sub_acc_id"], tx["amount_in"], tx["amount_out"],
            tx["accumulated"], tx["code"], tx["transaction_content"],
            ref, tx["description"])
          missing++
        }
      }
      fmt.Printf("Done. Added %d transactions.\n", missing)
    }
    ```
  </Code>
  <Code label=".NET">
    ```csharp
    using System;
    using System.Collections.Generic;
    using System.Net.Http;
    using System.Text.Json;
    using System.Threading.Tasks;
    using MySqlConnector;
    
    class Program {
      const string SepayToken = "YOUR_API_TOKEN";
    
      static async Task Main() {
        await using var db = new MySqlConnection(
          "Server=localhost;Database=webhooks_receiver;" +
          "User=webhooks_receiver;Password=EL2vKpfpDLsz;");
        await db.OpenAsync();
    
        // Fetch transactions from SePay in the last 24 hours
        var dateMin = DateTime.Now.AddHours(-24).ToString("yyyy-MM-dd HH:mm:ss");
        var dateMax = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
    
        var client = new HttpClient();
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {SepayToken}");
        var url = "https://my.sepay.vn/userapi/transactions/list" +
          $"?transaction_date_min={Uri.EscapeDataString(dateMin)}" +
          $"&transaction_date_max={Uri.EscapeDataString(dateMax)}";
    
        var json = await client.GetStringAsync(url);
        var data = JsonDocument.Parse(json);
        var transactions = data.RootElement.GetProperty("transactions");
        Console.WriteLine($"SePay returned {transactions.GetArrayLength()} transactions");
    
        var existingRefs = new HashSet<string>();
        await using (var cmd = new MySqlCommand(
          "SELECT reference_number FROM tb_transactions WHERE created_at >= @d", db)) {
          cmd.Parameters.AddWithValue("@d", dateMin);
          await using var reader = await cmd.ExecuteReaderAsync();
          while (await reader.ReadAsync())
            existingRefs.Add(reader.GetString(0));
        }
    
        var missing = 0;
        foreach (var tx in transactions.EnumerateArray()) {
          var refNum = tx.GetProperty("reference_number").GetString() ?? "";
          if (!existingRefs.Contains(refNum)) {
            Console.WriteLine($"Missing: ID={tx.GetProperty("id")}, ref={refNum}");
            await using var cmd = new MySqlCommand(
              @"INSERT INTO tb_transactions
                  (gateway, transaction_date, account_number, sub_account,
                   amount_in, amount_out, accumulated, code,
                   transaction_content, reference_number, body)
                VALUES (@1,@2,@3,@4,@5,@6,@7,@8,@9,@10,@11)", db);
            cmd.Parameters.AddWithValue("@1", tx.GetProperty("bank_brand_name").GetString());
            cmd.Parameters.AddWithValue("@2", tx.GetProperty("transaction_date").GetString());
            cmd.Parameters.AddWithValue("@3", tx.GetProperty("bank_account_id").GetString());
            cmd.Parameters.AddWithValue("@4", tx.GetProperty("bank_sub_acc_id").GetString());
            cmd.Parameters.AddWithValue("@5", tx.TryGetProperty("amount_in", out var ai) ? ai.GetDouble() : 0);
            cmd.Parameters.AddWithValue("@6", tx.TryGetProperty("amount_out", out var ao) ? ao.GetDouble() : 0);
            cmd.Parameters.AddWithValue("@7", tx.TryGetProperty("accumulated", out var ac) ? ac.GetDouble() : 0);
            cmd.Parameters.AddWithValue("@8", tx.GetProperty("code").GetString());
            cmd.Parameters.AddWithValue("@9", tx.GetProperty("transaction_content").GetString());
            cmd.Parameters.AddWithValue("@10", refNum);
            cmd.Parameters.AddWithValue("@11", tx.GetProperty("description").GetString());
            await cmd.ExecuteNonQueryAsync();
            missing++;
          }
        }
        Console.WriteLine($"Done. Added {missing} transactions.");
      }
    }
    ```
  </Code>
</CodeTabs>

<Callout type="tip" title="Tip">
Set up a cron job or scheduled task to run reconciliation automatically, for example every hour or every day.
```bash
# Run reconciliation every hour (crontab)
0 * * * * node /path/to/reconcile.js >> /var/log/reconcile.log 2>&1
```
</Callout>

***

### Reconciliation Strategies

#### Time-range based reconciliation

Suitable for periodic reconciliation (hourly, daily). Use `transaction_date_min` and `transaction_date_max` to fetch transactions within a fixed time range.

#### Reconciliation using `since_id`

Suitable for continuous reconciliation. Save the **last processed transaction ID**, then use the `since_id` parameter to only fetch newer transactions.

<Node title="cURL">
```js
curl -X GET "https://my.sepay.vn/userapi/transactions/list?since_id=92704" \\
-H "Content-Type: application/json" \\
-H "Authorization: Bearer YOUR_API_TOKEN"
```
</Node>

<Callout type="warn" title="Note">
Rate limit:
 The Transaction API is limited to 
3 requests/second
. If exceeded, you will receive HTTP 429.
Deduplication:
 Always check 
`id`
 or 
`reference_number`
 before saving additional transactions to avoid duplicates.
Result limit:
 By default, the API returns a maximum of 
5000 transactions
. If there are more, split the reconciliation time range into smaller intervals.
</Callout>