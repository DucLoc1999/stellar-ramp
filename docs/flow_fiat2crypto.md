sequenceDiagram
    participant User
    participant Backend as Payment Service & API Core
    participant SePay
    participant Queue as Kafka/Queue
    participant Stellar as Stellar module

    User->>Backend: Send USDT Purchase Request (Quantity, Stellar Wallet)
    Backend->>Backend: Calculate Price & Fee
    
    Note over Backend: New Step: Order Record
    Backend->>Backend: Create Order (Status: PENDING, Content: "DHA1B2C3D4E5")
    
    Backend-->>User: Return QR Code + Content ("DH12345")
    
    User->>SePay: Bank Transfer (Nội dung: "DH12345")
    SePay->>Backend: Webhook: Received Money + Content ("DH12345")
    
    Backend->>Backend: Match Content "DH12345" with PENDING Order
    Backend->>Backend: Verify Amount & Update Status: PAID
    
    Backend->>Queue: Push Event: "DISBURSE_CRYPTO"
    
    Queue->>Stellar: Execute transfer (Hot Wallet -> User Wallet)
    Stellar-->>Backend: Callback: Transaction Hash
    Backend-->>User: Notification: Success