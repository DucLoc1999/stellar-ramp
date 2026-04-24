sequenceDiagram
    participant Admin as Admin (User)
    participant FE as FE (Frontend)
    participant API as API (Backend)
    participant DB as DB (Database)

    Note over Admin, DB: --- AUTHENTICATION FLOW ---
    Admin->>FE: Input Credentials (Login)
    FE->>API: POST /login (Email, Password)
    API->>DB: Query Admin Record
    DB-->>API: Valid Record Found
    API-->>FE: Return Access Token (JWT)
    FE->>FE: Save Token to Browser

    Note over Admin, DB: --- UPDATING SYSTEM CONFIG ---
    Admin->>FE: Change Spread or Fees
    FE->>API: PATCH /config (Token + New Data)
    API->>API: Validate Token
    API->>DB: Update Config Table
    DB-->>API: Confirm Update
    API-->>FE: 200 OK (Success)
    FE->>Admin: Show "Settings Saved"

    Note over Admin, DB: --- MONITORING BI DASHBOARD ---
    Admin->>FE: Open Dashboard Page
    FE->>API: GET /stats (Token + Date Filter)
    API->>DB: Query Transaction Volume & PnL
    DB-->>API: Return Aggregated Data
    API-->>FE: Return JSON Data
    FE->>Admin: Render Charts & Profit Tables