# Blu Markets: Full-Stack Migration Plan

## Overview

This plan migrates the Blu Markets prototype from a frontend-only React app to a full-stack application with:
- **Backend**: Hono (lightweight, TypeScript-native)
- **Database**: PostgreSQL + Prisma
- **Auth**: JWT with refresh tokens
- **Real-time**: WebSockets for price updates
- **State**: React Query (server) + Zustand (client UI)

### Key Principles

1. **Preserve Instant UX** - Keep preview calculations client-side
2. **Backend as Source of Truth** - All commits go through the server
3. **Incremental Migration** - Feature flags to toggle old/new
4. **Shared Types** - Single source of truth for TypeScript types
5. **Offline-First** - Queue actions when disconnected

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ React Query  │  │   Zustand    │  │  Preview Engine  │  │
│  │ - portfolio  │  │ - UI drafts  │  │ - instant calcs  │  │
│  │ - prices     │  │ - tab state  │  │ - validation     │  │
│  │ - user       │  │ - modals     │  │ - what-if        │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                    REST + WebSocket
                              │
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │   Auth   │ │ Portfolio│ │  Price   │ │   Action     │   │
│  │ Service  │ │ Service  │ │ Service  │ │  Processor   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│                              │                              │
│                    ┌─────────┴─────────┐                   │
│                    │    PostgreSQL     │                   │
│                    │    (via Prisma)   │                   │
│                    └───────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Critical Risks & Mitigations

Before implementation, address these production-critical issues:

### Risk 1: Floating Point Precision (Database Schema)

**Issue**: Using `Float` for financial values (`cashIRR`, `quantity`, `amountIRR`) causes precision loss. Example: `0.1 + 0.2 !== 0.3` in floating point math.

**Impact**: Money "leaks" over thousands of transactions in a ledger system.

**Fix**: Use `Decimal` type for all monetary fields in Prisma schema. See updated schema in Phase 1.2.

### Risk 2: Offline Market Trade Execution

**Issue**: Queuing market trades while offline means execution at stale prices when reconnecting.

**Impact**: User queues "Sell BTC" at $100k, reconnects when BTC is $90k, trade executes at lower price.

**Fix**:
- **Read-only offline**: Allow viewing cached portfolio data
- **Block market trades offline**: Return error "Internet required for live pricing"
- **Allow non-market actions**: Profile updates, settings changes can be queued

### Risk 3: Concurrency & Double Spending

**Issue**: Two simultaneous trade requests can race to spend the same cash balance.

**Fix**: Implement Optimistic Concurrency Control (OCC):
- Add `version Int @default(1)` field to Portfolio model
- Update query: `WHERE id = portfolioId AND version = currentVersion`
- On conflict (0 rows affected), retry the transaction

### Risk 4: Browser Globals in Shared Package

**Issue**: Moving files with `localStorage` or `window` references to `packages/shared` will crash the Node.js backend.

**Fix**: Audit imports during Phase 0. Keep browser-specific files in `apps/web`. See Phase 0.1 for the explicit file list.

---

## Phase 0: Preparation (Day 1)

### Goal: Set up shared infrastructure without breaking existing app

### 0.1 Create Monorepo Structure

```
blu-markets/
├── apps/
│   ├── web/                 # Existing frontend (move here)
│   └── api/                 # New backend
├── packages/
│   └── shared/              # Shared types, validation, constants
├── package.json             # Workspace root
└── turbo.json               # Build orchestration
```

**Prompt for Claude:**
```
Help me restructure Blu Markets into a Turborepo monorepo.

Current structure: Single Vite React app in root

Target structure:
- apps/web/ - Move existing frontend here
- apps/api/ - New Hono backend (create empty)
- packages/shared/ - Extract shared code

Tasks:
1. Create root package.json with pnpm workspaces
2. Create turbo.json for build orchestration
3. Move existing code to apps/web/
4. Create packages/shared/ with:
   - Copy src/types/ (all type definitions)
   - Copy src/constants/index.js → constants.ts
   - Copy src/registry/assetRegistry.js → assetRegistry.ts
   - Copy src/config.ts
   - Copy src/engine/* (all engine files - these are pure, no browser deps)
5. Update apps/web imports to use @blu/shared
6. Verify build still works

CRITICAL - Browser-Specific Files (DO NOT move to shared):
These files use localStorage/window and must stay in apps/web:
- src/services/priceCache.ts (localStorage for price caching)
- src/services/priceCoordinator.ts (localStorage + window.addEventListener)
- src/utils/tabCoordinator.js (localStorage + window.addEventListener)
- src/hooks/usePrices.ts (window.addEventListener for online/offline)

Do NOT change any logic, just reorganize.
```

