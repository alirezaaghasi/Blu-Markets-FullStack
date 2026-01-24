# Blu Markets Generative Agent Simulation v3
## Claude Code Prompt

**Framework:** a16z AI Market Research  
**Data:** Saraf Critical Analysis (6.67M users) + TechRasa FinTech 2025

---

## The Core Finding

> "Saraf can acquire users but struggles to retain them. The product works for committed users (74.6% post-KYC conversion), but **TRUST—not features—is the bottleneck**."

**Key Insight:** KYC completion is 74.6% once started. The problem is **58.6% won't START** because they don't trust the app enough to submit their ID.

---

## Setup (First Time)

```bash
unzip blu-ai-testing-v3.zip -d blu-testing
cd blu-testing
npm install
```

---

## Run Simulations

### Paste into Claude Code:

**Scenario 1: Trust-Building (CRITICAL)**
```
cd blu-testing && node test.js trust
```
Tests: Blu Bank association, regulatory badges, testimonials → increase KYC start rate

**Scenario 2: First Session**
```
cd blu-testing && node test.js first-session
```
Tests: Inflation messaging, paper trading, portfolio preview → reduce 52.4% one-timers

**Scenario 3: Pricing Sensitivity**
```
cd blu-testing && node test.js pricing
```
Tests: Fee reveal timing, VIP tiers → retain price-sensitive traders

**Scenario 4: Country Risk**
```
cd blu-testing && node test.js shutdown
```
Tests: Post-shutdown messaging, offline capability → rebuild trust after blackouts

**Scenario 5: Gold-Only Path**
```
cd blu-testing && node test.js gold
```
Tests: Hiding crypto from 45+ users → increase traditional investor conversion

**Run Everything:**
```
cd blu-testing && node test.js all
```

---

## The 7 Generative Agents

| Agent | Segment | Simulation Goal |
|-------|---------|-----------------|
| **Amir** | 35% | Test if Blu Bank trust signals increase KYC start from 41% to 60% |
| **Fatemeh** | 18% | Test if webapp improvements close 2x conversion gap with native |
| **Ali** | 12% | Test if competitive pricing retains price-sensitive traders |
| **Hossein** | 10% | Test if gold-only path increases 45+ conversion |
| **Sara** | 15% | Validate if diaspora actually exists (VPN pollution check) |
| **Reza** | 3% | Test if VIP pricing retains power traders vs Nobitex |
| **Maryam** | 7% | Test if post-shutdown messaging rebuilds trust faster |

---

## What's Different in v3 (a16z Framework)

| Aspect | v2 | v3 |
|--------|----|----|
| **Focus** | UX issues | **Hypothesis validation** |
| **Agent Default** | Neutral | **Skeptical by default** |
| **Core Problem** | Friction | **TRUST** |
| **Output** | Confidence rating | **Trust level + Hypothesis result** |
| **Data Source** | 3.98M users | **6.67M users (critical analysis)** |
| **Organic Referral** | 25.8% | **11%** (rest was lottery-driven) |

---

## Critical Saraf Findings (Embedded in All Agents)

```
TRUST IS THE BOTTLENECK:
- 58.6% abandon BEFORE starting KYC
- But 74.6% complete once they START
- The flow works. Users don't trust the app.

PAID ACQUISITION IS BURNING MONEY:
- Yektanet Week 4 retention: 0.3%
- Snapp Week 4 retention: 0.0%
- Only organic users retain

UNIT ECONOMICS UNDERWATER:
- LTV: $0.28
- CAC: $0.50
- Losing money on every user at 3x pricing

VPN POLLUTION:
- 30% "diaspora" is likely VPN users in Iran
- Geographic data unreliable
```

---

## Sample Output

```
╔════════════════════════════════════════════════════════════════════════════╗
║         BLU MARKETS GENERATIVE AGENT SIMULATION v3                         ║
║         a16z AI Market Research Framework                                  ║
╠════════════════════════════════════════════════════════════════════════════╣
║  Scenario: Scenario 1: Trust-Building Before KYC (CRITICAL)                ║
╚════════════════════════════════════════════════════════════════════════════╝

📊 Saraf Baseline → Blu Target:
────────────────────────────────────────────────────────────────────────────────
   kyc_start_rate             41.4%      → >60%      (Trust messaging works)
   day1_retention             40.7%      → >50%      (First session improved)

┌─ Amir (امیر) ──────────────────────────────────────────────────────┐
│  The Cautious First-Timer (35% of base)
│  Goal: Test if Blu Bank trust signals increase KYC start rate...
└────────────────────────────────────────────────────────────────────────┘
  → Welcome (Current - No Trust Signals)     ⚠️ Trust: 3/10 | Hyp: ✗
  → Welcome (With Trust Signals)             ✓ Trust: 7/10 | Hyp: ✓
  → Paper Trading Before KYC                 ✓ Trust: 8/10 | Hyp: ✓

╔════════════════════════════════════════════════════════════════════════════╗
║                         SIMULATION SUMMARY                                 ║
╠════════════════════════════════════════════════════════════════════════════╣
║  Simulations run:      9                                                   ║
║  Average trust level:  6.2/10                                              ║
║  Would abandon:        2 (22%)                                             ║
╠════════════════════════════════════════════════════════════════════════════╣
║  HYPOTHESIS VALIDATION:                                                    ║
║    ✓ Validated:        5                                                   ║
║    ◐ Partially:        2                                                   ║
║    ✗ Not Validated:    2                                                   ║
╚════════════════════════════════════════════════════════════════════════════╝

📈 a16z INSIGHT: Hypotheses trending positive - proceed with build
```

---

## Interpreting Results

### Trust Level (1-10)
- **8-10:** High trust, will proceed
- **5-7:** Moderate trust, needs more signals
- **3-4:** Low trust, likely to abandon
- **1-2:** No trust, will definitely abandon

### Hypothesis Validation
- **✓ Validated:** Design achieves intended effect
- **◐ Partially:** Works for some agents, not all
- **✗ Not Validated:** Hypothesis failed, iterate design

### a16z Decision Framework
- **>50% Validated:** Proceed with build
- **Mixed Results:** Iterate on design, re-simulate
- **>50% Not Validated:** Fundamental rethink needed

---

## Success Metrics (Saraf → Blu Target)

| Metric | Saraf Baseline | Blu Target |
|--------|---------------|------------|
| KYC Start Rate | 41.4% | **>60%** |
| Post-KYC Conversion | 74.6% | >80% |
| Day 1 Retention | 40.7% | **>50%** |
| Day 6 Retention | 18.6% | >25% |
| One-Timer Rate | 52.4% | **<35%** |
| Organic Referral | 11% | >20% |
| LTV/CAC | 0.56x | **>1.5x** |

---

## What Blu Must Do Differently (from doc)

### Don't Replicate Saraf's Failures:
- ❌ Paid acquisition (0% Week 4 retention)
- ❌ Incentive campaigns (attracts bounty hunters)
- ❌ 3x market pricing (still losing money)
- ❌ iOS webapp fallback (2x worse conversion)

### Competitive Opportunities:
- ✅ Blu Bank association as trust shortcut
- ✅ App Store approval = major differentiator
- ✅ Paper trading before KYC
- ✅ Offline capability for shutdowns

---

## Cost Estimate

| Scenario | API Calls | Est. Cost |
|----------|-----------|-----------|
| trust | 9 | ~$0.15 |
| pricing | 6 | ~$0.10 |
| shutdown | 4 | ~$0.07 |
| all | 28 | ~$0.45 |
