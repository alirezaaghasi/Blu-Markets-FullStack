# Blu Markets React Web App - User Flows Documentation

## Application Structure

The app follows a **linear lifecycle** with 7 stages:

```
WELCOME → PHONE → QUESTIONNAIRE → PROFILE RESULT → FUNDING → PORTFOLIO CREATED → ACTIVE
```

Once active, users navigate between **4 main tabs**: Portfolio, Protection, Loans, History

---

## 1. Onboarding Flow

| Step | Screen | User Actions |
|------|--------|--------------|
| Welcome | Splash screen | Tap "Continue" |
| Phone | Phone input | Enter Iranian mobile (+989XXXXXXXXX) |
| Questionnaire | 9 risk questions | Answer questions about income, risk tolerance, goals |
| Profile Result | Risk profile display | View recommended allocation (donut chart) |
| Consent | 3 checkboxes | Acknowledge risk, loss potential, no guarantees |
| Funding | Amount input | Enter initial investment (min 1M IRR) |
| Summary | Portfolio created | Review initial holdings allocation |

### Risk Profiles (determined by questionnaire)

| Profile | Foundation | Growth | Upside |
|---------|------------|--------|--------|
| Anxious Novice | 80% | 18% | 2% |
| Steady Builder | 50% | 35% | 15% |
| Aggressive Accumulator | 20% | 30% | 50% |
| Wealth Preserver | 60% | 35% | 5% |
| Speculator | 10% | 20% | 70% |

---

## 2. Portfolio Management Flows

### View Portfolio
- Total value display (Holdings + Cash in IRR)
- Holdings grouped by layer (Foundation/Growth/Upside)
- Each holding shows: asset name, quantity, value, protection/loan status
- Portfolio health badge (Balanced, Rebalance needed, Attention required)

### Trade Flow (Buy/Sell)

```
Select Asset → Enter Amount → Preview (allocation impact + spread) → Confirm
```

- Shows before/after allocation visualization
- Spread disclosure (0.15%-0.60% by layer)
- Boundary warnings if moving away from target

### Add Funds Flow

```
Tap "Add Funds" → Enter Amount → Preview → Confirm
```

### Rebalance Flow

```
Tap "Rebalance" → Select Mode → Preview Trades → Expand to see details → Confirm
```

- **Modes**: Holdings Only, Holdings + Cash, Smart
- Shows constraint messages (frozen collateral, insufficient cash)
- Uses HRAM algorithm (volatility, momentum, correlation, liquidity)

---

## 3. Protection (Insurance) Flow

### Buy Protection

```
Select Asset → Choose Duration (1-6 months) → Review Premium → Confirm
```

- Premium rates by layer:
  - Foundation: 0.4%/month
  - Growth: 0.8%/month
  - Upside: 1.2%/month
- Shows notional value, premium cost, coverage period

### Protection Dashboard
- Active protections with days remaining countdown
- Progress bar showing coverage period
- Cancel button (no refund)
- Expired protections archive

---

## 4. Lending (Borrow) Flow

### Borrow Funds

```
Select Collateral Asset → Enter Amount → Choose Duration (3 or 6 mo) → Preview → Confirm
```

- **LTV limits by layer**:
  - Foundation: 70%
  - Growth: 50%
  - Upside: 30%