### 0.2 Create API Contract (Zod Schemas)

**File: packages/shared/src/api.ts**
```typescript
import { z } from 'zod';

// ============================================================================
// AUTH
// ============================================================================

export const LoginRequestSchema = z.object({
  phone: z.string().regex(/^09\d{9}$/, 'Invalid Iranian phone number'),
  otp: z.string().length(6),
});

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    phone: z.string(),
    createdAt: z.string().datetime(),
  }),
});

// ============================================================================
// PORTFOLIO
// ============================================================================

export const HoldingSchema = z.object({
  assetId: z.string(),
  quantity: z.number().nonnegative(),
  frozen: z.boolean(),
  layer: z.enum(['FOUNDATION', 'GROWTH', 'UPSIDE']),
});

export const PortfolioResponseSchema = z.object({
  id: z.string(),
  cashIRR: z.number(),
  holdings: z.array(HoldingSchema),
  loans: z.array(z.object({
    id: z.string(),
    collateralAssetId: z.string(),
    amountIRR: z.number(),
    ltv: z.number(),
    liquidationIRR: z.number(),
    startISO: z.string(),
  })),
  protections: z.array(z.object({
    id: z.string(),
    assetId: z.string(),
    notionalIRR: z.number(),
    premiumIRR: z.number(),
    startISO: z.string(),
    endISO: z.string(),
  })),
  targetLayerPct: z.object({
    FOUNDATION: z.number(),
    GROWTH: z.number(),
    UPSIDE: z.number(),
  }),
});

// ============================================================================
// ACTIONS
// ============================================================================

export const TradeRequestSchema = z.object({
  side: z.enum(['BUY', 'SELL']),
  assetId: z.string(),
  amountIRR: z.number().positive(),
  // Slippage protection: reject if price moved beyond tolerance
  expectedPriceUSD: z.number().positive(),
  slippageTolerance: z.number().min(0).max(0.1).default(0.01), // 1% default, max 10%
});

export const ProtectRequestSchema = z.object({
  assetId: z.string(),
  months: z.number().int().min(1).max(6),
});

export const BorrowRequestSchema = z.object({
  assetId: z.string(),
  amountIRR: z.number().positive(),
});

export const RepayRequestSchema = z.object({
  loanId: z.string(),
  amountIRR: z.number().positive(),
});

export const RebalanceRequestSchema = z.object({
  mode: z.enum(['HOLDINGS_ONLY', 'HOLDINGS_PLUS_CASH', 'SMART']),
});

export const AddFundsRequestSchema = z.object({
  amountIRR: z.number().positive(),
});

// ============================================================================
// PRICES
// ============================================================================

export const PricesResponseSchema = z.object({
  prices: z.record(z.string(), z.number()),
  fxRate: z.number(),
  updatedAt: z.string().datetime(),
});

// Type exports
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type PortfolioResponse = z.infer<typeof PortfolioResponseSchema>;
export type TradeRequest = z.infer<typeof TradeRequestSchema>;
export type PricesResponse = z.infer<typeof PricesResponseSchema>;
```

---

## Phase 1: Backend Foundation (Days 2-3)

### Goal: Set up the backend server, database, and authentication

### 1.1 Initialize Backend

**Prompt for Claude:**
```
Create a new Hono backend in apps/api/ with the following:

Tasks:
1. Initialize with: pnpm init, add dependencies:
   - hono (web framework)
   - @hono/node-server (Node.js adapter)
   - prisma, @prisma/client (database)
   - jose (JWT handling)
   - zod (validation - use from @blu/shared)
   - dotenv (env vars)

2. Create folder structure:
   apps/api/
   ├── src/
   │   ├── index.ts          # Entry point
   │   ├── routes/
   │   │   ├── auth.ts
   │   │   ├── portfolio.ts
   │   │   ├── prices.ts
   │   │   └── actions.ts
   │   ├── services/
   │   │   ├── auth.service.ts
   │   │   ├── portfolio.service.ts
   │   │   ├── price.service.ts
   │   │   └── action.service.ts
   │   ├── middleware/
   │   │   ├── auth.ts
   │   │   └── error.ts
   │   └── lib/
   │       ├── prisma.ts
   │       └── jwt.ts
   ├── prisma/
   │   └── schema.prisma
   └── package.json

3. Create basic Hono app with health check endpoint
4. Add scripts: dev, build, start, db:push, db:generate
```

