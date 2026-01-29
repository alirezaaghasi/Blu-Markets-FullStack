# Audit Fixes Implementation Plan

## Date: 2026-01-29
## Auditor: External Code Review

---

## Overview

This document outlines the implementation plan for fixing the 9 issues identified in the comprehensive code review.

## Issue Summary

| # | Issue | Severity | Category | File |
|---|-------|----------|----------|------|
| 1 | Non-transactional add-funds flow | HIGH | Logic/Concurrency | portfolio.service.ts |
| 2 | Ledger snapshots from stale preview data | MEDIUM | Data Integrity | trade.service.ts |
| 3 | Floating-point math in metrics worker | MEDIUM | Financial | portfolio-metrics.service.ts |
| 4 | WebSocket auth tokens in query string (backend) | MEDIUM | Security | prices.websocket.ts |
| 5 | WebSocket auth tokens in query string (mobile) | MEDIUM | Security | priceWebSocket.ts |
| 6 | Rebalance debug logging at info level | MEDIUM | Security | rebalance.service.ts |
| 7 | Portfolio snapshot duplicate fetches | LOW | Performance | portfolio.service.ts |
| 8 | Activity feed uses `any` without validation | LOW | Type Safety | useActivityFeed.ts |
| 9 | Activity feed stale closure | LOW | React Hooks | useActivityFeed.ts |

---

## Implementation Plan

### Issue 1: Non-transactional add-funds flow (HIGH)

**File:** `backend/src/modules/portfolio/portfolio.service.ts:250-304`

**Problem:** Read-then-write pattern without transaction causes lost updates under concurrency.

**Fix:**
- Wrap all operations in `prisma.$transaction()`
- Use atomic `{ increment: amountIrr }` for cashIrr
- Create ledger and action log within same transaction

---

### Issue 2: Ledger snapshots from stale preview data (MEDIUM)

**File:** `backend/src/modules/trade/trade.service.ts:404-420`

**Problem:** Ledger beforeSnapshot/afterSnapshot use stale preview data.

**Fix:**
- Compute beforeSnapshot from portfolio state at transaction start
- Compute afterSnapshot from actual updated state after all operations

---

### Issue 3: Floating-point math in metrics worker (MEDIUM)

**File:** `backend/src/services/portfolio-metrics.service.ts:113-136`

**Problem:** JS Number arithmetic causes rounding drift.

**Fix:**
- Use Decimal utilities (toDecimal, add, multiply) for all calculations
- Convert to Number only at final storage

---

### Issue 4: WebSocket auth tokens in query string - Backend (MEDIUM)

**File:** `backend/src/modules/prices/prices.websocket.ts:104-118`

**Problem:** Query string tokens can leak via logs/proxies.

**Fix:**
- Accept tokens via `Sec-WebSocket-Protocol` header (for React Native)
- Keep Authorization header support
- Remove query string fallback

---

### Issue 5: WebSocket auth tokens in query string - Mobile (MEDIUM)

**File:** `blu-markets-mobile/src/services/priceWebSocket.ts:153-162`

**Problem:** Token in URL can leak in network logs.

**Fix:**
- Send token via WebSocket protocol header: `Bearer-${token}`
- Remove URL query parameter

---

### Issue 6: Rebalance debug logging at info level (MEDIUM)

**File:** `backend/src/modules/rebalance/rebalance.service.ts:109-145`

**Problem:** Sensitive financial data logged at info level.

**Fix:**
- Change `logger.info` to `logger.debug`
- Wrap in development/debug flag check

---

### Issue 7: Portfolio snapshot duplicate fetches (LOW)

**File:** `backend/src/modules/portfolio/portfolio.service.ts:225-247`

**Problem:** Separate calls to getPortfolioSummary and getPortfolioHoldings double DB fetches.

**Fix:**
- Consolidate into single query loading portfolio with holdings
- Build snapshot from single result

---

### Issue 8: Activity feed uses `any` without validation (LOW)

**File:** `blu-markets-mobile/src/hooks/useActivityFeed.ts:59-69`

**Problem:** Unvalidated any payloads may cause runtime crashes.

**Fix:**
- Add type guard function for activity validation
- Handle malformed data gracefully

---

### Issue 9: Activity feed stale closure (LOW)

**File:** `blu-markets-mobile/src/hooks/useActivityFeed.ts:41-79`

**Problem:** `activities.length` read in callback without proper dependency.

**Fix:**
- Use functional state update or separate state flag for initial load

---

## Testing Plan

After each fix:
1. TypeScript compilation check
2. Run existing unit tests
3. Manual testing via Expo Go for mobile changes
4. Verify no regressions

## Rollback Plan

Each fix committed separately for targeted rollback if needed.
