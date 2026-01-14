# Blu Markets — Risk Profiling Philosophy & Design Principles
## Product Strategy Document

---

## Executive Summary

The onboarding questionnaire is not a form. It is **the product**.

Every decision a user makes in Blu Markets flows from their risk profile. A poorly designed questionnaire leads to:
- Users in wrong portfolios
- Panic selling during downturns
- Churn and loss of trust
- Platform blamed for user mistakes

This document defines the philosophy, design principles, and logic behind Blu Markets' risk profiling system.

---

## 1. Core Philosophy

### 1.1 The Fundamental Problem

> Most investors **overestimate their risk tolerance in bull markets** and **underestimate it in bear markets**.

When markets are up, everyone wants aggressive portfolios.
When markets crash, the same people panic sell at the bottom.

**Our job is to protect users from themselves.**

### 1.2 The Blu Markets Approach

We don't ask users what they want.
We discover what they can actually handle.

```
Traditional approach: "How much risk do you want?"
Blu Markets approach: "What would you do if your portfolio dropped 20%?"
```

Stated preference ≠ Revealed preference.
We measure revealed preference.

---

## 2. The Four Dimensions of Risk

Every user has four dimensions that determine their appropriate risk level:

### 2.1 Risk Capacity (Weight: 40%)

**Definition:** The financial ability to absorb losses without derailing life goals.

**Factors:**
- Life stage (age proxy)
- Income stability
- Emergency buffer
- Proportion of wealth invested

**Key insight:** A 25-year-old with stable income and 12 months of savings has HIGH capacity. A 55-year-old investing their retirement savings has LOW capacity — regardless of what they claim.

### 2.2 Risk Willingness (Weight: 35%)

**Definition:** The psychological ability to tolerate volatility without panic.

**Factors:**
- Response to hypothetical crash scenarios
- Risk-return tradeoff preference
- Past behavior during market drops
- Maximum tolerable loss

**Key insight:** This is where most questionnaires fail. Asking "are you comfortable with risk?" is useless. We use scenario-based questions that force users to reveal their true behavior.

### 2.3 Time Horizon (Weight: 15%)

**Definition:** How long the money can remain invested without forced liquidation.

**Rule:** Time horizon sets the **ceiling** on risk, not the floor.
- < 1 year → Maximum risk score: 3
- 1-3 years → Maximum risk score: 5
- 3-7 years → Maximum risk score: 8
- 7+ years → No cap

**Key insight:** Even if a user has high capacity and high willingness, a short time horizon caps their risk. Markets can stay down for years.

### 2.4 Investment Goal (Weight: 10%)

**Definition:** What the money is for.

**Categories:**
- Capital preservation (inflation protection)
- Income generation (regular returns)
- Wealth growth (long-term appreciation)
- Maximum returns (high risk accepted)

**Key insight:** Goal alignment prevents regret. A user saving for a house in 2 years shouldn't be in an aggressive portfolio, even if they think they want one.

---

## 3. The Conservative Dominance Rule

This is the most important rule in the system:

> **Final Risk = minimum(Capacity, Willingness)**

A user's risk profile is determined by whichever is lower — their ability OR their tolerance.

**Example scenarios:**

| User | Capacity | Willingness | Final Risk |
|------|----------|-------------|------------|
| Young professional, stable job, wants aggressive | 8 | 9 | **8** (capacity limits) |
| Wealthy retiree, panics easily | 7 | 3 | **3** (willingness limits) |
| Student, no savings, thinks they're brave | 2 | 8 | **2** (capacity limits) |
| Experienced investor, solid finances | 7 | 7 | **7** (balanced) |

**Why this matters:** This rule prevents two dangerous outcomes:
1. Users who can't afford risk taking on risk
2. Users who can afford risk but will panic sell

---

## 4. Pathological User Detection

Not all users answer honestly or consistently. We identify four dangerous archetypes:

### 4.1 The Panic Seller

**Profile:** Will sell at the first sign of trouble.

