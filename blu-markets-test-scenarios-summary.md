# Blu Markets v10 — Test Scenarios Summary

## Document Overview

This document summarizes comprehensive test scenarios for Claude Code implementation, covering three dimensions:

1. **Market Volatility** — 8 distinct scenarios from normal to extreme
2. **User Profiles** — 5 behavioral archetypes from conservative to speculative
3. **Cash-In Patterns** — 6 funding strategies from micro-DCA to whale lump sums

---

## Part 1: Market Volatility Scenarios

### Quick Reference Table

| ID | Scenario | Duration | BTC Change | Risk Level |
|----|----------|----------|------------|------------|
| V1 | Normal Market | 30 days | ±2% | Low |
| V2 | Bull Run | 14 days | +28% | Medium |
| V3 | Market Correction | 21 days | -26% | High |
| V4 | Flash Crash | 1 day | -20% → recovery | Extreme |
| V5 | Crypto Winter | 180 days | -59% | Extreme |
| V6 | Gold Surge | 60 days | -10% BTC, +21% Gold | Medium |
| V7 | IRR Devaluation | 30 days | Stable USD, +25% IRR | Medium |
| V8 | USDT Depeg | 7 days | USDT drops to $0.85 | Critical |

### Detailed Scenarios

#### V1: Normal Market (Baseline)
- **Duration:** 30 days
- **Behavior:** Sideways movement, ±2-4% fluctuations
- **Portfolio Impact:** Conservative: +1-2%, Aggressive: ±4-6%
- **Use Case:** Baseline testing, system verification

#### V2: Bull Run Rally
- **Duration:** 14 days
- **Behavior:** Strong upward momentum, 7-10% weekly gains
- **Portfolio Impact:** Conservative: +8-15%, Aggressive: +35-55%
- **Key Test:** Rebalancing triggers, Upside layer overweight

#### V3: Market Correction
- **Duration:** 21 days
- **Behavior:** 25-35% pullback across crypto
- **Portfolio Impact:** Conservative: -5-8%, Aggressive: -25-32%
- **Key Test:** Loan stress, DCA behavior, panic thresholds

#### V4: Flash Crash
- **Duration:** 1 day (hourly simulation)
- **Behavior:** -20% intraday, recovery within hours
- **Portfolio Impact:** Conservative: -1-3%, Aggressive: -8-15%
- **Key Test:** Loan liquidation thresholds, rapid LTV changes

#### V5: Crypto Winter
- **Duration:** 180 days
- **Behavior:** Extended bear market, -60% cumulative
- **Portfolio Impact:** Conservative: -10-15%, Aggressive: -55-65%
- **Key Test:** DCA benefit, loan liquidation cascade, protection value

#### V6: Gold Surge
- **Duration:** 60 days
- **Behavior:** Safe-haven rally, gold +21%, crypto -10%
- **Portfolio Impact:** Conservative: +3-8%, Aggressive: -8-12%
- **Key Test:** Foundation layer benefit, diversification value

#### V7: IRR Devaluation
- **Duration:** 30 days
- **Behavior:** Rial loses 25% vs USD
- **Portfolio Impact:** All portfolios +22-26% in IRR terms
- **Key Test:** USD hedge benefit, fixed income real value loss

#### V8: USDT Depeg Crisis
- **Duration:** 7 days
- **Behavior:** USDT drops to $0.85, panic selling
- **Portfolio Impact:** Conservative: -12-18%, Aggressive: -8-12%
- **Key Test:** Foundation layer risk, USDT concentration

---

## Part 2: User Profiles

### Profile Matrix

| Profile | Risk Score | Foundation | Growth | Upside | Loan Aversion |
|---------|------------|------------|--------|--------|---------------|
| Anxious Novice | 2/15 | 80% | 18% | 2% | Extreme |
| Steady Builder | 6/15 | 50% | 35% | 15% | Moderate |
| Aggressive Accumulator | 11/15 | 20% | 30% | 50% | Low |
| Wealth Preserver | 5/15 | 60% | 35% | 5% | High |
| Speculator | 15/15 | 10% | 20% | 70% | None |

### Profile 1: Anxious Novice (فرزانه - Farzaneh)

**Demographics:**
- Age: 28, School Teacher
- Monthly Income: 35M IRR
- Experience: None
- Initial Investment: 50M IRR
- Monthly DCA: 5M IRR

