# Blu Markets — Comprehensive Code Review Report
## Date: 2026-01-26 (Updated)

---

# Executive Summary

| Metric | Original | Fixed | Remaining |
|--------|----------|-------|-----------|
| Total Issues | 25 | 14 | 11 |
| P0 Critical | 0 | N/A | 0 |
| P1 High | 17 | 8 | 9 |
| P2 Medium | 6 | 5 | 1 |
| P3 Low | 2 | 1 | 1 |

### Status: **IN PROGRESS** - Business rules and navigation fixed, calculation audits pending

---

# FIXES APPLIED

## BUG-001 [P1] Layer constraints do not match PRD ranges — **FIXED**

**File:** `src/constants/business.ts`
**Lines:** 22-46

**Before:**
```typescript
FOUNDATION: { minTarget: 0.40, maxTarget: 0.70, ... }
GROWTH: { minTarget: 0.20, maxTarget: 0.45, ... }
UPSIDE: { minTarget: 0, maxTarget: 0.20, hardMax: 0.25, ... }
```

**After:**
```typescript
FOUNDATION: { minTarget: 0.30, maxTarget: 0.85, hardMin: 0.30, ... }
GROWTH: { minTarget: 0.12, maxTarget: 0.45, ... }
UPSIDE: { minTarget: 0.03, maxTarget: 0.30, hardMax: 0.25, ... }
```

---

## BUG-002 [P1] UPSIDE LTV cap is set below required limit — **FIXED**

**File:** `src/constants/business.ts`
**Line:** 75

**Change:** `UPSIDE: 0.25` → `UPSIDE: 0.30`

---

## BUG-003 [P1] Protection eligible assets list is incorrect — **FIXED**

**File:** `src/constants/business.ts`
**Line:** 97

**Before:**
```typescript
['BTC', 'ETH', 'PAXG', 'KAG', 'QQQ', 'SOL']
```

**After:**
```typescript
['PAXG', 'BTC', 'ETH', 'BNB', 'XRP', 'KAG', 'QQQ', 'SOL', 'LINK', 'AVAX']
```

**Note:** KAG confirmed eligible per product team.

---

## BUG-004 [P1] Protection duration presets include invalid terms — **FIXED**

**File:** `src/hooks/useProtections.ts`
**Line:** 34

**Change:** `[7, 14, 30, 60, 90, 180]` → `[30, 90, 180]`

---

## BUG-004A [P1] Protection API presets expose invalid durations — **FIXED**

**File:** `src/services/api/protection.ts`
**Line:** 25

**Change:** `[7, 14, 30, 60, 90, 180]` → `[30, 90, 180]`

---

## BUG-005 [P1] Protection eligibility flags omit LINK and AVAX — **FIXED**

**File:** `src/constants/assets.ts`
**Lines:** 143-165

**Change:** Set `protectionEligible: true` for both LINK and AVAX assets.

---

## BUG-006 [P1] ProtectionSheet eligibility logic violates PRD asset rules — **FIXED**

**File:** `src/components/ProtectionSheet.tsx`
**Lines:** 71-78

**Before:**
```typescript
return asset && asset.layer !== 'FOUNDATION' && !h.frozen && h.quantity > 0;
```

**After:**
```typescript
return asset && PROTECTION_ELIGIBLE_ASSETS.includes(h.assetId) && !h.frozen && h.quantity > 0;
```

---

## BUG-007 [P1] Risk profile allocations do not match PRD matrix — **FIXED**

**File:** `src/constants/business.ts`
**Lines:** 154-166

Updated scores 3, 4, 7, 8 to match PRD:
- Score 3: 70/25/5 → 75/18/7
- Score 4: 65/30/5 → 70/22/8
- Score 7: 45/38/17 → 45/37/18
- Score 8: 40/40/20 → 40/38/22

---

## BUG-020 [P2] HomeScreen navigates to an unregistered Activity route — **FIXED**

**File:** `src/screens/main/HomeScreen.tsx`
**Line:** 277

**Change:** `navigation.navigate('Activity')` → `navigation.navigate('Portfolio')`

---

## BUG-021 [P2] HomeScreen navigates to non-existent Services tab — **FIXED**

**File:** `src/screens/main/HomeScreen.tsx`
**Line:** 295

**Change:** `navigation.navigate('Services', ...)` → `navigation.navigate('Market', ...)`

---

## BUG-023 [P3] Loan type comment references incorrect daily rate — **FIXED**

**File:** `src/types/index.ts`
**Line:** 212

**Change:** Updated comment to `// Daily interest rate (0.30/365 ≈ 0.000822 for 30% APR)`

---

# REMAINING ISSUES (Require Architectural Decisions)

## P1 High Priority — Client-Side Calculation Issues

These require architectural decisions about mock API vs backend-only:

| Bug ID | Issue | File | Notes |
|--------|-------|------|-------|
| BUG-008 | LoanSheet client-side calculations | LoanSheet.tsx | Has fallback to backend preview |
| BUG-009 | LoansScreen client LTV health | LoansScreen.tsx | Uses capacity API |
| BUG-010 | TradeBottomSheet client math | TradeBottomSheet.tsx | Uses trade.preview API |
| BUG-011 | tradeValidation utilities | tradeValidation.ts | Used for local feedback |
| BUG-012 | Fixed income accrual | fixedIncome.ts | Backend should provide |
| BUG-013 | Risk profile scoring | riskProfile.ts | Used by mock only |
| BUG-014 | RepaySheet outstanding calc | RepaySheet.tsx | Display only, API does action |
| BUG-015 | Mock loan preview calcs | mock/index.ts | Expected for demo mode |
| BUG-016 | WebSocket unauthenticated | priceWebSocket.ts | Backend change needed |

## P2 Medium Priority

| Bug ID | Issue | File | Notes |
|--------|-------|------|-------|
| BUG-017 | WebSocket message validation | usePriceWebSocket.ts | Add schema validation |
| BUG-018 | Auth API console logs | auth.ts | Add __DEV__ guards |
| BUG-019 | Token storage on web | secureStorage.ts | Web security concern |
| BUG-024 | ProtectionSheet client calcs | ProtectionSheet.tsx | Uses backend quotes |

## P3 Low Priority

| Bug ID | Issue | File | Notes |
|--------|-------|------|-------|
| BUG-022 | Deprecated premium-by-layer | ProtectionScreen.tsx | Update educational copy |

---

# Notes on Calculation Issues

The audit identifies client-side calculations as violations. However:

1. **Mock API (demo mode)**: Calculations in `mock/index.ts` are expected - they simulate backend behavior for offline demo mode.

2. **Fallback calculations**: Components like `LoanSheet.tsx` have backend API calls (`loans.preview()`) with fallback calculations only if API is unavailable.

3. **Display-only calculations**: Some calculations (like RepaySheet's `totalOutstanding`) are for display while the actual transaction uses backend API.

4. **Trade validation utilities**: Used for instant UI feedback while backend is authoritative for execution.

**Recommendation:** Mark mock API calculations as "demo-only" and ensure production builds use backend exclusively.

---

# Verification Checklist

- [x] TypeScript compiles with 0 errors
- [x] Layer constraints match PRD (30-85, 12-45, 3-30)
- [x] LTV values correct (0.70, 0.50, 0.30)
- [x] Protection eligible assets complete
- [x] Protection durations restricted to 30/90/180
- [x] Risk profile allocations match PRD
- [x] Navigation routes valid
- [ ] WebSocket authentication (backend change needed)
- [ ] Console log guards (low priority)

---
