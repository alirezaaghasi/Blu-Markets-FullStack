

# Blu Markets — Acceptance Tests (Vision-Locked)

**Type:** Test Specification  
**Date:** January 2026  
**Status:** Binding

---

## Purpose

These tests enforce the User Agency Contract. Every scenario must pass before release.

If a test fails, the implementation violates core product principles.

---

## Global Invariants (Must Hold Everywhere)

### G-1: State Sovereignty

- [ ] UI never mutates portfolio state directly
- [ ] All state changes occur via the action pipeline:
  ```
  Intent → Preview → Boundary → Confirm → Commit → Ledger → UI
  ```
- [ ] Chat cannot bypass this pipeline

**Fail condition:** Any direct state mutation without preview + confirm.

---

### G-2: Agency Preservation

- [ ] No valid action is blocked due to "risk"
- [ ] Mechanical constraints only (cash, LTV, frozen assets)
- [ ] User can always proceed after explicit acknowledgment

**Fail condition:** "For your safety" blocks.

---

### G-3: Portfolio Gravity

- [ ] After every action, user returns to Portfolio Home
- [ ] Portfolio Home reflects the new reality, not intent
- [ ] Drift vs target allocation is always visible

**Fail condition:** Action leaves user in a transactional dead-end.

---

## Onboarding & Intent Lock

### O-1: Questionnaire Sets Intent, Not Behavior

**Given:**
- User completes questionnaire
- Target allocation is generated

**Expect:**
- [ ] Target allocation is stored as immutable intent
- [ ] Subsequent actions do not overwrite intent

**Fail if:**
- Manual buy/sell updates target allocation implicitly

---

## Buy / Sell Actions

### T-1: Buy Increases Drift, Not Judgment

**Given:**
- User buys BTC beyond target allocation

**Expect:**
- [ ] Preview shows updated allocation
- [ ] Boundary classified as DRIFT or STRUCTURAL
- [ ] Buy is allowed
- [ ] Ledger entry created

**Fail if:**
- Buy is blocked
- System auto-rebalances
- Target allocation changes

---

### T-2: Sell During Drawdown Is Allowed

**Given:**
- Market is down
- User sells asset

**Expect:**
- [ ] Preview shown
- [ ] Boundary classification shown
- [ ] Sell allowed
- [ ] No forced stress mode

**Fail if:**
- System halts sell
- Extra steps appear without consent

---

## Protect (Insurance)

### P-1: Protect Is Optional and Explicit

**Given:**
- User selects Protect on eligible asset

**Expect:**
- [ ] Preview shows:
  - premium
  - duration
  - cash deduction
- [ ] Protect activates only after confirm
- [ ] Cash deducted immediately
- [ ] Asset marked protected

**Fail if:**
- Protect auto-activates
- No cash impact shown
- Preview button does nothing

---

### P-2: Duplicate Protect Is Blocked Mechanically

**Given:**
- Asset already protected
- User attempts Protect again

**Expect:**
- [ ] Action rejected with mechanical explanation
- [ ] No boundary warning

**Fail if:**
- Second protect allowed
- System silently ignores action

---

## Borrow

### B-1: Borrow Is Bounded by Physics

**Given:**
- User borrows against asset

**Expect:**
- [ ] Preview shows:
  - LTV
  - liquidation threshold
  - frozen collateral
- [ ] Borrow limited by max LTV
- [ ] Borrow allowed until limit

**Fail if:**
- Borrow blocked due to "risk"
- Liquidation terms hidden

---

### B-2: Frozen Assets Are Enforced

**Given:**
- Asset used as collateral

**Expect:**
- [ ] Asset cannot be sold
- [ ] Attempt shows mechanical error

**Fail if:**
- User can sell frozen asset
- System allows partial sell silently

---

## Rebalance

### R-1: Rebalance Is Deterministic

**Given:**
- Portfolio drifted
- User taps Rebalance

**Expect:**
- [ ] Preview shows:
  - executed trades
  - residual drift (if any)
- [ ] Rebalance respects:
  - cash limits
  - frozen assets
- [ ] Ledger entry created

**Fail if:**
- UI says "complete" with no change
- Residual drift not shown

---

### R-2: Rebalance Never Changes Intent

**Given:**
- User rebalances after manual drift

**Expect:**
- [ ] Target allocation unchanged
- [ ] Current allocation moves toward target

**Fail if:**
- Target allocation is overwritten

---

## Stress Mode

### S-1: Stress Mode Is Explicit and Reversible

**Given:**
- Stress mode suggested

**Expect:**
- [ ] User can decline
- [ ] Decline respected permanently until changed
- [ ] No hidden escalation

**Fail if:**
- Stress mode reactivates silently
- Friction escalates invisibly

---

## Ledger

### L-1: Every Action Is Replayable

**Given:**
- Any irreversible action

**Expect:**
- [ ] Ledger entry includes:
  - action type
  - boundary classification
  - portfolio delta
- [ ] Entry is immutable
- [ ] Entry is user-visible

**Fail if:**
- Action leaves no trace
- User cannot audit decision

---

## Ultimate Pathological Test

### X-1: The Degenerate Survivor

**User does:**
1. 100% BTC
2. Borrows max
3. Refuses rebalance
4. Disables stress mode
5. Continues anyway

**System must:**
- [ ] Allow everything mechanically possible
- [ ] Show consequences clearly
- [ ] Never moralize
- [ ] Never block
- [ ] Never lie

**If the system survives this, it is correct.**

---

## Final Rule (Non-Negotiable)

If a developer asks:

> "Should we block this?"

The answer must be:

> "Is it mechanically impossible?"

If not — **show consequences and proceed**.

---

## Test Summary

| Category | Test ID | Description |
|----------|---------|-------------|
| Global | G-1 | State Sovereignty |
| Global | G-2 | Agency Preservation |
| Global | G-3 | Portfolio Gravity |
| Onboarding | O-1 | Questionnaire Sets Intent |
| Trade | T-1 | Buy Increases Drift |
| Trade | T-2 | Sell During Drawdown |
| Protect | P-1 | Protect Is Explicit |
| Protect | P-2 | Duplicate Protect Blocked |
| Borrow | B-1 | Borrow Bounded by Physics |
| Borrow | B-2 | Frozen Assets Enforced |
| Rebalance | R-1 | Rebalance Is Deterministic |
| Rebalance | R-2 | Rebalance Never Changes Intent |
| Stress | S-1 | Stress Mode Explicit |
| Ledger | L-1 | Every Action Replayable |
| Pathological | X-1 | Degenerate Survivor |

**Total: 15 tests**

All must pass.

---

## Document Hierarchy

```
Blu Markets Product Documents
├── User_Agency_Contract.md      ← Product doctrine (WHY)
├── Acceptance_Tests.md          ← This document (PASS/FAIL)
├── Architecture_Refactor_v3.1.md ← Technical spec (HOW)
└── README.md                    ← Current version (v9.9)
```

The Acceptance Tests validate that implementation honors the Contract.