### 1.2 Database Schema

**File: apps/api/prisma/schema.prisma**
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// USER & AUTH
// ============================================================================

model User {
  id            String    @id @default(cuid())
  phone         String    @unique
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Profile from questionnaire
  riskTier      RiskTier  @default(MEDIUM)
  targetFoundation Int    @default(50)
  targetGrowth     Int    @default(35)
  targetUpside     Int    @default(15)

  // Relations
  portfolio     Portfolio?
  refreshTokens RefreshToken[]

  @@index([phone])
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([token])
  @@index([userId])
}

// ============================================================================
// PORTFOLIO
// ============================================================================

model Portfolio {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cashIRR   Decimal  @default(0) @db.Decimal(20, 0) // IRR has no decimals
  version   Int      @default(1) // Optimistic concurrency control
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  holdings    Holding[]
  loans       Loan[]
  protections Protection[]
  ledger      LedgerEntry[]

  @@index([userId])
}

model Holding {
  id          String    @id @default(cuid())
  portfolioId String
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
  assetId     String    // e.g., 'BTC', 'ETH' - NOT an enum for flexibility
  quantity    Decimal   @db.Decimal(20, 8) // Crypto needs high precision
  frozen      Boolean   @default(false)
  layer       Layer
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([portfolioId, assetId])
  @@index([portfolioId])
}

model Loan {
  id                String     @id @default(cuid())
  portfolioId       String
  portfolio         Portfolio  @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
  collateralAssetId String
  amountIRR         Decimal    @db.Decimal(20, 0)
  repaidIRR         Decimal    @default(0) @db.Decimal(20, 0)
  ltv               Decimal    @db.Decimal(5, 4) // e.g., 0.5000 for 50%
  liquidationIRR    Decimal    @db.Decimal(20, 0)
  status            LoanStatus @default(ACTIVE)
  startedAt         DateTime   @default(now())

  @@index([portfolioId])
  @@index([status])
}

