# Architecture

Post-migration, the platform splits into two backend deployables plus the
frontend:

- **auth-service** (Java/Spring Boot) — authentication, authorization,
  RBAC, JWT issuance, refresh tokens, user management, audit logs. No
  business logic.
- **business-service** (Python/FastAPI) — every business module
  (receiving, returns, notification today; quality, storage, assembly,
  dispatch, procurement, gate, disposition, shipment, traceability,
  masterdata, erp, approval as placeholders — see each module's
  `MIGRATION_NOTES.md`).
- **frontend** (React/Vite/TypeScript) — unchanged in spirit; now calls two
  backends instead of one per business module.

## Overall architecture

```mermaid
flowchart TB
    FE[React Frontend]
    AUTH[Java Auth Service<br/>Spring Security, JWT, RBAC]
    BIZ[Python Business Backend<br/>FastAPI microservice]
    APP[Application Layer]
    DOM[Domain Layer]
    REPO[Repository Interfaces]
    SA[SQLAlchemy Repository Impl]
    PG[(PostgreSQL)]
    KAFKA[(Kafka)]
    WORK[Python Workers<br/>outbox relay + notification consumer]

    FE -->|login| AUTH
    AUTH -->|JWT access token| FE
    FE -->|Bearer JWT| BIZ
    BIZ --> APP --> DOM
    APP --> REPO --> SA --> PG
    SA -->|outbox rows, same txn| PG
    WORK -->|poll outbox| PG
    WORK -->|publish| KAFKA
    KAFKA -->|consume| WORK
    BIZ -.fetch + cache JWKS.-> AUTH
```

## Package diagram (business-service)

```mermaid
flowchart LR
    subgraph module["Each module (e.g. receiving)"]
        direction TB
        D[domain<br/>aggregate, value objects, events<br/>— zero framework imports]
        A[application<br/>commands, use cases, repository Protocol]
        I1[infrastructure/api<br/>FastAPI router, Pydantic schemas]
        I2[infrastructure/persistence<br/>SQLAlchemy models, repo impl]
        I1 --> A
        A --> D
        I2 --> A
        I2 --> D
    end
```

## Sequence: confirm a goods receipt (request flow)

```mermaid
sequenceDiagram
    participant U as React Frontend
    participant Auth as auth-service
    participant Biz as business-service (FastAPI)
    participant DB as PostgreSQL
    participant K as Kafka
    participant W as Notification consumer

    U->>Auth: POST /auth/login
    Auth-->>U: access + refresh token
    U->>Biz: POST /api/receiving/grn (Bearer JWT)
    Biz->>Biz: validate JWT locally (cached JWKS)
    Biz->>Biz: ConfirmGrnUseCase -> GoodsReceiptNote.confirm()
    Biz->>DB: INSERT grn, grn_line, outbox_event (one transaction)
    DB-->>Biz: commit
    Biz-->>U: 200 { grnId, status }
    Note over Biz,DB: Outbox relay (APScheduler, every 2s)
    Biz->>DB: SELECT undelivered outbox rows
    Biz->>K: publish GoodsReceivedEvent
    K->>W: consume
    W->>DB: INSERT notification_log
```

## Authentication flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as React
    participant Auth as auth-service (Java)
    participant Biz as business-service (Python)

    U->>FE: enter credentials
    FE->>Auth: POST /auth/login
    Auth->>Auth: verify password (BCrypt), load roles/permissions
    Auth-->>FE: RS256 access token (roles, permissions claims) + refresh token
    FE->>FE: store tokens
    FE->>Biz: any business request, Authorization: Bearer <token>
    Biz->>Auth: GET /.well-known/jwks.json (once, then cached ~5 min)
    Biz->>Biz: verify signature + issuer + audience locally
    Biz->>Biz: check "permissions" claim against required permission
    Biz-->>FE: 200 / 401 / 403
```

## Deployment diagram

```mermaid
flowchart TB
    subgraph k8s["Kubernetes namespace: ams-wms"]
        FEPod[frontend Deployment]
        AuthPod[auth-service Deployment<br/>replicas: 2]
        BizPod[business-service Deployment<br/>replicas: 3, HPA 3-10]
        PGAuth[(postgres-auth)]
        PGBiz[(postgres-business)]
        Redis[(Redis)]
        KafkaCluster[(Kafka)]
    end
    Ingress[Ingress] --> FEPod
    Ingress --> AuthPod
    Ingress --> BizPod
    AuthPod --> PGAuth
    BizPod --> PGBiz
    BizPod --> Redis
    BizPod --> KafkaCluster
```

## Business flow: return request lifecycle (current + placeholder modules)

```mermaid
flowchart LR
    A([ReturnRequest.request<br/>implemented]) -->|ReturnRequestedEvent| B[[notification: recorded<br/>implemented]]
    A -->|future| C{{disposition module<br/>placeholder}}
    C -->|future| D{{shipment module<br/>placeholder}}
```

## Database flow

```mermaid
flowchart TB
    subgraph auth_db["ams_auth (Postgres)"]
        U[app_user] --> UR[user_role] --> R[role] --> RP[role_permission] --> P[permission]
        RT[refresh_token]
        AL[audit_log]
    end
    subgraph biz_db["ams_business (Postgres)"]
        PO[purchase_order] --> POL[purchase_order_line]
        G[grn] --> GL[grn_line]
        POL -.referenced by.-> GL
        RR[return_request] --> RL[return_line]
        NL[notification_log]
        OB[outbox_event]
    end
```

## Kafka flow

```mermaid
flowchart LR
    Receiving[receiving module] -->|outbox row| Relay[Outbox relay worker]
    Returns[returns module] -->|outbox row| Relay
    Relay -->|ams.goods-received-event| Topic1[(Kafka topic)]
    Relay -->|ams.return-requested-event| Topic2[(Kafka topic)]
    Topic1 --> Consumer[Notification Kafka consumer]
    Topic2 --> Consumer
    Consumer --> NotificationLog[(notification_log table)]
```
