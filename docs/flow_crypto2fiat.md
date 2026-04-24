# Flow Crypto to Fiat
sequenceDiagram
    participant User
    participant Backend as Payment Service & API Core
    participant Stellar as Stellar Module
    participant Queue as Kafka/Queue
    participant BankMod as Bank Module (Payout Engine)

    User->>Backend: Request to Sell USDT (Amount, Bank Info)
    Backend->>Backend: Calculate Rate & Fee
    
    Note over Backend: New Step: Tracking Logic
    Backend->>Backend: Create Order (Status: PENDING, Memo: UNIQUE_ID)
    
    Backend-->>User: Show Deposit Address + UNIQUE_ID (Memo)
    
    User->>Stellar: Transfer USDT + UNIQUE_ID (Memo)
    
    Stellar-->>Backend: Webhook: Payment Received (Memo, Amount)
    
    Backend->>Backend: Match Memo with PENDING Order
    Backend->>Backend: Update Order State: CRYPTO_RECEIVED
    
    Backend->>Queue: Push Event: "DISBURSE_FIAT"
    
    Queue->>BankMod: Execute Bank Transfer
    BankMod-->>Backend: Callback: Success
    
    Backend-->>User: Notification: "Funds Sent"

# Detail validation
sequenceDiagram
    participant Horizon as Stellar Horizon API
    participant Watcher as Stellar Watcher Service
    participant Kafka as Kafka (Topic: crypto_deposits)
    participant Processor as Payment Processor (Worker)
    participant DB as Database (Orders & DeadLetters)

    Note over Watcher, Horizon: Follows ledger via Cursor (paging_token)
    Horizon-->>Watcher: New Payment Detected (Amount, Memo, TxHash)
    
    Watcher->>Kafka: Produce Event: {tx_hash, memo, amount, status: raw}
    
    Processor->>Kafka: Consume Event
    
    alt Valid Memo Found
        Processor->>DB: Match Memo with PENDING Order
        Processor->>DB: Update Order: CRYPTO_RECEIVED
        Processor->>Kafka: Push Event: DISBURSE_FIAT
    else Wrong/Missing Memo
        Processor->>DB: Insert into "unidentified_deposits" table
        Processor->>Processor: Alert Support / Flag for Manual Review
    end