**Detection:**
- Selects "sell everything" in crash scenarios
- High checking frequency
- Loss aversion dominant

**Response:**
- Hard cap at risk level 3
- Extra education about market cycles
- Warnings shown at consent

### 4.2 The Gambler

**Profile:** Chases maximum returns without understanding risk.

**Detection:**
- Always selects highest-risk option
- Selects "150% gain or 50% loss" tradeoff
- Investing large proportion of wealth
- Overconfident self-assessment

**Response:**
- Cap willingness score at 7
- Force diversification
- Show historical worst-case scenarios

### 4.3 The Liar

**Profile:** Claims aggressive but reveals conservative.

**Detection:**
- Self-assessment score >> behavioral score
- Says "growth-oriented" but selects "sell" in scenarios
- Gap > 4 points between stated and revealed

**Response:**
- Use revealed preference, ignore stated
- Show explanation of discrepancy
- Offer to retake questionnaire

### 4.4 The Inexperienced Overreacher

**Profile:** No market experience but wants high risk.

**Detection:**
- "No experience" in past behavior question
- Selects high-risk options
- Short time horizon

**Response:**
- Cap at moderate risk (5-6)
- Mandatory education screens
- Suggest starting small

---

## 5. Question Design Principles

### 5.1 Scenario Over Opinion

❌ Bad: "How would you describe your risk tolerance?"
✅ Good: "Your portfolio drops 20% in 3 months. What do you do?"

Opinions are unreliable. Scenarios reveal behavior.

### 5.2 Concrete Over Abstract

❌ Bad: "Are you comfortable with volatility?"
✅ Good: "What's the maximum drop you can tolerate without selling?"

Abstract concepts mean different things to different people.

### 5.3 Tradeoffs Over Ratings

❌ Bad: "Rate your risk tolerance from 1-10"
✅ Good: "Choose: Guaranteed 20% OR 50% chance of +40%/-10%"

Tradeoffs force real preference revelation.

### 5.4 Consistency Checks Built In

We ask the crash scenario twice, in different ways:
- Q7: "Portfolio drops 20%, what do you do?"
- Q12: "Bad news drops market 15%, first move?"

If answers differ by > 5 points → inconsistency penalty applied.

### 5.5 Low Weight on Self-Assessment

Self-assessment ("How would you describe yourself?") is included but weighted at only 0.5x. It serves as a sanity check, not a primary input.

---

## 6. Scoring Transparency

### 6.1 What Users See

Users receive:
- A named profile (Conservative, Balanced, Growth, etc.)
- A clear allocation (Foundation 65%, Growth 30%, Upside 5%)
- An explanation of why this fits them
- What to expect (potential downside)

### 6.2 What Users Don't See

Users don't see:
- Raw numeric scores
- Penalty calculations
- Pathological user flags
- Limiting factor (capacity vs willingness)

This is intentional. Showing "you scored 4/10 on willingness" creates gaming incentives.

### 6.3 What We Store

For compliance and re-assessment:
- All answers with timestamps
- Calculated sub-scores
- Final risk score
- Flags and penalties applied
- Limiting factor

---

## 7. The 12 Questions — Strategic Purpose

| # | Question | Strategic Purpose |
|---|----------|-------------------|
| 1 | Life stage | Age proxy for capacity ceiling |
| 2 | Income stability | Capacity foundation |
| 3 | Emergency buffer | Can they survive without this money? |
| 4 | Portfolio proportion | How much skin in the game? |
| 5 | Investment goal | Anchor for allocation strategy |
| 6 | Time horizon | Hard cap on risk level |
| 7 | **Crash scenario (20%)** | **Primary panic detector** |
| 8 | **Risk-return tradeoff** | **Revealed risk preference** |
| 9 | Past behavior | Historical panic tendency |
| 10 | Maximum loss tolerance | Explicit downside anchor |
| 11 | Self-assessment | Sanity check |
| 12 | Consistency check | Detect contradictions |

Questions 7 and 8 are the most important. They carry 2x weight.