- Global loan cap: 25% of portfolio
- Shows: interest rate (30% annual), liquidation price, buffer percentage
- Collateral becomes FROZEN (can't trade/rebalance)

### Repay Loan

```
Select Loan → View Installment Status → Enter Amount → Preview → Confirm
```

- Installment tracking (3 or 6 installments)
- Partial payments allowed
- Early repayment shows interest savings
- Full settlement unfreezes collateral

### Loans Dashboard
- Active loans cards with collateral, principal, interest, days remaining
- Loan capacity bar (used/max/remaining)
- Repay button per loan

---

## 5. History/Audit Trail

- All actions logged to ledger with timestamps
- Grouped by date (Today, Yesterday, specific dates)
- Shows action type, amount, boundary indicator
- Paginated (20 per page)

---

## 6. Data Model Summary

| Entity | Key Fields |
|--------|------------|
| **Holding** | assetId, quantity, frozen status, layer |
| **Protection** | assetId, notional value, premium, start/end dates |
| **Loan** | collateral asset, amount, LTV, interest rate, duration, installments[], status |
| **Ledger Entry** | action type, timestamp, amounts, before/after snapshots |

### Asset Universe (15 Assets across 3 Layers)

| Layer | Assets |
|-------|--------|
| **Foundation** (3) | USDT, PAXG, IRR Fixed Income |
| **Growth** (6) | BTC, ETH, BNB, XRP, KAG, QQQ |
| **Upside** (6) | SOL, TON, LINK, AVAX, MATIC, ARB |

---

## 7. UI Patterns

### Layout
- **Two-panel layout**: Left (action log + controls), Right (main content)

### Action Confirmation
- **Modal pattern**: Always shows preview with before/after impact
- **Friction copy**: Plain language warnings for risky actions

### Boundary Indicators

| Boundary | Color | Meaning |
|----------|-------|---------|
| SAFE | Green | Safe action |
| DRIFT | Yellow | Minor move away from target |
| STRUCTURAL | Orange | Major move away from target |
| STRESS | Red | High risk action |

### Navigation Principle
- **Portfolio Gravity**: Returns to Portfolio tab after any action

---

## 8. Key Calculations

### Portfolio Valuation
```
Total Portfolio Value = Cash IRR + Sum of Holdings Value
Holdings Value = quantity × priceUSD × fxRate (1 USD = 1,456,000 IRR)
```

### Layer Percentage
```
Layer % = (Sum of Holdings Value in layer) / Total Portfolio Value × 100
```

### Loan Interest
```
Monthly rate = 30% annual / 12 = 2.5%
Interest = principal × monthly_rate × months

Example: 30M IRR for 6 months
Interest = 30M × 0.025 × 6 = 4.5M IRR
Total due = 34.5M IRR
```

### Protection Premium
```
Premium = notional_value × rate_per_month × months

Example: BTC (GROWTH) 50M, 3 months
Premium = 50M × 0.008 × 3 = 1.2M IRR
```

### Trade Spread

| Layer | Spread |
|-------|--------|
| Foundation | 0.15% |
| Growth | 0.30% |
| Upside | 0.60% |

---

## 9. Validation Rules

| Validation | Rule |
|------------|------|
| Phone | Iranian format (+989XXXXXXXXX) |
| Initial Investment | Minimum 1,000,000 IRR |
| Trade (Buy) | Sufficient cash available |
| Trade (Sell) | Sufficient asset balance, asset not frozen |
| Protection | Asset eligible, no existing protection, cash for premium |
| Borrow | Within LTV limit, within 25% portfolio cap, asset not frozen |
| Repay | Loan exists, cash available |

---

## 10. Complete User Journey Examples

### Journey A: New User Signup & Portfolio Creation

1. **Welcome** → Tap "Continue"
2. **Phone** → Enter +989XXXXXXXXX → Tap "Continue"
3. **Questionnaire** → Answer 9 risk questions
4. **Profile Result** → View recommended allocation (e.g., Steady Builder: 50/35/15)
5. **Consent** → Check 3 acknowledgment boxes
6. **Funding** → Enter 10,000,000 IRR → Tap "Create Portfolio"
7. **Summary** → Review initial holdings
8. **Active Dashboard** → Start managing portfolio

### Journey B: Trade & Rebalance

1. **Portfolio Tab** → Review current allocation
2. **Add Funds** → Add 5,000,000 IRR cash
3. **Buy BTC** → Enter amount → Preview impact → Confirm
4. **Notice drift** → Badge shows "Rebalance needed"
5. **Rebalance** → Select "Holdings + Cash" mode → Review trades → Confirm
6. **Portfolio Tab** → Allocation back to target

### Journey C: Protect & Borrow

1. **Portfolio Tab** → Select BTC holding
2. **Protect** → Choose 3 months → Pay 1.2M premium → Confirm
3. **Protection Tab** → View active protection with countdown
4. **Borrow** → Select ETH as collateral → Borrow 20M → 6 month term → Confirm
5. **Loans Tab** → View loan with installment schedule
6. **Monthly** → Repay installments as they come due
7. **Final Payment** → Settle loan → ETH unfrozen
