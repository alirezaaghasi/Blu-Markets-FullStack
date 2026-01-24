# Blu Markets Simulation Framework: v3 → v4 Migration

## Why We Rebuilt the Framework

### The Core Problem with v3

v3 was built on Saraf's data and assumptions. But Blu Markets is **fundamentally different**:

| Dimension | Saraf (v3 Assumption) | Blu Markets Reality |
|-----------|----------------------|---------------------|
| **User Source** | Cold users from paid ads | 12M existing Blu Bank customers |
| **Trust Baseline** | 3/10 (unknown app) | 8-9/10 (existing bank relationship) |
| **KYC Friction** | 58.6% abandon before KYC | 0% - Blu Bank users skip KYC entirely |
| **Business Model** | Trading exchange (0.75% per trade) | Wealth management (AUM + subscription) |
| **Revenue Driver** | Trading volume | AUM growth + retention + loans |
| **Competition** | Nobitex (0.25% fees) | Bank deposits, gold shops, doing nothing |
| **Core Question** | "Will they trust us?" | "Will they activate this feature?" |

### The Blu Bank Advantage

```
Blu Bank Universe:
├── Total Installs: 20,000,000
├── Active Users (60%): 12,000,000
└── Already KYC'd: 12,000,000

For Blu Bank customers:
✓ Trust = Pre-established (they already use Blu Bank)
✓ KYC = Already done (just verify phone number)
✓ Acquisition cost = ~$0 (internal cross-sell)
✓ Value prop = "New feature in your existing banking app"
```

---

## What Changed: v3 vs v4

### Personas

| v3 Persona | Based On | v4 Replacement | Based On |
|------------|----------|----------------|----------|
| Amir (skeptical) | Saraf paid channel users | Mina (young saver) | Blu Bank millennials |
| Fatemeh (hesitant) | Saraf webapp users | Leila (cautious mother) | Blu Bank family managers |
| Ali (crypto curious) | Saraf crypto traders | Navid (ambitious) | Blu Bank high-earners |
| Hossein (traditional) | Gold-focused users | Dariush (conservative) | Blu Bank 45+ segment |
| - | - | Reza (power user) | Blu Bank HNW customers |
| Amir, Hossein | - | Amir, Hossein (cold) | Non-Blu Bank prospects |

### Scenarios

| v3 Scenario | Focus | v4 Replacement | Focus |
|-------------|-------|----------------|-------|
| Trust-Building Before KYC | 58.6% pre-KYC abandonment | Cross-Sell Activation | Converting existing customers |
| First Session | One-timer rate | Value Proposition | Messaging that converts |
| Pricing Sensitivity | 0.75% vs 0.25% fees | Premium Upsell | 60M/year subscription |
| Country Risk | Internet shutdown | Gold-Only Path | Conservative/religious users |
| Gold-Only Path | Same | Cold User Trust | Secondary: new user acquisition |

### Metrics

| v3 Metric | Source | v4 Replacement | Rationale |
|-----------|--------|----------------|-----------|
| KYC Start Rate (41.4%) | Saraf | Activation Rate (>10%) | Blu Bank users skip KYC |
| Day 1 Retention (40.7%) | Saraf | First Deposit Rate (>40%) | Wealth mgmt = different behavior |
| Day 6 Retention (18.6%) | Saraf | 30-Day Retention (>70%) | Long-term relationships |
| One-Timer Rate (52.4%) | Saraf | Premium Conversion (>20%) | Revenue-focused for >500M AUM |
| LTV/CAC (0.56x) | Saraf | N/A | CAC ≈ $0 for Blu Bank users |

---

## Key Hypotheses to Validate (v4)

### Priority 0 (Critical)
1. **Blu Bank customers activate at >10% when offered via in-app notification**
   - 12M × 10% = 1.2M users
   - This is the entire business case

2. **Wealth management framing outperforms trading framing**
   - "Protect your wealth from inflation" vs "Buy and sell crypto"
   - Affects all messaging

### Priority 1 (High)
3. **Users with >500M AUM convert to premium at >20%**
   - Premium (60M/year) is 32.8% of revenue via loans
   - Key for unit economics

4. **Inflation calculator increases activation by 3x**
   - Personalized "you're losing X to inflation" messaging
   - Addresses the core pain point

### Priority 2 (Medium)
5. **Gold-only path converts conservative users at 2x rate**
   - No crypto visibility, halal certification, phone support
   - Captures 45+ segment

6. **Trust signals increase cold user registration by 3x**
   - For users without Blu Bank relationship
   - Secondary growth channel

---

## Implementation Differences

### v3 (Saraf-Based)
```javascript
// Focus: Trust building for cold users
const trustLevel = await testScreen('welcome_no_trust'); // 2.5/10
const withTrust = await testScreen('welcome_with_trust'); // 5.3/10
// Conclusion: Need trust signals before KYC
```

### v4 (Blu Markets Native)
```javascript
// Focus: Activation for existing Blu Bank customers
const banner = await testScreen('cross_sell_banner'); // In-app banner
const push = await testScreen('cross_sell_push'); // Push notification
const welcome = await testScreen('cross_sell_welcome'); // No KYC needed
// Conclusion: Test messaging that converts existing trust into activation
```

---

## What Saraf Data IS Still Useful For

| Data Point | Application in v4 |
|------------|-------------------|
| Paid acquisition failure (0% Week 4) | Don't replicate for cold users |
| Webapp vs native gap (2x) | Consider if webapp fallback needed |
| Country risk (internet shutdowns) | Build offline capability |
| Gold preference in 45+ | Gold-only path design |
| General Iranian fintech psychology | Agent personality calibration |

## What Saraf Data Is NOT Useful For

| Data Point | Why Irrelevant |
|------------|----------------|
| 58.6% pre-KYC abandonment | Blu Bank users skip KYC |
| 52.4% one-timer rate | Different product, different behavior |
| 0.75% pricing sensitivity | Different revenue model (AUM, not per-trade) |
| LTV/CAC ratios | CAC ≈ $0 for Blu Bank users |
| Trading conversion metrics | Wealth management ≠ trading |

---

## Running v4 Simulations

```bash
cd blu-simulation-v4
npm install

# Priority scenarios
npm run cross-sell    # CRITICAL: Blu Bank activation
npm run value-prop    # HIGH: Messaging tests
npm run premium       # HIGH: Subscription conversion

# Secondary scenarios
npm run gold          # MEDIUM: Conservative users
npm run cold-trust    # SECONDARY: New user acquisition

# All scenarios
npm run all
```

### Estimated Costs

| Scenario | API Calls | Cost |
|----------|-----------|------|
| cross-sell | 15 | ~$0.25 |
| value-prop | 15 | ~$0.25 |
| premium | 6 | ~$0.10 |
| gold | 4 | ~$0.07 |
| cold-trust | 4 | ~$0.07 |
| **Total** | **52** | **~$0.87** |

---

## Expected Outcomes

If v4 hypotheses are validated:

| Metric | Expected Result | Business Impact |
|--------|-----------------|-----------------|
| Activation Rate | 10-15% | 1.2M - 1.8M users from Blu Bank |
| First Deposit | 40-50% | 480K - 900K funded accounts |
| Premium Conversion | 20-30% (>500M AUM) | Revenue base for loans |
| 30-Day Retention | 70%+ | Long-term AUM growth |

If hypotheses are NOT validated:
- Iterate on messaging (wealth vs trading)
- Test different cross-sell channels
- Adjust premium pricing/features
- Consider if cold acquisition is worth pursuing at all

---

**Document Version:** 4.0
**Migration Date:** January 2026
**Framework:** a16z AI Market Research (Adapted)