**Behavioral Patterns:**
- Checks app daily
- Panics at -10% loss
- FOMO buys after +20% gain
- Will never take loans
- High interest in protection

**Key Test Scenarios:**
- AN-V1-D1: Normal market + Fixed DCA → Steady 10-18% growth
- AN-V3-D1: Correction + Fixed DCA → Small loss, potential panic
- AN-V4-D1: Flash crash → Minimal impact due to conservative allocation
- AN-V8-D1: USDT depeg → Significant loss due to USDT concentration

### Profile 2: Steady Builder (علی - Ali)

**Demographics:**
- Age: 35, Software Engineer
- Monthly Income: 120M IRR
- Experience: 3 years stocks
- Initial Investment: 200M IRR
- Monthly DCA: 30M IRR

**Behavioral Patterns:**
- Checks app weekly
- Tolerates -25% drawdown
- Moderate rebalance willingness
- May consider small loans

**Key Test Scenarios:**
- SB-V1-D1: Normal + Fixed DCA → 15-25% growth
- SB-V2-D1: Bull run → Needs rebalancing (Upside overweight)
- SB-V3-D2: Correction + Variable DCA → DCA benefit, bonus deployment
- SB-V5-D1: Crypto winter → -25-35% loss, strong DCA accumulation

### Profile 3: Aggressive Accumulator (سارا - Sara)

**Demographics:**
- Age: 30, Tech Startup Founder
- Monthly Income: 250M IRR (variable)
- Experience: 5 years crypto
- Initial Investment: 1B IRR
- Monthly DCA: 100M IRR + 500M dip reserve

**Behavioral Patterns:**
- Checks app multiple times daily
- Tolerates -50% drawdown
- High rebalance willingness
- Uses leverage strategically

**Key Test Scenarios:**
- AA-V2-D3: Bull run + Opportunistic → 35-55% gains
- AA-V3-D3: Correction + Dip buying → Deploy reserve at lows
- AA-V4-D3-LEVERAGED: Flash crash + Leverage → Critical loan stress
- AA-V5-D3-LEVERAGED: Crypto winter + Leverage → Potential liquidation

### Profile 4: Wealth Preserver (مریم - Maryam)

**Demographics:**
- Age: 55, Retired Business Owner
- Monthly Income: 80M IRR (pension/rental)
- Experience: Traditional (real estate, gold)
- Initial Investment: 2B IRR (lump sum)
- Monthly DCA: None

**Behavioral Patterns:**
- Checks app monthly
- Panics at -15% loss
- Low rebalance willingness
- High loan aversion
- High protection interest

**Key Test Scenarios:**
- WP-V1-D4: Normal + Lump sum → 12-18% yield (heavy fixed income)
- WP-V5-D4: Crypto winter → Only -5-8% loss (gold hedge)
- WP-V6-D4: Gold surge → 12-18% gain (gold-heavy portfolio)
- WP-V7-D4: IRR devaluation → USD hedge benefit

### Profile 5: Speculator (بهرام - Bahram)

**Demographics:**
- Age: 32, Day Trader
- Monthly Income: Variable
- Experience: 7 years active trading
- Initial Investment: 500M IRR
- Leverage: Maximum allowed

**Behavioral Patterns:**
- Monitors continuously
- Almost never panics
- Counter-trades market
- Uses leverage freely

**Key Test Scenarios:**
- SP-V2-D3-LEVERAGED: Bull run + Leverage → 80-120% returns
- SP-V4-D3-LEVERAGED: Flash crash + Leverage → Near-liquidation
- SP-V5-D3-LEVERAGED: Crypto winter + Leverage → Potential wipeout

---

## Part 3: Cash-In Patterns

### Pattern Summary

| Pattern | Type | Suitable Profiles | Key Characteristic |
|---------|------|-------------------|-------------------|
| D1: Fixed Monthly DCA | Recurring | Anxious, Steady | Consistent automation |
| D2: Variable DCA | Recurring | Steady, Aggressive | Income-based flexibility |
| D3: Opportunistic | Event-triggered | Aggressive, Speculator | Buy-the-dip strategy |
| D4: Lump Sum | One-time | Wealth Preserver | Single large investment |
| D5: Hybrid | Combined | All except Anxious | Lump sum + ongoing DCA |
| D6: Micro DCA | Recurring | Anxious | Very small weekly amounts |

### Pattern Details