---

## 8. Allocation Philosophy

### 8.1 The Three Layers

| Layer | Purpose | Assets |
|-------|---------|--------|
| **Foundation** | Survive crashes | USDT, Fixed Income, Gold |
| **Growth** | Build wealth steadily | Gold, Bitcoin, QQQ |
| **Upside** | Capture big gains | ETH, SOL, TON |

### 8.2 Why These Ratios?

**Conservative (65/30/5):**
- 65% Foundation ensures survival in -40% crash
- 30% Growth provides inflation-beating returns
- 5% Upside gives small exposure to upside

**Balanced (50/35/15):**
- 50% Foundation protects half the portfolio
- 35% Growth is the primary wealth builder
- 15% Upside adds meaningful growth potential

**Growth (40/40/20):**
- 40% Foundation is the minimum safety net
- 40% Growth maximizes wealth building
- 20% Upside captures significant gains

### 8.3 Iran-Specific Considerations

- **Gold is core, not alternative.** In Iran's inflationary environment, gold is a primary store of value.
- **Fixed Income at 30% annual.** Competitive with inflation, provides stability.
- **USD-denominated assets.** Protect against Rial devaluation.

---

## 9. Crisis Behavior Integration

The questionnaire feeds into crisis response systems:

### 9.1 Panic Seller Detected → Extra Friction

If Q7 or Q12 indicates panic selling:
- 72-hour cooldown on full liquidation during crashes
- "Missed rebound simulator" shown before selling
- Human advisor nudge offered

### 9.2 Gambler Detected → Growth Caps

If tradeoff question reveals gambling tendency:
- Upside layer capped at 15%
- Up-risking frozen during rallies
- Historical crash charts shown

### 9.3 Inexperienced User → Education First

If no market experience:
- Extended onboarding with education
- Smaller starting amounts suggested
- Check-in after first volatility event

---

## 10. Re-Assessment Triggers

The questionnaire is not one-and-done:

| Trigger | Action |
|---------|--------|
| 6 months elapsed | Prompt re-assessment |
| Major life event reported | Prompt re-assessment |
| Market crash > 25% | Check in on risk comfort |
| User attempts panic sell | Offer re-assessment + education |
| User attempts aggressive up-risk | Verify capacity change |

---

## 11. Success Metrics

### 11.1 Questionnaire Health Metrics

- Completion rate (target: > 85%)
- Average time to complete (target: 3-5 minutes)
- Consistency score distribution
- Pathological user detection rate

### 11.2 Downstream Success Metrics

- % users who panic sell in first crash
- % users who complete 12 months without profile change
- Regret reversal rate (sell → buy back within 30 days)
- Churn rate by risk profile

### 11.3 The Ultimate Metric

> **% of users who stay invested through their first -20% drawdown**

If this number is high, the questionnaire worked.
If this number is low, we failed.

---

## 12. Ethical Commitments

### 12.1 We Protect, Not Patronize

We don't tell users they're wrong. We show them scenarios and let behavior speak.

### 12.2 We Default to Safety

When in doubt, we choose the safer profile. A user slightly under-risked is better than a user who panics and sells.

### 12.3 We Explain, Not Hide

Users deserve to understand why they got their profile. We show the reasoning, not just the result.

### 12.4 We Allow Override (With Friction)

Users can request a different profile, but must:
- Acknowledge the risks explicitly
- See worst-case scenarios
- Confirm in writing

We respect autonomy while adding appropriate friction.

---

## 13. Summary

The Blu Markets questionnaire is designed around one insight:

> **The goal is not to maximize returns. The goal is to minimize regret.**

A user who stays invested through volatility beats a user who panic sells at the bottom — even if the first user had a "safer" portfolio.

Our questionnaire identifies who can handle what, matches them to the right allocation, and protects them from their own worst instincts.

This is not a form.
This is behavioral risk management.
This is the product.

---

**Document Owner:** Product Strategy  
**Last Updated:** January 2026  
**Version:** 2.0
