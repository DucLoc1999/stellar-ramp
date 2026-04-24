graph TD
subgraph "External Consumers"
UserFE["<b>User Client / Bot</b><br/>(via User API)"]
AdminFE["<b>Admin Dashboard</b><br/>(via Admin API)"]
StellarNet["Stellar Blockchain"]
PayoutAPI["3rd-Party Payout API"]
end

subgraph "API & Gateway Layer (REST/gRPC)"
UserAPI["<b>User API Service</b><br/>Quotes, Order Entry, History"]
AdminAPI["<b>Admin API Service</b><br/>BI Metrics, System Config"]
Webhooks["<b>Webhook Listener</b><br/>Ingress for SePay & Payout Provider"]
end

subgraph "Core Processing Engine"
OMS["<b>Order Management System</b><br/>State Machine & Business Logic"]
MgmtSvc["<b>Management Service</b><br/>PnL Calculation & BI Aggregator"]
DB[("<b>PostgreSQL</b><br/>Orders, Config, BI Stats, Wallets")]
end

subgraph "Messaging & Background Workers"
Kafka{"<b>Kafka Broker</b><br/>Events: ORDER_PAID, DISBURSE_TRIGGER"}
SweepCron["<b>Sweeping Cronjob</b><br/>Account Scanner & Collector"]
end

subgraph "Infrastructure Adapters"
BankMod["<b>Bank Module</b><br/>Payout API Adapter"]
StellarMod["<b>Stellar Module</b><br/>Watcher & Transaction Signer"]
end

%% Flow: User/Admin -> API -> DB/Kafka
UserFE <--> UserAPI
AdminFE <--> AdminAPI
UserAPI --> DB
UserAPI -- "Trigger Order" --> Kafka
AdminAPI --> DB
AdminAPI -- "Config Update" --> Kafka

%% Flow: External -> Webhooks -> Kafka
Webhooks -- "Bank/Payout Signal" --> Kafka

%% Flow: Processing
Kafka --> OMS
OMS --> DB
OMS -- "Valid & Funded" --> Kafka

%% Maintenance (Simplified Sweeper)
SweepCron --> DB
SweepCron -- "Execute Merge/Payment" --> StellarMod

%% Flow: Execution
Kafka --> BankMod
Kafka --> StellarMod
StellarMod <--> StellarNet
BankMod <--> PayoutAPI