model Protection {
  id          String    @id @default(cuid())
  portfolioId String
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
  assetId     String
  notionalIRR Decimal   @db.Decimal(20, 0)
  premiumIRR  Decimal   @db.Decimal(20, 0)
  floorPrice  Decimal?  @db.Decimal(20, 8)
  startedAt   DateTime  @default(now())
  expiresAt   DateTime

  @@index([portfolioId])
  @@index([expiresAt])
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

model LedgerEntry {
  id          String      @id @default(cuid())
  portfolioId String
  portfolio   Portfolio   @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
  type        LedgerType
  details     Json        // Flexible storage for action-specific data

  // Snapshot at time of action (for audit/replay)
  snapshotBefore Json?
  snapshotAfter  Json?

  createdAt   DateTime    @default(now())

  @@index([portfolioId])
  @@index([type])
  @@index([createdAt])
}

// ============================================================================
// ENUMS
// ============================================================================

enum RiskTier {
  LOW
  MEDIUM
  HIGH
}

enum Layer {
  FOUNDATION
  GROWTH
  UPSIDE
}

enum LoanStatus {
  ACTIVE
  REPAID
  LIQUIDATED
}

enum LedgerType {
  PORTFOLIO_CREATED
  ADD_FUNDS
  TRADE
  PROTECT
  BORROW
  REPAY
  REBALANCE
  PROTECTION_CANCELLED
}
```

### 1.3 Authentication Service

**Prompt for Claude:**
```
Create the authentication system for apps/api/

Context:
- Use OTP-based auth (phone number + 6-digit code)
- For prototype, accept any OTP code "123456"
- Use JWT with short-lived access tokens (15min) and long-lived refresh tokens (7 days)
- Store refresh tokens in database

Files to create:
1. src/lib/jwt.ts - JWT sign/verify using jose library
2. src/services/auth.service.ts - Login, refresh, logout logic
3. src/routes/auth.ts - POST /auth/login, POST /auth/refresh, POST /auth/logout
4. src/middleware/auth.ts - Verify JWT and attach user to context

Use Zod schemas from @blu/shared for validation.
Include proper error handling with appropriate HTTP status codes.
```

**Expected API:**
```
POST /auth/request-otp
  Body: { phone: "09123456789" }
  Response: { success: true, expiresIn: 120 }

POST /auth/verify-otp
  Body: { phone: "09123456789", otp: "123456" }
  Response: { accessToken, refreshToken, user }

POST /auth/refresh
  Body: { refreshToken }
  Response: { accessToken, refreshToken }

POST /auth/logout
  Headers: Authorization: Bearer <token>
  Response: { success: true }
```

---

## Phase 2: Price Service (Days 4-5)

### Goal: Move price fetching to backend with WebSocket push

### 2.1 Backend Price Service

**Prompt for Claude:**
```
Create the price service for apps/api/

Context files needed:
- packages/shared/src/assetRegistry.ts (for ASSETS_CONFIG)
- Current apps/web/src/services/priceService.ts (for reference)

Tasks:
1. Create src/services/price.service.ts:
   - Fetch from CoinGecko API (use ASSETS_CONFIG for coingeckoIds)
   - Fetch USD/IRR rate from a public API or use fallback
   - Cache prices in memory with TTL
   - Run fetch every 30 seconds using setInterval
   - Emit price updates via WebSocket

2. Create src/routes/prices.ts:
   - GET /prices - Return current cached prices
   - WebSocket /ws/prices - Push price updates to connected clients

3. Handle errors gracefully:
   - If CoinGecko fails, use cached prices
   - If no cache, use DEFAULT_PRICES from shared
   - Include staleness indicator in response

Environment variables needed:
- COINGECKO_API_URL (optional, has default)
- PRICE_FETCH_INTERVAL_MS (default: 30000)
```

**Expected Response:**
```json
{
  "prices": {
    "BTC": 97500,
    "ETH": 3200,
    "USDT": 1
  },
  "fxRate": 1456000,
  "updatedAt": "2025-01-17T12:00:00Z",
  "isStale": false
}
```

### 2.2 Frontend Price Integration

**Prompt for Claude:**
```
Update the frontend to use the new price API.

Context:
- Current: apps/web/src/hooks/usePrices.ts (complex polling logic)
- Current: apps/web/src/services/priceService.ts

Tasks:
1. Create apps/web/src/lib/api.ts:
   - Axios or fetch wrapper with base URL config
   - Automatic token attachment from storage
   - Token refresh on 401

2. Create apps/web/src/hooks/usePricesV2.ts:
   - Use React Query useQuery for REST fallback
   - Use WebSocket for real-time updates
   - Gracefully degrade to polling if WS fails
   - Export same interface as current usePrices

3. Add feature flag in apps/web/src/config.ts:
   - USE_BACKEND_PRICES: boolean
   - When true, use usePricesV2
   - When false, use existing usePrices

Keep the existing usePrices.ts unchanged for now.
```

---

## Phase 3: Portfolio & Holdings (Days 6-8)

### Goal: Store portfolio data in database, sync with frontend

### 3.1 Portfolio Service

**Prompt for Claude:**
```
Create the portfolio service for apps/api/

Tasks:
1. Create src/services/portfolio.service.ts:
   - getPortfolio(userId) - Fetch portfolio with holdings, loans, protections
   - createPortfolio(userId, initialAmount, targetAllocation) - Create new portfolio
   - computeSnapshot(portfolio, prices, fxRate) - Calculate current values

2. Create src/routes/portfolio.ts:
   - GET /portfolio - Get current user's portfolio
   - POST /portfolio - Create portfolio (during onboarding)

3. The snapshot computation should match the frontend engine exactly.
   Reference: apps/web/src/engine/snapshot.ts

Important: The response should match PortfolioResponseSchema from @blu/shared
```

### 3.2 Frontend Portfolio Integration

**Prompt for Claude:**
```
Add React Query hooks for portfolio data.

Tasks:
1. Create apps/web/src/hooks/usePortfolio.ts:
   ```typescript
   export function usePortfolio() {
     return useQuery({
       queryKey: ['portfolio'],
       queryFn: () => api.get('/portfolio'),
       staleTime: 30_000, // 30 seconds
     });
   }
   ```

2. Create apps/web/src/hooks/usePortfolioSnapshot.ts:
   - Combines usePortfolio() with usePrices()
   - Computes snapshot locally using existing engine/snapshot.ts
   - Returns same shape as current computeSnapshot

3. Add to config.ts:
   - USE_BACKEND_PORTFOLIO: boolean

4. Create apps/web/src/stores/uiStore.ts (Zustand):
   - Move UI-only state here: tab, drafts, showResetConfirm, etc.
   - Keep pendingAction here (it's a preview, not persisted)
```

---

## Phase 4: Action Processing (Days 9-12)

### Goal: Process trades, loans, protections through backend

### 4.1 Action Service

**Prompt for Claude:**
```
Create the action processing service for apps/api/

Context files:
- apps/web/src/engine/validate.ts (validation logic)
- apps/web/src/engine/preview.ts (preview calculations)
- packages/shared/src/api.ts (request schemas)

Tasks:
1. Create src/services/action.service.ts with methods:
   - validateTrade(portfolio, payload, prices, fxRate)
   - executeTrade(portfolio, payload, prices, fxRate)
   - validateProtect(portfolio, payload, prices, fxRate)
   - executeProtect(portfolio, payload, prices, fxRate)
   - validateBorrow(portfolio, payload, prices, fxRate)
   - executeBorrow(portfolio, payload, prices, fxRate)
   - validateRepay(portfolio, payload)
   - executeRepay(portfolio, payload)
   - validateRebalance(portfolio, payload, prices, fxRate)
   - executeRebalance(portfolio, payload, prices, fxRate)
   - addFunds(portfolio, payload)

2. Each execute method should:
   - Validate the action
   - Update holdings/cash/loans/protections
   - Create a LedgerEntry with before/after snapshots
   - Return the updated portfolio

3. Create src/routes/actions.ts:
   - POST /actions/trade
   - POST /actions/protect
   - POST /actions/borrow
   - POST /actions/repay
   - POST /actions/rebalance
   - POST /actions/add-funds

4. All routes should use the auth middleware.

Important: The validation logic should EXACTLY match the frontend.
Copy the validation functions from validate.ts, adapting for the service pattern.
```

### 4.2 Frontend Action Integration

**Prompt for Claude:**
```
Add React Query mutations for actions.

Tasks:
1. Create apps/web/src/hooks/useActions.ts:
   ```typescript
   export function useTrade() {
     const queryClient = useQueryClient();

     return useMutation({
       mutationFn: (payload: TradeRequest) => api.post('/actions/trade', payload),
       onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['portfolio'] });
       },
     });
   }

   // Similar for useProtect, useBorrow, useRepay, useRebalance, useAddFunds
   ```

2. Create apps/web/src/hooks/usePreview.ts:
   - Keep using local engine for instant preview
   - previewTrade, previewProtect, etc.
   - Returns pendingAction shape

3. Update the action flow:
   ```
   User fills form → Local preview (instant) → Show confirmation modal
   User confirms → Call mutation → Invalidate queries → UI updates
   ```

4. Add optimistic updates for better UX:
   - On mutate: Optimistically update the query cache
   - On error: Roll back to previous state
   - On success: Replace with server response
```

---

## Phase 5: Onboarding Flow (Days 13-14)

### Goal: Persist user profile and questionnaire results

### 5.1 Onboarding API

**Prompt for Claude:**
```
Create onboarding endpoints for apps/api/

Tasks:
1. Add to src/routes/auth.ts or create src/routes/onboarding.ts:
   - POST /onboarding/profile
     Body: { riskScore, targetAllocation }
     Creates/updates user profile and creates empty portfolio

2. The questionnaire is still processed client-side (it's just UI).
   Only the RESULT is sent to the backend.

3. Update User model update in auth.service.ts to handle profile data.
```

### 5.2 Frontend Onboarding

**Prompt for Claude:**
```
Update onboarding to persist results.

Tasks:
1. Keep the questionnaire flow entirely client-side (no changes needed)

2. After questionnaire completion, before showing result:
   - Call POST /onboarding/profile with calculated risk tier and allocation

3. When user enters investment amount and confirms:
   - Call POST /portfolio with { initialAmount, targetAllocation }

4. After portfolio creation:
   - Redirect to dashboard
   - usePortfolio() will fetch the new portfolio
```

---

## Phase 6: Polish & Production Readiness (Days 15-18)

### 6.1 Error Handling

**Prompt for Claude:**
```
Add comprehensive error handling.

Backend (apps/api/):
1. Create src/middleware/error.ts:
   - Catch all errors
   - Map Prisma errors to user-friendly messages
   - Map Zod errors to validation error responses
   - Log errors (console for now, Sentry later)
   - Return consistent error shape: { error: string, code: string, details?: any }

2. Add request validation middleware using Zod schemas

Frontend (apps/web/):
1. Create src/components/ErrorBoundary.tsx
2. Add toast notifications for mutation errors
3. Handle network errors gracefully (show offline indicator)
```

### 6.2 Offline Support

**Prompt for Claude:**
```
Add offline support to the frontend.

Tasks:
1. Create apps/web/src/lib/offlineQueue.ts:
   - Queue failed mutations when offline
   - Persist queue to localStorage
   - Retry when back online
   - IMPORTANT: Only queue NON-MARKET actions (see below)

2. Update React Query config:
   - Enable persistence with @tanstack/query-sync-storage-persister
   - Cache portfolio data for offline viewing

3. Add online/offline indicator in UI

4. Actions while offline - CRITICAL DISTINCTION:

   ALLOWED offline (queue for later):
   - Profile updates
   - Settings changes
   - Target allocation changes

   BLOCKED offline (fail immediately with clear error):
   - Trade (BUY/SELL) - prices are stale, could cause massive loss
   - Borrow - collateral values are stale
   - Protect - premium calculations need live prices
   - Rebalance - requires live price calculations

   Error message for blocked actions:
   "This action requires live market prices. Please reconnect to the internet."

5. Portfolio viewing:
   - Allow viewing cached portfolio (read-only)
   - Show "Last updated: X minutes ago" indicator
   - Show stale data warning if cache > 5 minutes old
```

### 6.3 Security Hardening

**Prompt for Claude:**
```
Add security measures to the backend.

Tasks:
1. Add rate limiting:
   - 100 requests/minute per IP for general endpoints
   - 5 requests/minute for auth endpoints
   - Use hono-rate-limiter

2. Add CORS configuration:
   - Allow only specific origins (frontend URL)

3. Add request logging:
   - Log all requests with timestamp, method, path, userId, duration

4. Add input sanitization:
   - Zod handles most validation
   - Add explicit checks for SQL injection patterns in string fields

5. Secure headers:
   - Add helmet-like headers (HSTS, X-Frame-Options, etc.)
```

### 6.4 Shadow Mode Testing

Before enabling `USE_BACKEND_ACTIONS = true` in production, run both engines in parallel to catch calculation discrepancies.

**Prompt for Claude:**
```
Implement Shadow Mode for safe backend rollout.

Tasks:
1. Create apps/web/src/lib/shadowMode.ts:

   export async function executeShadowAction(
     actionType: string,
     payload: any,
     frontendResult: PortfolioSnapshot
   ) {
     if (!config.SHADOW_MODE_ENABLED) return;

     try {
       const backendResult = await api.post(`/actions/${actionType}`, payload);

       // Compare critical values
       const discrepancies = compareSnapshots(frontendResult, backendResult);

       if (discrepancies.length > 0) {
         // Log to monitoring service (Sentry, etc.)
         logDiscrepancy({
           actionType,
           payload,
           frontendResult,
           backendResult,
           discrepancies,
           timestamp: new Date().toISOString(),
         });
       }
     } catch (error) {
       // Shadow mode failures are silent - don't affect user
       console.error('[ShadowMode] Backend call failed:', error);
     }
   }

2. Add to config.ts:
   SHADOW_MODE_ENABLED: boolean  // Enable parallel execution
   SHADOW_MODE_LOG_ENDPOINT: string  // Where to send discrepancy logs

3. Integration in action handlers:
   - Frontend calculates and applies result (existing behavior)
   - Fire-and-forget call to backend with same payload
   - Compare results, log any differences

4. Key comparisons to make:
   - cashIRR difference > 1 IRR (rounding tolerance)
   - holding quantity difference > 0.00000001
   - loan/protection creation mismatch

5. Run shadow mode for at least 1 week before flipping USE_BACKEND_ACTIONS
```

---

## Phase 7: Deployment (Days 19-20)

### 7.1 Infrastructure Setup

```
Recommended Stack:
- Frontend: Vercel (or Cloudflare Pages)
- Backend: Railway (or Render, Fly.io)
- Database: Railway PostgreSQL (or Supabase)
- Monitoring: Sentry (free tier)
```

**Prompt for Claude:**
```
Prepare the apps for deployment.

Tasks:
1. Create apps/api/Dockerfile:
   - Multi-stage build
   - Include Prisma generate step
   - Health check endpoint

2. Create apps/web/.env.production:
   - VITE_API_URL=https://api.blumarkets.app
   - VITE_WS_URL=wss://api.blumarkets.app

3. Create apps/api/.env.example:
   - DATABASE_URL
   - JWT_SECRET
   - JWT_REFRESH_SECRET
   - CORS_ORIGIN

4. Add GitHub Actions workflow:
   - .github/workflows/deploy.yml
   - Run tests
   - Build both apps
   - Deploy on push to main
```

---

## Migration Checklist

### Feature Flags (in apps/web/src/config.ts)
```typescript
export const features = {
  USE_BACKEND_AUTH: false,      // Phase 1
  USE_BACKEND_PRICES: false,    // Phase 2
  USE_BACKEND_PORTFOLIO: false, // Phase 3
  USE_BACKEND_ACTIONS: false,   // Phase 4
};
```

Enable one at a time, test thoroughly, then move to the next.

### Testing Strategy

1. **Unit Tests**:
   - Backend services (validate, execute logic)
   - Shared schemas and utilities

2. **Integration Tests**:
   - API endpoints with test database
   - Auth flow end-to-end

3. **E2E Tests** (Playwright):
   - Full user journey: login → onboarding → trade → logout

### Rollback Plan

If issues arise after enabling a feature flag:
1. Disable the feature flag
2. Frontend reverts to local-only behavior
3. Fix the issue
4. Re-enable with fix

---

## Timeline Summary

| Phase | Days | Deliverable |
|-------|------|-------------|
| 0. Preparation | 1 | Monorepo structure, shared types |
| 1. Backend Foundation | 2-3 | Server, database, auth |
| 2. Price Service | 4-5 | Backend prices, WebSocket |
| 3. Portfolio | 6-8 | Portfolio CRUD, sync |
| 4. Actions | 9-12 | Trade, borrow, protect, rebalance |
| 5. Onboarding | 13-14 | Persist user profile |
| 6. Polish | 15-18 | Errors, offline, security |
| 7. Deployment | 19-20 | CI/CD, monitoring |

**Total: ~4 weeks** for a solo developer working full-time.

---

## Files to Keep Client-Side

### Browser-Specific Files (MUST stay in apps/web)

These files use `localStorage`, `window`, or other browser globals and **cannot** be moved to the shared package:

| File | Browser Dependency | Purpose |
|------|-------------------|---------|
| `services/priceCache.ts` | `localStorage` | Caches prices for offline/instant display |
| `services/priceCoordinator.ts` | `localStorage`, `window.addEventListener` | Cross-tab leader election for price fetching |
| `utils/tabCoordinator.js` | `localStorage`, `window.addEventListener` | Cross-tab communication fallback |
| `hooks/usePrices.ts` | `window.addEventListener` | Online/offline event handling |

### Shared Engine Files (Move to packages/shared)

These files are **pure** (no browser dependencies) and should be moved to shared so both frontend and backend can use them:

| File | Purpose | Notes |
|------|---------|-------|
| `engine/snapshot.ts` | Portfolio value calculation | Frontend: instant display. Backend: authoritative. |
| `engine/preview.ts` | Action preview | Frontend only (instant feedback) |
| `engine/validate.ts` | Validation rules | Both: same logic, single source of truth |
| `engine/pricing.ts` | Price calculations | Both use this |
| `engine/boundary.ts` | Layer boundary logic | Both use this |
| `engine/portfolioStatus.ts` | Status derivation | Both use this |
| `engine/intraLayerBalancer.ts` | Rebalancing logic | Both use this |
| `engine/fixedIncome.ts` | Fixed income calcs | Both use this |
| `engine/riskScoring.js` | Risk tier logic | Both use this |

### UI-Only Files (Stay in apps/web, not shared)

| File | Reason |
|------|--------|
| `selectors/*` | React-specific derived state |
| `reducers/` | Will be replaced with Zustand for UI state |
| `hooks/*` | React hooks are browser-only |
| `components/*` | React components |

---

## Questions to Decide Before Starting

1. **Auth method**: OTP only, or also add email/password?
2. **Hosting region**: Where are most users? (affects latency)
3. **Real-time necessity**: WebSocket for prices, or polling sufficient?
4. **Multi-device**: Should user see same portfolio on multiple devices?
5. **Admin panel**: Need a dashboard to manage users/view metrics?