#### D1: Fixed Monthly DCA
- **Small:** 50M initial + 5M/month = 110M/year
- **Medium:** 200M initial + 30M/month = 560M/year
- **Large:** 500M initial + 100M/month = 1.7B/year

#### D2: Variable DCA
Example annual sequence:
- Regular months: 30M each
- Nowruz bonus: 80M
- Year-end bonus: 100M
- **Total:** ~500M/year

#### D3: Opportunistic
- Reserve cash: 500M (held for dips)
- Normal DCA: 50M/month
- Dip deployment: 200M per -10% drop

#### D4: Lump Sum Sizes
- Small: 500M IRR
- Medium: 2B IRR
- Large: 5B IRR
- Whale: 10B+ IRR

---

## Part 4: Combined Test Matrix

### Priority Tests (Must Pass)

| Test ID | Profile × Volatility × Cash-In | Expected Outcome |
|---------|--------------------------------|------------------|
| AN-V1-D1 | Anxious + Normal + Fixed DCA | Steady 10-18% growth |
| SB-V2-D1 | Steady + Bull Run + Fixed DCA | Rebalance needed |
| AA-V3-D3 | Aggressive + Correction + Opportunistic | Dip buying success |
| WP-V5-D4 | Wealth Preserver + Winter + Lump Sum | Minimal loss (gold hedge) |
| SP-V4-D3 | Speculator + Flash Crash + Leveraged | Near-liquidation survival |

### Critical Edge Cases

| Test ID | Scenario | Purpose |
|---------|----------|---------|
| E-001 | Minimum investment + Maximum volatility | System handles edge amounts |
| E-002 | Whale investment + Flash crash | Large portfolio handling |
| E-003 | All loans at max LTV + Correction | Liquidation cascade |
| E-004 | Protection expires during crash | Expiry warning system |
| E-005 | Rebalance with all assets frozen | Constrained rebalance |
| E-006 | IRR devaluation + Fixed income heavy | Currency risk exposure |
| E-007 | Consecutive flash crashes | Multi-event handling |
| E-008 | Zero cash + Rebalance needed | Smart rebalance suggestions |

---

## Part 5: Verification Checklist

### Portfolio Calculations
- [ ] Total value calculates correctly
- [ ] Layer percentages sum to 100%
- [ ] Holdings: quantity × price × FX rate
- [ ] Fixed income accrual at 23% annual
- [ ] IRR/USD conversion accuracy

### Loan System
- [ ] LTV calculation accuracy
- [ ] Health level thresholds (healthy/caution/warning/critical)
- [ ] Liquidation warnings trigger correctly
- [ ] Frozen assets cannot be sold
- [ ] Collateral value updates with prices

### Rebalancing
- [ ] Trade directions correct
- [ ] Frozen assets skipped
- [ ] Cash untouched during rebalance
- [ ] Post-rebalance closer to target
- [ ] Smart rebalance cash option

### UI/UX
- [ ] Monochrome design compliance
- [ ] No layer-specific colors
- [ ] Loading states
- [ ] Error messages clear
- [ ] Persian text rendering
- [ ] Number formatting (locale)

---

## Part 6: Implementation Notes for Claude Code

### File Structure
```
blu-markets-test-scenarios.js
├── BASELINE_PRICES / FX_RATES
├── VOLATILITY_SCENARIOS (V1-V8)
├── USER_PROFILES (5 profiles)
├── CASH_IN_PATTERNS (6 patterns)
├── TEST_MATRIX (combined scenarios)
├── EDGE_CASE_TESTS
├── VERIFICATION_CHECKLIST
└── TEST_RUNNER_CONFIG
```

### Usage Example
```javascript
const { 
  VOLATILITY_SCENARIOS, 
  USER_PROFILES, 
  TEST_MATRIX 
} = require('./blu-markets-test-scenarios.js');

// Run a specific test
const test = TEST_MATRIX.find(t => t.testId === 'SB-V2-D1');
runScenario(test);
```

### Key Exports
- `VOLATILITY_SCENARIOS` — All 8 market conditions
- `USER_PROFILES` — All 5 user archetypes
- `CASH_IN_PATTERNS` — All 6 funding strategies
- `TEST_MATRIX` — Combined test cases
- `EDGE_CASE_TESTS` — Boundary conditions
- `toIRR(usd)` — Helper for currency conversion

---

*Document Version: 1.0*
*Created: January 15, 2026*
*For: Blu Markets v10 - Claude Code Implementation*
