
# Audit Fixes Implementation Plan

## Date: 2026-01-29
## Auditor: External Code Review

---

# PART A: UI Enhancement Implementation (15 Approved Changes)

## Overview
Systematic implementation plan for 15 UI enhancements focused on plain-language terminology, simplified displays, and improved user experience.

---

## Task 1: Create Global Formatting Utility
**File**: `blu-markets-mobile/src/utils/formatNumber.ts`

**Functions**:
- `formatIRR(value: number)` - Iranian Rial with commas, no decimals
- `formatUSD(value: number)` - USD with $ prefix, 2 decimals
- `formatCrypto(value: number, symbol: string)` - Crypto with appropriate decimals
- `formatPercent(value: number, decimals?: number)` - Percentage with % suffix

---

## Task 2: Remove Option Metrics Section
**Files**: Protection screens
**Change**: Remove "Option Metrics" (Delta, Gamma, Theta, Vega)

---

## Task 3: Remove Breakeven Analysis Section
**Files**: Protection screens
**Change**: Remove "Breakeven Analysis" section

---

## Task 4: Update "How Protection Works" Text
**Files**: `BuyProtectionScreen.tsx`
**Changes**: "option" → "protection", "strike price" → "protected value", "premium" → "protection cost"

---

## Task 5: Replace "Premium" with "Protection Cost"
**Files**: All protection screens
**Change**: Global rename

---

## Task 6: Replace "LTV" with "% of value"
**Files**: Loan screens and components
**Change**: "LTV" → "% of value"

---

## Task 7: Replace "APR" with "yearly"
**Files**: Loan screens
**Change**: "APR" → "yearly"

---

## Task 8: Replace "Collateral" with "Locked for this loan"
**Files**: Loan screens
**Change**: Terminology update

---

## Task 9: Use Concrete Dates for Next Payment
**Files**: Loan screens
**Change**: "in X days" → "Feb 15, 2026"

---

## Task 10: Simplify Home Screen Action Buttons
**File**: `HomeScreen.tsx`
**Changes**: "Buy/Sell" → "Trade", "Borrow IRR" → "Borrow", "Insure Assets" → "Protect"

---

## Task 11: Add Percentage to Portfolio Layer Values
**File**: `PortfolioScreen.tsx`
**Change**: Show "Foundation: ۱۲۵M IRR (50%)"

---

## Task 12: Remove Redundant "| SYMBOL" from Asset Names
**Files**: Portfolio and asset components
**Change**: "Bitcoin | BTC" → "Bitcoin"

---

## Task 13: Rename "Market" Tab to "Services"
**File**: `MainTabNavigator.tsx`
**Change**: Tab label update

---

## Task 14: Update Active Protections Display
**Files**: Protection list components
**Changes**: Remove "Premium Paid", show "Expires: Mar 15, 2026"

---

## Task 15: Simplify Activity Log Messages
**Files**: Activity components
**Changes**: "Purchased BTC" → "Bought Bitcoin"

---

## Implementation Order
1. Task 1 (formatNumber.ts) - Foundation
2. Task 13 (Market → Services) - Quick win
3. Task 10 (Home buttons) - Quick win
4. Tasks 11-12 (Portfolio) - Related changes
5. Tasks 6-9 (Loans) - Related changes
6. Tasks 2-5, 14 (Protection) - Related changes
7. Task 15 (Activity log) - Final polish

---

# PART B: External Code Review Fixes (9 Issues)

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
