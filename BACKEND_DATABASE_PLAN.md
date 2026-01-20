# Blu Markets Backend & Database Architecture Plan

**Version:** 1.0
**Date:** January 2026
**Status:** Planning

---

## Executive Summary

This document outlines the complete backend API and database architecture for Blu Markets, translating the existing frontend-only prototype into a production-ready full-stack application. The backend will serve both the React Native mobile app and the React web prototype.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Database Schema](#2-database-schema)
3. [API Architecture](#3-api-architecture)
4. [Authentication & Security](#4-authentication--security)
5. [Business Logic Services](#5-business-logic-services)
6. [Real-time Features](#6-real-time-features)
7. [External Integrations](#7-external-integrations)
8. [Infrastructure & Deployment](#8-infrastructure--deployment)
9. [Implementation Phases](#9-implementation-phases)

---

## 1. Technology Stack

### Recommended Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Runtime** | Node.js 20 LTS | JavaScript/TypeScript consistency with frontend, async I/O |
| **Framework** | Fastify | High performance, TypeScript-first, schema validation |
| **Language** | TypeScript | Type safety, shared types with frontend |
| **Database** | PostgreSQL 16 | ACID compliance, JSON support, robust for financial data |
| **ORM** | Prisma | Type-safe queries, migrations, excellent DX |
| **Cache** | Redis | Session storage, price caching, rate limiting |
| **Queue** | BullMQ (Redis) | Background jobs (notifications, price updates) |
| **WebSockets** | Socket.io | Real-time price updates |
| **Validation** | Zod | Runtime validation, TypeScript integration |
| **Testing** | Vitest + Supertest | Fast, TypeScript-native testing |

### Alternative Consideration

| Alternative | When to Consider |
|-------------|------------------|
| **Go** | If team has Go expertise; better for high-throughput scenarios |
| **Python + FastAPI** | If ML/data science features planned; existing Python team |

---

## 2. Database Schema

### 2.1 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    users     │───────│  portfolios  │───────│   holdings   │
└──────────────┘       └──────────────┘       └──────────────┘
       │                      │                      │
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   sessions   │       │    loans     │       │ protections  │
└──────────────┘       └──────────────┘       └──────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │ installments │
                       └──────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    ledger    │       │  action_log  │       │    prices    │
└──────────────┘       └──────────────┘       └──────────────┘

┌──────────────┐       ┌──────────────┐
│    assets    │       │  otp_codes   │
└──────────────┘       └──────────────┘
```

### 2.2 Core Tables

#### `users`
```sql
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone               VARCHAR(15) UNIQUE NOT NULL,       -- +989XXXXXXXXX
    phone_verified      BOOLEAN DEFAULT FALSE,

    -- Risk Profile
    risk_score          INTEGER CHECK (risk_score BETWEEN 1 AND 10),
    risk_tier           VARCHAR(20),                       -- LOW, MEDIUM, HIGH
    risk_profile_name   VARCHAR(50),                       -- Capital Preservation, etc.
    target_foundation   DECIMAL(5,2),                      -- e.g., 50.00
    target_growth       DECIMAL(5,2),
    target_upside       DECIMAL(5,2),
    questionnaire_data  JSONB,                             -- Raw questionnaire answers

    -- Consent
    consent_risk        BOOLEAN DEFAULT FALSE,
    consent_loss        BOOLEAN DEFAULT FALSE,
    consent_no_guarantee BOOLEAN DEFAULT FALSE,
    consent_timestamp   TIMESTAMPTZ,

    -- Settings
    biometric_enabled   BOOLEAN DEFAULT FALSE,
    pin_hash            VARCHAR(255),
    notification_token  VARCHAR(255),                      -- FCM/APNs token

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    last_login_at       TIMESTAMPTZ
);

CREATE INDEX idx_users_phone ON users(phone);
```

#### `portfolios`
```sql
CREATE TABLE portfolios (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Cash Balance
    cash_irr            DECIMAL(20,2) DEFAULT 0,           -- Available cash in IRR

    -- Portfolio Status
    status              VARCHAR(20) DEFAULT 'BALANCED',    -- BALANCED, SLIGHTLY_OFF, ATTENTION_REQUIRED

    -- Fixed Income Tracking
    fixed_income_start  TIMESTAMPTZ,                       -- For interest accrual

    -- Metrics (denormalized for performance)
    total_value_irr     DECIMAL(20,2),
    holdings_value_irr  DECIMAL(20,2),
    foundation_pct      DECIMAL(5,2),
    growth_pct          DECIMAL(5,2),
    upside_pct          DECIMAL(5,2),

    -- Rebalancing
    last_rebalance_at   TIMESTAMPTZ,
    drift_detected_at   TIMESTAMPTZ,

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id)
);

CREATE INDEX idx_portfolios_user ON portfolios(user_id);
```

#### `holdings`
```sql
CREATE TABLE holdings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id        UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    asset_id            VARCHAR(30) NOT NULL,              -- BTC, ETH, etc.

    quantity            DECIMAL(18,8) NOT NULL,            -- Stored as quantity, not value
    layer               VARCHAR(20) NOT NULL,              -- FOUNDATION, GROWTH, UPSIDE
    frozen              BOOLEAN DEFAULT FALSE,             -- Locked as loan collateral

    -- Fixed Income specific
    purchase_date       TIMESTAMPTZ,                       -- For interest accrual

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(portfolio_id, asset_id)
);

CREATE INDEX idx_holdings_portfolio ON holdings(portfolio_id);
CREATE INDEX idx_holdings_asset ON holdings(asset_id);
CREATE INDEX idx_holdings_frozen ON holdings(portfolio_id, frozen);
```

#### `loans`
```sql
CREATE TABLE loans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id        UUID REFERENCES portfolios(id) ON DELETE CASCADE,

    -- Collateral
    collateral_asset_id VARCHAR(30) NOT NULL,
    collateral_quantity DECIMAL(18,8) NOT NULL,
    collateral_value_irr DECIMAL(20,2) NOT NULL,           -- Value at loan creation

    -- Loan Details
    principal_irr       DECIMAL(20,2) NOT NULL,            -- Amount borrowed
    interest_rate       DECIMAL(5,4) DEFAULT 0.30,         -- 30% annual
    duration_months     INTEGER CHECK (duration_months IN (3, 6)),

    -- Interest Calculation
    total_interest_irr  DECIMAL(20,2) NOT NULL,            -- Pre-calculated
    total_due_irr       DECIMAL(20,2) NOT NULL,            -- principal + interest

    -- Payment Tracking
    paid_irr            DECIMAL(20,2) DEFAULT 0,
    installments_paid   INTEGER DEFAULT 0,

    -- Dates
    start_date          TIMESTAMPTZ NOT NULL,
    due_date            TIMESTAMPTZ NOT NULL,

    -- Status
    status              VARCHAR(20) DEFAULT 'ACTIVE',      -- ACTIVE, REPAID, LIQUIDATED

    -- LTV Tracking
    max_ltv             DECIMAL(5,2) NOT NULL,             -- Layer-based: 70/50/30
    current_ltv         DECIMAL(5,2),                      -- Updated on price changes

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loans_portfolio ON loans(portfolio_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_due_date ON loans(due_date) WHERE status = 'ACTIVE';
```

#### `loan_installments`
```sql
CREATE TABLE loan_installments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id             UUID REFERENCES loans(id) ON DELETE CASCADE,

    number              INTEGER NOT NULL CHECK (number BETWEEN 1 AND 6),
    due_date            TIMESTAMPTZ NOT NULL,

    principal_irr       DECIMAL(20,2) NOT NULL,
    interest_irr        DECIMAL(20,2) NOT NULL,
    total_irr           DECIMAL(20,2) NOT NULL,
    paid_irr            DECIMAL(20,2) DEFAULT 0,

    status              VARCHAR(20) DEFAULT 'PENDING',     -- PENDING, PARTIAL, PAID
    paid_at             TIMESTAMPTZ,

    created_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(loan_id, number)
);

CREATE INDEX idx_installments_loan ON loan_installments(loan_id);
CREATE INDEX idx_installments_due ON loan_installments(due_date) WHERE status != 'PAID';
```

#### `protections`
```sql
CREATE TABLE protections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id        UUID REFERENCES portfolios(id) ON DELETE CASCADE,

    asset_id            VARCHAR(30) NOT NULL,
    notional_irr        DECIMAL(20,2) NOT NULL,            -- Protected value
    premium_irr         DECIMAL(20,2) NOT NULL,            -- Cost paid

    duration_months     INTEGER CHECK (duration_months BETWEEN 1 AND 6),
    start_date          TIMESTAMPTZ NOT NULL,
    end_date            TIMESTAMPTZ NOT NULL,

    status              VARCHAR(20) DEFAULT 'ACTIVE',      -- ACTIVE, EXPIRED, CANCELLED
    cancelled_at        TIMESTAMPTZ,

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_protections_portfolio ON protections(portfolio_id);
CREATE INDEX idx_protections_asset ON protections(portfolio_id, asset_id);
CREATE INDEX idx_protections_expiry ON protections(end_date) WHERE status = 'ACTIVE';
```

#### `ledger` (Immutable Transaction Log)
```sql
CREATE TABLE ledger (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id        UUID REFERENCES portfolios(id) ON DELETE CASCADE,

    -- Entry Type
    entry_type          VARCHAR(30) NOT NULL,              -- See entry types below

    -- Snapshot Data
    before_snapshot     JSONB NOT NULL,                    -- Portfolio state before
    after_snapshot      JSONB NOT NULL,                    -- Portfolio state after

    -- Transaction Details
    asset_id            VARCHAR(30),
    quantity            DECIMAL(18,8),
    amount_irr          DECIMAL(20,2),

    -- Boundary Classification
    boundary            VARCHAR(20),                       -- SAFE, DRIFT, STRUCTURAL, STRESS

    -- Related Entities
    loan_id             UUID REFERENCES loans(id),
    protection_id       UUID REFERENCES protections(id),

    -- Metadata
    message             TEXT,                              -- Human-readable summary
    metadata            JSONB,                             -- Additional context

    -- Blockchain-style immutability
    sequence_number     BIGSERIAL,
    prev_hash           VARCHAR(64),
    entry_hash          VARCHAR(64),

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- No UPDATE/DELETE allowed on ledger
CREATE INDEX idx_ledger_portfolio ON ledger(portfolio_id);
CREATE INDEX idx_ledger_sequence ON ledger(portfolio_id, sequence_number);
CREATE INDEX idx_ledger_type ON ledger(entry_type);
CREATE INDEX idx_ledger_created ON ledger(created_at);
```

**Ledger Entry Types:**
- `PORTFOLIO_CREATED`
- `ADD_FUNDS`
- `TRADE_BUY`
- `TRADE_SELL`
- `REBALANCE`
- `PROTECTION_PURCHASE`
- `PROTECTION_CANCEL`
- `PROTECTION_EXPIRE`
- `LOAN_CREATE`
- `LOAN_REPAY`
- `LOAN_LIQUIDATE`
- `PRICE_CHANGE` (optional, for audit)

#### `action_log` (Activity Feed - Lightweight)
```sql
CREATE TABLE action_log (
    id                  BIGSERIAL PRIMARY KEY,
    portfolio_id        UUID REFERENCES portfolios(id) ON DELETE CASCADE,

    action_type         VARCHAR(30) NOT NULL,
    boundary            VARCHAR(20),
    message             TEXT NOT NULL,                     -- Pre-formatted display text

    amount_irr          DECIMAL(20,2),
    asset_id            VARCHAR(30),

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Only keep last 50 per portfolio (cleanup job)
CREATE INDEX idx_action_log_portfolio ON action_log(portfolio_id, created_at DESC);
```

#### `assets` (Asset Registry)
```sql
CREATE TABLE assets (
    id                  VARCHAR(30) PRIMARY KEY,           -- BTC, ETH, etc.
    name                VARCHAR(100) NOT NULL,

    layer               VARCHAR(20) NOT NULL,              -- FOUNDATION, GROWTH, UPSIDE
    layer_weight        DECIMAL(5,4) NOT NULL,             -- e.g., 0.2500

    volatility          DECIMAL(5,4),
    liquidity_score     DECIMAL(5,4),

    -- LTV and Protection
    max_ltv             DECIMAL(5,4) NOT NULL,             -- 0.70, 0.50, 0.30
    protection_eligible BOOLEAN DEFAULT TRUE,
    protection_rate     DECIMAL(5,4),                      -- Monthly premium rate

    -- Pricing
    coingecko_id        VARCHAR(50),
    finnhub_symbol      VARCHAR(20),
    is_internal         BOOLEAN DEFAULT FALSE,             -- IRR_FIXED_INCOME
    default_price_usd   DECIMAL(20,8),

    -- Trading
    min_trade_irr       DECIMAL(20,2) DEFAULT 1000000,
    spread              DECIMAL(5,4),                      -- e.g., 0.0030 for 0.30%
    decimals            INTEGER DEFAULT 8,

    active              BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

#### `prices` (Price Cache)
```sql
CREATE TABLE prices (
    asset_id            VARCHAR(30) PRIMARY KEY REFERENCES assets(id),

    price_usd           DECIMAL(20,8) NOT NULL,
    price_irr           DECIMAL(20,2) NOT NULL,

    fx_rate             DECIMAL(15,2) NOT NULL,            -- USD/IRR rate used
    fx_source           VARCHAR(20),                       -- bonbast, fallback

    source              VARCHAR(30),                       -- coingecko, finnhub, internal
    fetched_at          TIMESTAMPTZ NOT NULL,

    -- 24h change
    change_24h_pct      DECIMAL(8,4),

    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prices_updated ON prices(updated_at);
```

#### `otp_codes` (Phone Verification)
```sql
CREATE TABLE otp_codes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone               VARCHAR(15) NOT NULL,
    code                VARCHAR(6) NOT NULL,

    attempts            INTEGER DEFAULT 0,
    verified            BOOLEAN DEFAULT FALSE,

    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_phone ON otp_codes(phone, expires_at);
```

#### `sessions` (JWT Session Tracking)
```sql
CREATE TABLE sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE,

    refresh_token_hash  VARCHAR(64) UNIQUE NOT NULL,
    device_info         JSONB,
    ip_address          INET,

    expires_at          TIMESTAMPTZ NOT NULL,
    revoked             BOOLEAN DEFAULT FALSE,
    revoked_at          TIMESTAMPTZ,

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(refresh_token_hash);
```

### 2.3 Database Policies & Constraints

```sql
-- Row Level Security for multi-tenant isolation
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE protections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;

-- Ledger immutability
CREATE RULE ledger_no_update AS ON UPDATE TO ledger DO INSTEAD NOTHING;
CREATE RULE ledger_no_delete AS ON DELETE TO ledger DO INSTEAD NOTHING;

-- Ensure target allocations sum to 100%
ALTER TABLE users ADD CONSTRAINT check_allocation_sum
    CHECK (target_foundation + target_growth + target_upside = 100.00);
```

---

## 3. API Architecture

### 3.1 API Overview

```
/api/v1
├── /auth
│   ├── POST   /send-otp          # Send OTP to phone
│   ├── POST   /verify-otp        # Verify OTP, create session
│   ├── POST   /refresh           # Refresh access token
│   ├── POST   /logout            # Revoke session
│   └── POST   /biometric         # Biometric auth challenge
│
├── /onboarding
│   ├── POST   /questionnaire     # Submit risk questionnaire
│   ├── POST   /consent           # Record consent
│   └── POST   /initial-funding   # Create portfolio with initial investment
│
├── /portfolio
│   ├── GET    /                  # Get portfolio summary
│   ├── GET    /holdings          # Get all holdings with values
│   ├── GET    /snapshot          # Full portfolio snapshot
│   └── POST   /add-funds         # Add cash to portfolio
│
├── /trade
│   ├── POST   /preview           # Preview trade impact
│   ├── POST   /execute           # Execute trade
│   └── GET    /limits            # Get trading limits
│
├── /rebalance
│   ├── GET    /preview           # Preview rebalance trades
│   ├── POST   /execute           # Execute rebalance
│   └── GET    /status            # Check drift status
│
├── /protection
│   ├── GET    /                  # List active protections
│   ├── POST   /                  # Purchase protection
│   ├── GET    /:id               # Get protection details
│   ├── DELETE /:id               # Cancel protection
│   └── GET    /eligible          # List eligible assets
│
├── /loans
│   ├── GET    /                  # List all loans
│   ├── POST   /                  # Create new loan
│   ├── GET    /:id               # Get loan details with installments
│   ├── POST   /:id/repay         # Make repayment
│   ├── GET    /capacity          # Get borrowing capacity
│   └── GET    /health            # Get loan health indicators
│
├── /history
│   ├── GET    /                  # Paginated ledger entries
│   ├── GET    /export            # Export as CSV
│   └── GET    /:id               # Single entry with full details
│
├── /activity
│   └── GET    /                  # Get action log (last 50)
│
├── /prices
│   ├── GET    /                  # Get all current prices
│   ├── GET    /:assetId          # Get single asset price
│   └── WS     /stream            # WebSocket price updates
│
└── /profile
    ├── GET    /                  # Get user profile
    ├── PUT    /settings          # Update settings
    ├── POST   /retake-quiz       # Retake risk questionnaire
    └── DELETE /                  # Delete account
```

### 3.2 Request/Response Examples

#### Auth: Send OTP
```http
POST /api/v1/auth/send-otp
Content-Type: application/json

{
  "phone": "+989123456789"
}

---
Response 200:
{
  "success": true,
  "message": "OTP sent",
  "expiresIn": 120
}
```

#### Trade: Preview
```http
POST /api/v1/trade/preview
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "BUY",
  "assetId": "BTC",
  "amountIRR": 50000000
}

---
Response 200:
{
  "valid": true,
  "preview": {
    "action": "BUY",
    "assetId": "BTC",
    "quantity": 0.00035,
    "amountIRR": 50000000,
    "priceIRR": 141960000000,
    "spread": 0.003,
    "spreadAmountIRR": 150000
  },
  "allocation": {
    "before": { "FOUNDATION": 50, "GROWTH": 35, "UPSIDE": 15 },
    "target": { "FOUNDATION": 50, "GROWTH": 35, "UPSIDE": 15 },
    "after":  { "FOUNDATION": 48, "GROWTH": 38, "UPSIDE": 14 }
  },
  "boundary": "DRIFT",
  "frictionCopy": "This moves you slightly away from your target. You can rebalance later.",
  "movesToward": false
}
```

#### Loan: Create
```http
POST /api/v1/loans
Authorization: Bearer <token>
Content-Type: application/json

{
  "collateralAssetId": "BTC",
  "amountIRR": 30000000,
  "durationMonths": 3
}

---
Response 201:
{
  "loan": {
    "id": "loan_abc123",
    "collateralAssetId": "BTC",
    "collateralQuantity": 0.0005,
    "collateralValueIRR": 70980000000,
    "principalIRR": 30000000,
    "interestRate": 0.30,
    "totalInterestIRR": 2250000,
    "totalDueIRR": 32250000,
    "durationMonths": 3,
    "startDate": "2026-01-20T12:00:00Z",
    "dueDate": "2026-04-20T12:00:00Z",
    "installments": [
      { "number": 1, "dueDate": "...", "totalIRR": 5375000, "status": "PENDING" },
      // ... 5 more
    ],
    "ltv": 50,
    "status": "ACTIVE"
  },
  "cashAdded": 30000000,
  "holdingFrozen": true
}
```

### 3.3 Error Response Format

```json
{
  "error": {
    "code": "INSUFFICIENT_CASH",
    "message": "Not enough cash for this trade",
    "details": {
      "required": 50000000,
      "available": 30000000
    }
  }
}
```

**Error Codes:**
- `UNAUTHORIZED` - Invalid/expired token
- `FORBIDDEN` - Action not permitted
- `NOT_FOUND` - Resource doesn't exist
- `VALIDATION_ERROR` - Invalid input
- `INSUFFICIENT_CASH` - Not enough cash
- `INSUFFICIENT_HOLDINGS` - Not enough asset quantity
- `ASSET_FROZEN` - Holding is collateral
- `EXCEEDS_PORTFOLIO_LOAN_LIMIT` - 25% cap exceeded
- `EXCEEDS_ASSET_LTV` - Layer LTV exceeded
- `PROTECTION_EXISTS` - Already protected
- `PROTECTION_NOT_ELIGIBLE` - Asset can't be protected
- `REBALANCE_TOO_SOON` - < 24h since last rebalance
- `RATE_LIMITED` - Too many requests

---

## 4. Authentication & Security

### 4.1 Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Send OTP   │────▶│  SMS/Kavenegar │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │            ┌─────────────┐
       │            │  Store OTP  │
       │            │  (Redis/DB) │
       │            └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│ Verify OTP  │────▶│  Validate   │
└─────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │            ┌─────────────┐
       ▼            │Create/Get   │
┌─────────────┐     │   User      │
│Return Tokens│◀────└─────────────┘
└─────────────┘
```

### 4.2 JWT Token Structure

**Access Token (15 min expiry):**
```json
{
  "sub": "user_uuid",
  "phone": "+989123456789",
  "portfolioId": "portfolio_uuid",
  "iat": 1705750800,
  "exp": 1705751700
}
```

**Refresh Token (7 days expiry):**
```json
{
  "sub": "user_uuid",
  "sessionId": "session_uuid",
  "iat": 1705750800,
  "exp": 1706355600
}
```

### 4.3 Security Measures

| Measure | Implementation |
|---------|----------------|
| **HTTPS/TLS** | TLS 1.3 minimum, HSTS headers |
| **Rate Limiting** | 30 OTP/hour/phone, 100 API calls/min |
| **Input Validation** | Zod schemas on all inputs |
| **SQL Injection** | Prisma parameterized queries |
| **XSS** | No HTML rendering, JSON-only API |
| **CORS** | Whitelist mobile/web origins |
| **Secrets** | Environment variables, never in code |
| **Logging** | Audit log, no PII in logs |
| **Certificate Pinning** | Provide public key hash to mobile apps |

### 4.4 OTP Service (Iran SMS)

```typescript
// Recommended: Kavenegar for Iran SMS
interface OTPService {
  send(phone: string): Promise<{ success: boolean; expiresIn: number }>;
  verify(phone: string, code: string): Promise<boolean>;
}

// Configuration
OTP_LENGTH = 6
OTP_EXPIRY = 120 seconds
OTP_MAX_ATTEMPTS = 3
OTP_RATE_LIMIT = 3 per 5 minutes
```

---

## 5. Business Logic Services

### 5.1 Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Fastify)                     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
├─────────────┬─────────────┬─────────────┬─────────────────── │
│ AuthService │ Portfolio   │ TradeService│ RebalanceService   │
│             │ Service     │             │                    │
├─────────────┼─────────────┼─────────────┼─────────────────── │
│ LoanService │ Protection  │ LedgerService│ PriceService      │
│             │ Service     │              │                   │
└─────────────┴─────────────┴─────────────┴─────────────────── ┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer (Prisma)                     │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Core Services

#### RiskScoringService
```typescript
class RiskScoringService {
  calculateScore(answers: QuestionnaireAnswers): RiskResult {
    // Implements Section 17 of PRD
    // - Weighted dimension scores
    // - Conservative dominance rule
    // - Horizon hard caps
    // - Pathological user detection
    // - Consistency penalties
  }

  getTargetAllocation(score: number): TargetAllocation {
    // Maps score 1-10 to Foundation/Growth/Upside percentages
  }
}
```

#### PortfolioService
```typescript
class PortfolioService {
  async getSnapshot(portfolioId: string): Promise<PortfolioSnapshot> {
    // Returns full portfolio state with calculated values
  }

  async calculateLayerAllocations(holdings: Holding[], prices: Prices): Promise<LayerPcts> {
    // Calculates current Foundation/Growth/Upside %
  }

  async determineStatus(current: LayerPcts, target: LayerPcts): Promise<PortfolioStatus> {
    // BALANCED, SLIGHTLY_OFF, ATTENTION_REQUIRED
  }

  async addFunds(portfolioId: string, amountIRR: number): Promise<Transaction> {
    // Adds cash, logs to ledger
  }
}
```

#### TradeService
```typescript
class TradeService {
  async preview(portfolioId: string, trade: TradeRequest): Promise<TradePreview> {
    // Calculates before/after allocation
    // Determines boundary classification
    // Returns friction copy if needed
  }

  async execute(portfolioId: string, trade: ValidatedTrade): Promise<TradeResult> {
    // Validates again
    // Updates holdings
    // Deducts/adds cash
    // Logs to ledger and action_log
  }
}
```

#### RebalanceService
```typescript
class RebalanceService {
  async preview(portfolioId: string, mode: RebalanceMode): Promise<RebalancePreview> {
    // Implements HRAM algorithm (Section 19)
    // - Four-factor model
    // - Strategy presets
    // - Frozen collateral handling
    // - Gap analysis
  }

  async execute(portfolioId: string, preview: RebalancePreview): Promise<RebalanceResult> {
    // Execute all trades atomically
    // Handle partial rebalance if frozen collateral
    // Log to ledger
  }
}
```

#### LoanService
```typescript
class LoanService {
  async calculateCapacity(portfolioId: string): Promise<LoanCapacity> {
    // 25% portfolio limit
    // Per-asset LTV by layer (70/50/30)
  }

  async createLoan(portfolioId: string, request: LoanRequest): Promise<Loan> {
    // Validate capacity
    // Freeze collateral
    // Create installment schedule
    // Add cash to portfolio
    // Log to ledger
  }

  async repay(loanId: string, amountIRR: number): Promise<RepaymentResult> {
    // Apply to installments in order
    // Check for full settlement
    // Unfreeze collateral if settled
    // Log to ledger
  }

  async checkLiquidation(loanId: string): Promise<boolean> {
    // collateralValue < principalIRR triggers liquidation
  }
}
```

#### ProtectionService
```typescript
class ProtectionService {
  async calculatePremium(assetId: string, notionalIRR: number, months: number): Promise<number> {
    // Layer-based rates: 0.4%, 0.8%, 1.2% per month
  }

  async purchase(portfolioId: string, request: ProtectionRequest): Promise<Protection> {
    // Validate eligibility
    // Deduct premium from cash
    // Create protection record
    // Log to ledger
  }

  async cancel(protectionId: string): Promise<void> {
    // Mark as cancelled (no refund)
    // Log to ledger
  }
}
```

#### BoundaryService
```typescript
class BoundaryService {
  classifyBoundary(before: PortfolioStatus, after: PortfolioStatus): Boundary {
    // Implements Section 20 matrix
    // Returns SAFE, DRIFT, STRUCTURAL, or STRESS
  }

  getFrictionCopy(boundary: Boundary, context?: string): string {
    // Returns appropriate warning message
  }
}
```

### 5.3 Ledger Service (Audit Trail)

```typescript
class LedgerService {
  async record(entry: LedgerEntry): Promise<LedgerRecord> {
    // Calculate entry hash (SHA-256)
    // Link to previous entry hash (chain)
    // Insert immutable record
  }

  async getHistory(portfolioId: string, pagination: Pagination): Promise<LedgerPage> {
    // Returns paginated ledger with before/after snapshots
  }

  async exportCSV(portfolioId: string): Promise<string> {
    // Generates CSV export
  }

  verifyChain(portfolioId: string): Promise<boolean> {
    // Verifies hash chain integrity
  }
}
```

---

## 6. Real-time Features

### 6.1 WebSocket Price Streaming

```typescript
// Server
io.on('connection', (socket) => {
  socket.on('subscribe:prices', (assetIds: string[]) => {
    socket.join(assetIds.map(id => `price:${id}`));
  });
});

// Price update broadcast
priceService.on('update', (assetId, price) => {
  io.to(`price:${assetId}`).emit('price:update', { assetId, ...price });
});

// Client message format
{
  "event": "price:update",
  "data": {
    "assetId": "BTC",
    "priceUSD": 97500,
    "priceIRR": 141960000000,
    "change24h": 2.5,
    "timestamp": "2026-01-20T12:00:00Z"
  }
}
```

### 6.2 Push Notifications

```typescript
// Notification triggers
interface NotificationService {
  // Portfolio drift > 5%
  sendDriftAlert(userId: string, drift: number): Promise<void>;

  // Loan installment due in 3 days
  sendInstallmentReminder(userId: string, loan: Loan): Promise<void>;

  // Protection expiring in 7 days
  sendProtectionExpiry(userId: string, protection: Protection): Promise<void>;

  // Significant price movement (>10% in 24h)
  sendPriceAlert(userId: string, assetId: string, change: number): Promise<void>;
}
```

### 6.3 Background Jobs (BullMQ)

```typescript
// Scheduled jobs
const jobs = {
  // Every 30 seconds
  'price:fetch': '*/30 * * * * *',

  // Every hour - check loan health
  'loans:health-check': '0 * * * *',

  // Every hour - check protection expiry
  'protections:expiry-check': '0 * * * *',

  // Daily - clean old OTP codes
  'otp:cleanup': '0 0 * * *',

  // Daily - clean action_log to 50 per portfolio
  'action-log:cleanup': '0 1 * * *',

  // Daily - portfolio status update
  'portfolios:status-update': '0 2 * * *'
};
```

---

## 7. External Integrations

### 7.1 Price Data Sources

```typescript
// CoinGecko - Crypto prices
interface CoinGeckoService {
  endpoint: 'https://api.coingecko.com/api/v3/simple/price';
  assets: ['bitcoin', 'ethereum', 'solana', ...];
  rateLimit: 30; // calls per minute
}

// Finnhub - Stock/ETF prices
interface FinnhubService {
  endpoint: 'https://finnhub.io/api/v1/quote';
  assets: ['QQQ'];
  apiKey: process.env.FINNHUB_API_KEY;
  rateLimit: 60; // calls per minute
}

// Bonbast - USD/IRR rate
interface BonbastService {
  endpoint: 'https://bonbast.amirhn.com/latest';
  fallbackRate: 1456000;
}
```

### 7.2 SMS Provider (Kavenegar)

```typescript
interface KavenegarService {
  apiKey: process.env.KAVENEGAR_API_KEY;

  sendOTP(phone: string, code: string): Promise<{ messageId: string }>;
  verifyDelivery(messageId: string): Promise<DeliveryStatus>;
}
```

### 7.3 Push Notification (Firebase)

```typescript
interface FCMService {
  sendToDevice(token: string, notification: Notification): Promise<void>;
  sendToTopic(topic: string, notification: Notification): Promise<void>;
}
```

---

## 8. Infrastructure & Deployment

### 8.1 Architecture Diagram

```
                    ┌─────────────────┐
                    │   CloudFlare    │
                    │   (CDN + WAF)   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Load Balancer │
                    │   (nginx/ALB)   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
│   API Server  │   │   API Server  │   │   API Server  │
│   (Fastify)   │   │   (Fastify)   │   │   (Fastify)   │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
│  PostgreSQL   │   │     Redis     │   │   Worker      │
│  (Primary)    │   │   (Cache +    │   │   (BullMQ)    │
│               │   │    Queue)     │   │               │
└───────┬───────┘   └───────────────┘   └───────────────┘
        │
┌───────▼───────┐
│  PostgreSQL   │
│  (Replica)    │
└───────────────┘
```

### 8.2 Environment Configuration

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/blumarkets
DATABASE_REPLICA_URL=postgresql://user:pass@replica:5432/blumarkets

# Redis
REDIS_URL=redis://host:6379

# Authentication
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# External APIs
COINGECKO_API_KEY=...  # Optional for higher rate limits
FINNHUB_API_KEY=...
KAVENEGAR_API_KEY=...
FCM_SERVER_KEY=...

# Feature flags
ENABLE_PRICE_WEBSOCKET=true
ENABLE_PUSH_NOTIFICATIONS=true

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 8.3 Deployment Options

| Option | Pros | Cons |
|--------|------|------|
| **Docker + Kubernetes** | Scalable, portable | Complex setup |
| **Railway/Render** | Simple, managed | Less control |
| **AWS ECS/Fargate** | Scalable, AWS ecosystem | AWS lock-in |
| **DigitalOcean App Platform** | Simple, affordable | Limited regions |

### 8.4 Recommended: Docker Compose (Development)

```yaml
version: '3.8'
services:
  api:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/blumarkets
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  worker:
    build: ./backend
    command: npm run worker
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/blumarkets
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=blumarkets
      - POSTGRES_PASSWORD=postgres

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup (Fastify + TypeScript + Prisma)
- [ ] Database schema implementation
- [ ] Authentication service (OTP + JWT)
- [ ] Basic user CRUD
- [ ] Price service (external API integration)
- [ ] Unit tests setup

### Phase 2: Onboarding (Week 3)
- [ ] Risk scoring algorithm
- [ ] Questionnaire submission endpoint
- [ ] Consent recording
- [ ] Portfolio creation with initial funding
- [ ] Ledger service basics

### Phase 3: Portfolio Core (Week 4)
- [ ] Portfolio snapshot endpoint
- [ ] Holdings management
- [ ] Add funds flow
- [ ] Portfolio status calculation
- [ ] Action log

### Phase 4: Trading (Week 5)
- [ ] Trade preview with boundary classification
- [ ] Trade execution
- [ ] Spread calculation
- [ ] Validation rules
- [ ] Ledger integration

### Phase 5: Rebalancing (Week 6)
- [ ] HRAM algorithm implementation
- [ ] Rebalance preview
- [ ] Rebalance execution
- [ ] Frozen collateral handling
- [ ] Gap analysis

### Phase 6: Loans (Week 7)
- [ ] Loan capacity calculation
- [ ] Loan creation with collateral freeze
- [ ] Installment schedule generation
- [ ] Repayment processing
- [ ] Settlement and unfreeze

### Phase 7: Protection (Week 8)
- [ ] Premium calculation
- [ ] Protection purchase
- [ ] Protection cancellation
- [ ] Expiry handling

### Phase 8: Real-time & Notifications (Week 9)
- [ ] WebSocket price streaming
- [ ] Push notification service
- [ ] Background jobs setup
- [ ] Alert triggers

### Phase 9: Polish & Security (Week 10)
- [ ] Rate limiting
- [ ] Input validation hardening
- [ ] Error handling standardization
- [ ] API documentation (OpenAPI)
- [ ] Load testing

### Phase 10: Deployment (Week 11-12)
- [ ] CI/CD pipeline
- [ ] Staging environment
- [ ] Production deployment
- [ ] Monitoring setup (Grafana, Sentry)
- [ ] Backup configuration

---

## Appendix A: File Structure

```
blu-markets-backend/
├── src/
│   ├── app.ts                    # Fastify app setup
│   ├── server.ts                 # Server entry point
│   │
│   ├── config/
│   │   ├── env.ts               # Environment validation
│   │   ├── database.ts          # Prisma client
│   │   └── redis.ts             # Redis client
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.schemas.ts
│   │   │   └── otp.service.ts
│   │   │
│   │   ├── portfolio/
│   │   │   ├── portfolio.controller.ts
│   │   │   ├── portfolio.service.ts
│   │   │   ├── portfolio.routes.ts
│   │   │   └── portfolio.schemas.ts
│   │   │
│   │   ├── trade/
│   │   ├── rebalance/
│   │   ├── loans/
│   │   ├── protection/
│   │   ├── history/
│   │   └── prices/
│   │
│   ├── services/
│   │   ├── risk-scoring.service.ts
│   │   ├── boundary.service.ts
│   │   ├── ledger.service.ts
│   │   ├── notification.service.ts
│   │   └── price-fetcher.service.ts
│   │
│   ├── lib/
│   │   ├── hram/                # HRAM algorithm
│   │   ├── validation/          # Shared validators
│   │   └── utils/               # Utility functions
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   └── error-handler.middleware.ts
│   │
│   ├── types/
│   │   ├── domain.ts            # Business types (shared with frontend)
│   │   └── api.ts               # API-specific types
│   │
│   └── workers/
│       ├── price-updater.worker.ts
│       ├── loan-health.worker.ts
│       └── notification.worker.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docker-compose.yml
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## Appendix B: Shared Types (Frontend/Backend)

The following types should be shared between frontend and backend (via npm package or copy):

```typescript
// types/domain.ts
export type AssetId =
  | 'USDT' | 'PAXG' | 'IRR_FIXED_INCOME'  // Foundation
  | 'BTC' | 'ETH' | 'BNB' | 'XRP' | 'KAG' | 'QQQ'  // Growth
  | 'SOL' | 'TON' | 'LINK' | 'AVAX' | 'MATIC' | 'ARB';  // Upside

export type Layer = 'FOUNDATION' | 'GROWTH' | 'UPSIDE';
export type Boundary = 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';
export type PortfolioStatus = 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';
export type LoanStatus = 'ACTIVE' | 'REPAID' | 'LIQUIDATED';
export type ProtectionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type InstallmentStatus = 'PENDING' | 'PARTIAL' | 'PAID';

export interface TargetAllocation {
  foundation: number;
  growth: number;
  upside: number;
}

export interface Holding {
  assetId: AssetId;
  quantity: number;
  layer: Layer;
  frozen: boolean;
  valueIRR: number;
}

// ... etc
```

---

## Next Steps

1. **Review this plan** - Confirm technology choices and architecture
2. **Set up repository** - Initialize the backend project structure
3. **Database setup** - Create Prisma schema and initial migration
4. **Begin Phase 1** - Authentication and core infrastructure

---

*This plan is based on the Blu Markets Mobile App PRD v4.1 and existing frontend codebase analysis.*
