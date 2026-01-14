# Blu Markets — User Agency Contract

**Type:** Product Doctrine (Internal)  
**Date:** January 2026  
**Status:** Binding

---

## Purpose

This is **not marketing copy**.

This is an internal, binding product doctrine. Use it to answer *every* "should we block this?" question.

Hand this to:
- Designers
- Engineers
- Compliance
- Future you (6 months from now)

---

## 1. Core Principle

Blu Markets exists to **make consequences legible**, not to decide outcomes.

The system **never replaces user judgment**.

It clarifies, classifies, and records decisions — and then gets out of the way.

---

## 2. What Blu Markets WILL ALWAYS DO

### 2.1 Show Consequences Before Commitment

Every irreversible action produces a preview.

Previews include:
- Portfolio allocation impact
- Cash impact
- Locked / frozen state changes
- Residual drift vs target allocation

### 2.2 Classify Actions, Not Users

Boundaries apply to *actions*, not people.

Classifications are descriptive:
- SAFE
- DRIFT
- STRUCTURAL
- STRESS

No action is labeled "good" or "bad".

### 2.3 Preserve the Original Intent

The user's chosen target allocation remains stable unless explicitly changed.

Deviations are measured relative to that intent, not overwritten.

### 2.4 Record Decisions Immutably

Every committed action is logged.

The log reflects:
- What the user chose
- Under what boundary condition
- With what portfolio impact

### 2.5 Return the User to Portfolio Home

After every action, the system snaps back to portfolio context.

There is no "transaction tunnel" that detaches users from consequences.

---

## 3. What Blu Markets WILL NEVER DO

### 3.1 Block a Valid User Action Due to "Risk"

If an action is mechanically possible, it is allowed.

Risk classification may increase friction, not prohibition.

### 3.2 Auto-Correct User Decisions

The system never silently rebalances.

The system never "fixes" a portfolio without explicit user instruction.

### 3.3 Predict Outcomes or Promise Protection

- No forecasts
- No implied intelligence
- No "this will likely happen" language

### 3.4 Change Behavior Without Consent

- Stress mode does not activate silently
- Friction levels never escalate invisibly

### 3.5 Confuse Guidance With Authority

The system explains portfolio geometry.

It does not tell users what they *should* want.

---

## 4. Mechanical vs Behavioral Constraints

Blu Markets enforces **physics**, not morality.

### Hard Mechanical Constraints (Blocking)

- Insufficient cash
- Selling frozen collateral
- Borrowing beyond max LTV
- Protecting ineligible assets
- Repaying more than outstanding loan

### Everything Else

User choice.

---

## 5. Responsibility Boundary

### Blu Markets is Responsible For:

- Correctness of calculations
- Clarity of consequences
- Consistency of state

### The User is Responsible For:

- Decisions
- Risk acceptance
- Deviation from plan

This boundary is explicit and intentional.

---

## 6. Stress Test Scenarios (Must-Pass)

These scenarios validate the contract. If the system survives these, it's fundamentally sound.

### Scenario 1 — "All-In Degenerate"

**User behavior:**
1. Completes questionnaire → Balanced allocation
2. Buys BTC repeatedly until portfolio is ~95% BTC
3. Ignores all DRIFT / STRUCTURAL warnings
4. Refuses to rebalance

**System must:**
- Allow every buy
- Show increasing drift numerically
- Classify actions as STRUCTURAL, then STRESS
- Never auto-correct
- Portfolio Home reflects extreme concentration clearly

**Failure if:**
- System blocks buys
- System silently caps BTC
- Language becomes judgmental

---

### Scenario 2 — "Borrow Spiral"

**User behavior:**
1. Holds Gold + BTC
2. Borrows IRR against BTC
3. Uses borrowed IRR to buy more BTC
4. Borrows again (until LTV max)
5. Continues drifting further

**System must:**
- Allow borrow until mechanical LTV limit
- Freeze collateral visibly
- Show liquidation thresholds explicitly
- Classify later actions as STRESS
- Never prevent re-entry into borrow flow

**Failure if:**
- Borrow is blocked due to "risk"
- Liquidation mechanics are hidden
- User doesn't understand frozen state

---

### Scenario 3 — "Stress-Mode Rejection"

**User behavior:**
1. Market drawdown simulated
2. System recommends enabling stress mode
3. User explicitly turns stress mode OFF
4. User sells assets anyway

**System must:**
- Respect the toggle
- Proceed with normal confirmation flow
- Log that action occurred outside stress mode
- Avoid escalating friction further

**Failure if:**
- Stress mode silently reactivates
- Extra steps appear "for their own good"

---

### Scenario 4 — "Rebalance Illusion"

**User behavior:**
1. Portfolio heavily drifted
2. Large portion locked as collateral
3. User taps "Rebalance"
4. Rebalance cannot fully reach target

**System must:**
- Execute partial rebalance
- Explicitly show residual drift
- Say: "Target not fully reachable with current constraints"
- Return to Portfolio Home

**Failure if:**
- UI says "Rebalance complete" without qualification
- User thinks portfolio is back on target

---

### Scenario 5 — "I Know Better Than You"

**User behavior:**
1. User repeatedly ignores guidance
2. User disables all optional explanations
3. User uses only quick confirm paths

**System must:**
- Still function
- Still log decisions
- Still show outcomes
- Never punish behavior

**Failure if:**
- UX degrades intentionally
- System becomes obstructive

---

### Scenario 6 — "Blame the System"

**User behavior:**
1. User makes extreme choices
2. Later claims: "I didn't understand what happened"

**System must:**
- Have ledger entries
- Have previews shown
- Have boundary classifications recorded
- Be auditable

This is not for legal defense — it's for *trust*.

---

## 7. Final Verdict

If Blu Markets:
- Passes these scenarios
- Adheres to the User Agency Contract
- And resists the urge to "help"

Then you will have built something **rare**:

> A financial system that respects human agency under constraint.

---

## Document Hierarchy

1. **Blu_Markets_User_Agency_Contract.md** — This document (product doctrine)
2. **Blu_Markets_Refactor_Spec_v3.1_Final.md** — Technical specification
3. **Blu_Markets_v9.7_Changelog.md** — UI implementation changes

The User Agency Contract governs product decisions. The spec implements the contract technically. The changelog implements the spec in UI.
