Commit and push. Make sure it's version is 10 everywhere.# Blu Markets — Canonical User Profiling & Questionnaire Specification
## Single Source of Truth for Risk Assessment and Portfolio Allocation

**Version:** 2.0 (January 2026)  
**Status:** Production  
**Supersedes:** All previous questionnaire documentation

---

## Table of Contents

1. [Purpose & Philosophy](#1-purpose--philosophy)
2. [Core Principles (Non-Negotiable)](#2-core-principles-non-negotiable)
3. [The Four Dimensions of Risk](#3-the-four-dimensions-of-risk)
4. [The Conservative Dominance Rule](#4-the-conservative-dominance-rule)
5. [Question Design Rules](#5-question-design-rules)
6. [Complete Question Specification](#6-complete-question-specification)
7. [Scoring Engine Logic](#7-scoring-engine-logic)
8. [Pathological User Detection](#8-pathological-user-detection)
9. [Score to Allocation Mapping](#9-score-to-allocation-mapping)
10. [Crisis Response Integration](#10-crisis-response-integration)
11. [Iran-Specific Considerations](#11-iran-specific-considerations)
12. [UX Flow & Output Rules](#12-ux-flow--output-rules)
13. [Implementation Reference](#13-implementation-reference)
14. [Testing & Validation](#14-testing--validation)

---

## 1. Purpose & Philosophy

### 1.1 The Single Purpose

The questionnaire exists for **one purpose only**:

> **To define a defensible, initial target allocation across the three portfolio layers:**  
> **Foundation / Growth / Upside**

It is the **structural anchor** of the entire Blu Markets system.

### 1.2 What the Questionnaire Is NOT

The questionnaire does **not**:
- Predict performance
- Assess financial knowledge
- Judge the user
- Remove user agency
- Optimize returns
- Recommend specific assets

### 1.3 The Fundamental Insight

> Most investors **overestimate their risk tolerance in bull markets** and **underestimate it in bear markets**.

When markets are up, everyone wants aggressive portfolios.  
When markets crash, the same people panic sell at the bottom.

**Our job is to protect users from themselves.**

### 1.4 Revealed vs Stated Preference

```
Traditional approach: "How much risk do you want?"
Blu Markets approach: "What would you do if your portfolio dropped 20%?"
```

We measure **revealed preference**, not stated preference.  
Users already know the "right" answers and will lie if asked directly.  
So we ask **sideways**.

---

## 2. Core Principles (Non-Negotiable)

### 2.1 Language & Tone

- **Persian (Farsi) only** for user-facing content
- Everyday, conversational language
- No financial or technical jargon
- No abstract concepts (percentages explained as scenarios, not numbers)
- No judgmental phrasing

**Litmus test:** If an average user might ask «یعنی چی؟», the wording is wrong.

### 2.2 Measurement Scope

The questionnaire may measure **only factors that directly affect portfolio structure**:

| Allowed | Not Allowed |
|---------|-------------|
| Income stability | Investment knowledge |
| Financial resilience | Expected returns |
| Loss tolerance (behavioral) | Market opinions |
| Time horizon | "Aggressive vs conservative" labels |
| Behavior under volatility | Risk appetite (abstract) |

### 2.3 Output Philosophy

- No visible scores to users
- No numeric ratings shown
- No psychological labels ("you're a nervous investor")
- Output is **structural**, not psychological

The user sees:
1. A three-layer allocation (Foundation / Growth / Upside)
2. A short, plain-language explanation
3. Expected range of outcomes
4. Explicit consent

---

## 3. The Four Dimensions of Risk

Every question maps to one of four dimensions:

| Dimension | What It Measures | Weight | Questions |
|-----------|------------------|--------|-----------|
| **Risk Capacity (C)** | Can they afford to lose? | 40% | q_income, q_buffer, q_proportion |
| **Risk Willingness (W)** | Do they want volatility? | 35% | q_crash_20, q_tradeoff, q_past_behavior, q_max_loss |
| **Time Horizon (H)** | How long can money stay? | 15% | q_horizon |
| **Investment Goal (G)** | What's the money for? | 10% | q_goal |

### 3.1 Risk Capacity (C) — 40% Weight

**Definition:** The financial ability to absorb losses without derailing life goals.

**Factors:**
- Income stability (predictability, not absolute income)
- Emergency buffer (months of expenses covered without this money)
- Portfolio proportion (% of total wealth being invested)

**Key insight:** A 25-year-old with stable income and 12 months of savings has HIGH capacity. A 55-year-old investing their retirement savings has LOW capacity — regardless of what they claim.

### 3.2 Risk Willingness (W) — 35% Weight

**Definition:** The psychological ability to tolerate volatility without panic.

**Factors:**
- Response to hypothetical crash scenarios
- Risk-return tradeoff preference
- Past behavior during market drops
- Maximum tolerable loss threshold

**Key insight:** This is where most questionnaires fail. Asking "are you comfortable with risk?" is useless. We use scenario-based questions that force users to reveal their true behavior.

### 3.3 Time Horizon (H) — 15% Weight

**Definition:** How long the money can remain invested without forced liquidation.

**Critical rule:** Time horizon sets the **ceiling** on risk, not the floor.

| Horizon | Maximum Risk Score |
|---------|-------------------|
| < 1 year | 3 |
| 1-3 years | 5 |
| 3-7 years | No cap |
| 7+ years | No cap |

**Key insight:** Even if a user has high capacity and high willingness, a short time horizon caps their risk. Markets can stay down for years.

### 3.4 Investment Goal (G) — 10% Weight

**Definition:** What the money is for.

**Categories:**
- Capital preservation (inflation protection)
- Income generation (regular returns)
- Wealth growth (long-term appreciation)
- Maximum returns (high risk accepted)

**Key insight:** Goal alignment prevents regret. A user saving for a house in 2 years shouldn't be in an aggressive portfolio, even if they think they want one.

---

## 4. The Conservative Dominance Rule

This is the **most important rule** in the entire system:

> **Final Risk = min(Capacity, Willingness)**

A user's risk profile is determined by whichever is lower — their **ability** OR their **tolerance**.

### 4.1 Why This Matters

This rule prevents two dangerous outcomes:
1. Users who **can't afford** risk taking on risk (capacity limits)
2. Users who **can afford** risk but will **panic sell** (willingness limits)

### 4.2 Example Scenarios

| User Profile | Capacity (C) | Willingness (W) | Final Risk | Limiting Factor |
|--------------|--------------|-----------------|------------|-----------------|
| Young professional, stable job, wants aggressive | 8 | 9 | **8** | Capacity |
| Wealthy retiree, panics easily | 7 | 3 | **3** | Willingness |
| Student, no savings, thinks they're brave | 2 | 8 | **2** | Capacity |
| Experienced investor, solid finances | 7 | 7 | **7** | Balanced |
| High earner, short time horizon | 8 | 7 | **3** | Horizon cap |

### 4.3 Formula

```
R_raw = min(C, W)
R_capped = min(R_raw, HorizonCap) if HorizonCap exists
R_penalized = R_capped + ConsistencyPenalties
R_final = clamp(R_penalized - PathologicalPenalties, 1, 10)
```

---

## 5. Question Design Rules

### 5.1 Behavioral Framing (Critical)

Questions must capture:
- **Revealed behavior** — what they would actually do
- **Realistic reactions** — not idealized responses
- **Lived experience** — past actions, not intentions

Questions must avoid:
- "What should you do?"
- "What experts recommend"
- Aspirational answers

### 5.2 Answer Format

- Multiple choice only
- 3-4 options per question
- Options describe **real situations**, not attitudes

**Good framing:**
> «اگر برای مدتی ارزش دارایی‌تون کم بشه، معمولاً چه کاری می‌کنید؟»

**Bad framing:**
> «ریسک‌پذیری شما چقدر است؟»

### 5.3 Scenario Over Opinion

| ❌ Bad | ✅ Good |
|--------|---------|
| "How would you describe your risk tolerance?" | "Your portfolio drops 20% in 3 months. What do you do?" |
| "Are you comfortable with volatility?" | "What's the maximum drop you can tolerate without selling?" |
| "Rate your risk tolerance from 1-10" | "Choose: Guaranteed 20% OR 50% chance of +40%/-10%" |

### 5.4 Scoring Weights

| Weight | Meaning | Applied To |
|--------|---------|------------|
| 2.0 | Critical question — highest impact | q_crash_20 (crash scenario) |
| 1.5 | High importance | q_tradeoff, q_max_loss |
| 1.3 | Above average | q_proportion |
| 1.2 | Slightly elevated | q_buffer |
| 1.0 | Standard | All others |

---

## 6. Complete Question Specification

### 6.1 Question Structure

```json
{
  "version": "v10.1",
  "consent_exact": "متوجه ریسک این سبد دارایی شدم و باهاش موافق هستم.",
  "consent_english": "I understand the risk of this portfolio and I agree with it.",
  "blocks": [
    { "id": "block_capacity", "title_fa": "وضعیت مالی شما", "questions": ["q_income", "q_buffer", "q_proportion"] },
    { "id": "block_goals", "title_fa": "اهداف شما", "questions": ["q_goal", "q_horizon"] },
    { "id": "block_behavior", "title_fa": "واکنش شما", "questions": ["q_crash_20", "q_tradeoff", "q_past_behavior", "q_max_loss"] }
  ]
}
```

### 6.2 Block A: Financial Reality (Capacity)

---

#### Q1: Income Stability

| Field | Value |
|-------|-------|
| ID | `q_income` |
| Dimension | Capacity |
| Weight | 1.0 |
| Purpose | Assess income predictability as foundation for risk capacity |

**Persian:** درآمدت چقدر قابل پیش‌بینیه؟  
**English:** How predictable is your income?

| Option ID | Persian | English | Score |
|-----------|---------|---------|-------|
| `inc_fixed` | ثابت و مطمئن (حقوق، مستمری) | Fixed and reliable (salary, pension) | 8 |
| `inc_mostly` | تقریباً ثابت با کمی نوسان | Mostly stable with some variation | 6 |
| `inc_variable` | متغیر (فریلنس، کسب‌وکار) | Variable (freelance, business) | 4 |
| `inc_uncertain` | نامشخص یا بی‌کار | Uncertain or unemployed | 1 |

---

#### Q2: Emergency Buffer

| Field | Value |
|-------|-------|
| ID | `q_buffer` |
| Dimension | Capacity |
| Weight | 1.2 |
| Purpose | Measure financial resilience — can they survive without this money? |

**Persian:** بدون این پول، چند ماه می‌تونی خرج زندگیت رو بدی؟  
**English:** Without this money, how many months can you cover expenses?

| Option ID | Persian | English | Score |
|-----------|---------|---------|-------|
| `buf_12plus` | بیش از ۱۲ ماه | More than 12 months | 10 |
| `buf_6_12` | ۶ تا ۱۲ ماه | 6 to 12 months | 7 |
| `buf_3_6` | ۳ تا ۶ ماه | 3 to 6 months | 4 |
| `buf_under3` | کمتر از ۳ ماه | Less than 3 months | 1 |

---

#### Q3: Portfolio Proportion

| Field | Value |
|-------|-------|
| ID | `q_proportion` |
| Dimension | Capacity |
| Weight | 1.3 |
| Purpose | Critical capacity limiter — how much of total wealth is at risk? |

**Persian:** این پول چند درصد از کل دارایی‌هاته؟  
**English:** What percentage of your total wealth is this?

| Option ID | Persian | English | Score | Flag |
|-----------|---------|---------|-------|------|
| `prop_small` | کمتر از ۲۵٪ | Less than 25% | 10 | — |
| `prop_medium` | ۲۵٪ تا ۵۰٪ | 25% to 50% | 6 | — |
| `prop_large` | ۵۰٪ تا ۷۵٪ | 50% to 75% | 3 | — |
| `prop_most` | بیشتر از ۷۵٪ | More than 75% | 1 | `high_proportion` |

---

### 6.3 Block B: Goals & Timeline

---

#### Q4: Investment Goal

| Field | Value |
|-------|-------|
| ID | `q_goal` |
| Dimension | Goal |
| Weight | 1.0 |
| Purpose | Anchor allocation strategy to user's actual purpose |

**Persian:** هدف اصلیت از این سرمایه‌گذاری چیه؟  
**English:** What's your main goal for this investment?

| Option ID | Persian | English | Score |
|-----------|---------|---------|-------|
| `goal_preserve` | حفظ ارزش پول در برابر تورم | Preserve value against inflation | 2 |
| `goal_income` | درآمد ثابت (سود منظم) | Steady income (regular returns) | 4 |
| `goal_grow` | رشد سرمایه در بلندمدت | Long-term wealth growth | 7 |
| `goal_maximize` | حداکثر بازدهی (ریسک بالا قبوله) | Maximum returns (high risk OK) | 10 |

---

#### Q5: Time Horizon

| Field | Value |
|-------|-------|
| ID | `q_horizon` |
| Dimension | Horizon |
| Weight | 1.0 |
| Purpose | Set ceiling on risk — short horizon = mandatory de-risk |
| Hard Caps | `hz_1year` → 3, `hz_1_3` → 5 |

**Persian:** کِی ممکنه بخوای این پول رو برداری؟  
**English:** When might you need to withdraw this money?

| Option ID | Persian | English | Score | Hard Cap |
|-----------|---------|---------|-------|----------|
| `hz_1year` | کمتر از ۱ سال | Less than 1 year | 1 | **3** |
| `hz_1_3` | ۱ تا ۳ سال | 1 to 3 years | 4 | **5** |
| `hz_3_7` | ۳ تا ۷ سال | 3 to 7 years | 7 | — |
| `hz_7plus` | بیش از ۷ سال | More than 7 years | 10 | — |

---

### 6.4 Block C: Behavioral Scenarios (Most Important)

---

#### Q6: Crash Scenario (CRITICAL)

| Field | Value |
|-------|-------|
| ID | `q_crash_20` |
| Dimension | Willingness |
| Weight | **2.0** |
| Purpose | **Primary panic detector** — most important question |

**Persian:** فرض کن ۳ ماه بعد از سرمایه‌گذاری، ارزش پورتفوت ۲۰٪ کم شده. چیکار می‌کنی؟  
**English:** Imagine 3 months after investing, your portfolio is down 20%. What do you do?

| Option ID | Persian | English | Score | Flag |
|-----------|---------|---------|-------|------|
| `crash_sell_all` | همه رو می‌فروشم که بیشتر ضرر نکنم | Sell everything to avoid more loss | 1 | `panic_seller` |
| `crash_sell_some` | یه مقدار می‌فروشم، بقیه رو نگه می‌دارم | Sell some, keep the rest | 3 | — |
| `crash_hold` | صبر می‌کنم تا بازار برگرده | Wait for the market to recover | 6 | — |
| `crash_buy` | بیشتر می‌خرم چون ارزون شده | Buy more because it's cheaper | 9 | `check_capacity` |

---

#### Q7: Risk-Return Tradeoff (CRITICAL)

| Field | Value |
|-------|-------|
| ID | `q_tradeoff` |
| Dimension | Willingness |
| Weight | **1.5** |
| Purpose | Revealed preference through forced choice — not stated belief |

**Persian:** کدوم رو ترجیح میدی؟  
**English:** Which do you prefer?

| Option ID | Persian | English | Score | Flag |
|-----------|---------|---------|-------|------|
| `trade_safe` | سود تضمینی ۲۰٪ در سال | Guaranteed 20% annual return | 2 | — |
| `trade_moderate` | ۵۰٪ شانس سود ۴۰٪ یا ضرر ۱۰٪ | 50% chance of +40% or -10% | 5 | — |
| `trade_risky` | ۵۰٪ شانس سود ۸۰٪ یا ضرر ۲۵٪ | 50% chance of +80% or -25% | 8 | — |
| `trade_yolo` | ۵۰٪ شانس سود ۱۵۰٪ یا ضرر ۵۰٪ | 50% chance of +150% or -50% | 10 | `gambler` |

---

#### Q8: Past Behavior

| Field | Value |
|-------|-------|
| ID | `q_past_behavior` |
| Dimension | Willingness |
| Weight | 1.0 |
| Purpose | Historical behavior as predictor of future behavior |

**Persian:** آخرین باری که یه سرمایه‌گذاریت افت کرد، چه حسی داشتی؟  
**English:** Last time an investment dropped, how did you feel?

| Option ID | Persian | English | Score | Flag |
|-----------|---------|---------|-------|------|
| `past_panic` | خیلی استرس داشتم، شب‌ها خوابم نمی‌برد | Very stressed, couldn't sleep | 1 | — |
| `past_worried` | نگران بودم ولی دووم آوردم | Worried but managed | 4 | — |
| `past_calm` | نسبتاً آروم بودم | Relatively calm | 7 | — |
| `past_none` | تجربه‌ای ندارم | No experience | 5 | `inexperienced` |

---

#### Q9: Maximum Loss Tolerance

| Field | Value |
|-------|-------|
| ID | `q_max_loss` |
| Dimension | Willingness |
| Weight | **1.5** |
| Purpose | Explicit downside anchor — used for consistency checking |

**Persian:** حداکثر چند درصد افت رو می‌تونی تحمل کنی بدون اینکه بفروشی؟  
**English:** What's the maximum drop you can tolerate without selling?

| Option ID | Persian | English | Score | Flag |
|-----------|---------|---------|-------|------|
| `loss_5` | ۵٪ — بیشتر از این نه | 5% — no more than this | 1 | — |
| `loss_15` | ۱۵٪ — یه کم درد داره ولی اوکیه | 15% — hurts but OK | 4 | — |
| `loss_30` | ۳۰٪ — سخته ولی صبر می‌کنم | 30% — tough but I'll wait | 7 | — |
| `loss_50` | ۵۰٪ یا بیشتر — بلندمدت فکر می‌کنم | 50%+ — I think long-term | 10 | `check_capacity` |

---

## 7. Scoring Engine Logic

### 7.1 Calculate Sub-Scores

```javascript
function calculateSubScores(answers) {
  // Capacity Score (C): Weighted average of capacity questions
  const C = weightedAverage(answers, ['q_income', 'q_buffer', 'q_proportion']);
  
  // Willingness Score (W): Weighted average of behavioral questions
  const W = weightedAverage(answers, ['q_crash_20', 'q_tradeoff', 'q_past_behavior', 'q_max_loss']);
  
  // Horizon Score (H): Direct from answer
  const H = answers['q_horizon'].score;
  
  // Goal Score (G): Direct from answer
  const G = answers['q_goal'].score;
  
  return { C, W, H, G };
}
```

### 7.2 Check Consistency

```javascript
function checkConsistency(answers) {
  const penalties = [];
  
  const crashAnswer = answers['q_crash_20'];
  const maxLossAnswer = answers['q_max_loss'];
  
  // Inconsistency: Claims to tolerate 30%+ loss but would sell at -20%
  if (crashAnswer.score <= 2 && maxLossAnswer.score >= 7) {
    penalties.push({
      type: 'inconsistent_loss_tolerance',
      amount: -1,
      message: 'Stated loss tolerance higher than behavioral response suggests'
    });
  }
  
  return penalties;
}
```

### 7.3 Apply Conservative Dominance Rule

```javascript
function calculateFinalRisk(answers) {
  const { C, W, H, G } = calculateSubScores(answers);
  const flags = collectFlags(answers);
  const penalties = checkConsistency(answers);
  const warnings = detectPathologicalUser(answers, flags);
  
  // CONSERVATIVE DOMINANCE RULE
  let rawScore = Math.min(C, W);
  const limitingFactor = C < W ? 'capacity' : 'willingness';
  
  // Apply horizon hard cap
  const horizonCap = getHorizonCap(answers);
  if (horizonCap !== null) {
    rawScore = Math.min(rawScore, horizonCap);
  }
  
  // Apply consistency penalties
  rawScore += penalties.reduce((sum, p) => sum + p.amount, 0);
  
  // Apply pathological user caps
  for (const warning of warnings) {
    if (warning.action === 'hard_cap_3') rawScore = Math.min(rawScore, 3);
    if (warning.action === 'hard_cap_5') rawScore = Math.min(rawScore, 5);
    if (warning.action === 'cap_willingness_7') {
      rawScore = Math.min(rawScore, Math.min(C, 7));
    }
  }
  
  // Clamp to valid range
  return Math.max(1, Math.min(10, Math.round(rawScore)));
}
```

---

## 8. Pathological User Detection

### 8.1 The Four Dangerous Archetypes

| Archetype | Detection | Response |
|-----------|-----------|----------|
| **Panic Seller** | Selects "sell everything" in crash scenario | Hard cap at risk 3 |
| **Gambler** | Selects highest-risk tradeoff | Cap willingness at 7 |
| **Gambler + High Stakes** | Gambler flag + >75% of wealth | Hard cap at risk 5 |
| **Dangerous Novice** | No experience + gambler flag | Hard cap at risk 5 |
| **Inexperienced Overreacher** | No experience + high-risk choices | Cap + education |

### 8.2 Detection Logic

```javascript
function detectPathologicalUser(answers, flags) {
  const warnings = [];
  
  // THE PANIC SELLER
  if (flags.includes('panic_seller')) {
    warnings.push({
      type: 'panic_seller',
      action: 'hard_cap_3',
      severity: 'high',
      message: 'User indicates panic selling tendency. Maximum risk: 3.'
    });
  }
  
  // THE GAMBLER + HIGH STAKES
  if (flags.includes('gambler') && flags.includes('high_proportion')) {
    warnings.push({
      type: 'gambler_high_stakes',
      action: 'hard_cap_5',
      severity: 'high',
      message: 'High-risk preference with large portfolio proportion. Maximum risk: 5.'
    });
  } else if (flags.includes('gambler')) {
    warnings.push({
      type: 'gambler',
      action: 'cap_willingness_7',
      severity: 'medium',
      message: 'Gambling tendency detected. Willingness capped at 7.'
    });
  }
  
  // DANGEROUS NOVICE
  if (flags.includes('inexperienced') && flags.includes('gambler')) {
    warnings.push({
      type: 'dangerous_novice',
      action: 'hard_cap_5',
      severity: 'high',
      message: 'No experience + gambling tendency. Maximum risk: 5.'
    });
  }
  
  // INEXPERIENCED OVERREACHER
  if (flags.includes('inexperienced') && flags.includes('check_capacity')) {
    warnings.push({
      type: 'inexperienced_overreach',
      action: 'cap_and_educate',
      severity: 'medium',
      message: 'No market experience but desires high risk. Consider education.'
    });
  }
  
  return warnings;
}
```

### 8.3 Response Actions

| Action | Implementation |
|--------|----------------|
| `hard_cap_3` | `rawScore = Math.min(rawScore, 3)` |
| `hard_cap_5` | `rawScore = Math.min(rawScore, 5)` |
| `cap_willingness_7` | Recalculate with `W = min(W, 7)` |
| `cap_and_educate` | Show extra education screens |

---

## 9. Score to Allocation Mapping

### 9.1 Risk Profiles

| Score | Profile Name | Profile (Persian) |
|-------|--------------|-------------------|
| 1-2 | Capital Preservation | حفظ سرمایه |
| 3-4 | Conservative | محتاط |
| 5-6 | Balanced | متعادل |
| 7-8 | Growth | رشدگرا |
| 9-10 | Aggressive | جسور |

### 9.2 Allocation Table (Foundation / Growth / Upside)

| Score | Foundation | Growth | Upside | Risk Level |
|-------|------------|--------|--------|------------|
| 1 | 85% | 12% | 3% | Minimum risk |
| 2 | 80% | 15% | 5% | Very low risk |
| 3 | 70% | 25% | 5% | Low risk |
| 4 | 65% | 30% | 5% | Conservative |
| 5 | 55% | 35% | 10% | Lower balanced |
| 6 | 50% | 35% | 15% | Balanced |
| 7 | 45% | 38% | 17% | Upper balanced |
| 8 | 40% | 40% | 20% | Growth |
| 9 | 35% | 40% | 25% | High growth |
| 10 | 30% | 40% | 30% | Maximum growth |

### 9.3 Layer Definitions

| Layer | Purpose | Assets | Behavior |
|-------|---------|--------|----------|
| **Foundation** | Survive crashes | USDT, Fixed Income Fund (IRR) | Stable, low volatility |
| **Growth** | Build wealth steadily | Gold, Bitcoin, QQQ | Moderate volatility, solid returns |
| **Upside** | Capture big gains | ETH, SOL, TON | High volatility, high potential |

### 9.4 Profile Descriptions (User-Facing)

```javascript
const PROFILE_DESCRIPTIONS = {
  'Capital Preservation': {
    headline_fa: 'امنیت اولویت شماست',
    body_fa: 'پورتفوی شما روی حفظ سرمایه با حداقل نوسان تمرکز داره. انتظار بازده ثابت و معقول داشته باش.',
    expectation_fa: 'محدوده معمول: -۵٪ تا +۱۵٪ سالانه'
  },
  'Conservative': {
    headline_fa: 'ثبات با رشد ملایم',
    body_fa: 'پورتفوی شما بین امنیت و پتانسیل رشد تعادل برقرار می‌کنه. افت‌های کوچیک رو تحمل می‌کنی.',
    expectation_fa: 'محدوده معمول: -۱۰٪ تا +۲۰٪ سالانه'
  },
  'Balanced': {
    headline_fa: 'رشد همراه با حفاظت',
    body_fa: 'پورتفوی شما دنبال رشد معنادار با حفظ یک شبکه امنیت میره. انتظار نوسان داشته باش.',
    expectation_fa: 'محدوده معمول: -۲۰٪ تا +۳۰٪ سالانه'
  },
  'Growth': {
    headline_fa: 'ساختن ثروت بلندمدت',
    body_fa: 'پورتفوی شما رشد رو به ثبات ترجیح میده. می‌فهمی که نوسان قیمت بازده بالاتره.',
    expectation_fa: 'محدوده معمول: -۳۰٪ تا +۵۰٪ سالانه'
  },
  'Aggressive': {
    headline_fa: 'حداکثر پتانسیل رشد',
    body_fa: 'پورتفوی شما برای حداکثر بازده بهینه شده. نوسان قابل توجه پذیرفته شده.',
    expectation_fa: 'محدوده معمول: -۴۰٪ تا +۸۰٪ سالانه'
  }
};
```

---

## 10. Crisis Response Integration

### 10.1 Live Crisis Playbooks

The questionnaire feeds directly into crisis response systems:

| Market Drop | System Response | User Restrictions |
|-------------|-----------------|-------------------|
| -10% | Banner: "Volatility is normal" | None |
| -20% | Enable sell cooldown (24-72h), show recovery stats | Friction on full exit |
| -30% | Automatic de-risk for panic-prone users | No same-day liquidation |
| -40%+ | Capital preservation mode | Exit only in tranches |

### 10.2 Panic Seller Special Handling

If `panic_seller` flag was set during profiling:
- 72-hour cooldown on full liquidation during crashes
- "Missed rebound simulator" shown before selling
- Human advisor nudge offered (if available)

### 10.3 Gambler Special Handling

If `gambler` flag was set during profiling:
- Upside layer capped at 15%
- Up-risking frozen during rallies
- Historical crash charts shown when attempting to increase risk

---

## 11. Iran-Specific Considerations

### 11.1 Structural Realities

| Factor | Impact on Profiling |
|--------|---------------------|
| High inflation (40%+) | Gold is core, not alternative |
| Currency instability | USD-denominated assets protect value |
| Lower institutional trust | Explicit consent more critical |
| Strong gold preference | Foundation includes gold exposure |
| Fixed income at 30% annual | Competitive with inflation |

### 11.2 Asset Mapping

| Layer | Iran-Adapted Assets |
|-------|---------------------|
| Foundation | USDT (stable), Fixed Income Fund (IRR, 30% annual) |
| Growth | Gold (core holding), Bitcoin, QQQ |
| Upside | ETH, SOL, TON |

### 11.3 Currency Display

- All values displayed in IRR for user familiarity
- Internal calculations in USD for stability
- FX rate updated via live feed

---

## 12. UX Flow & Output Rules

### 12.1 Screen Sequence

```
[1] Welcome → "بیا وضعیتت رو بفهمیم"
[2] Block A: Financial Reality (3 questions)
[3] Block B: Goals & Timeline (2 questions)
[4] Block C: Behavioral Scenarios (4 questions)
[5] Processing → "داریم پروفایلت رو حساب می‌کنیم..."
[6] Result → Show allocation + explanation
[7] Consent → Persian consent sentence
[8] Amount → "چقدر می‌خوای شروع کنی?"
```

### 12.2 Result Screen Requirements

User sees:
1. Profile name (Persian)
2. Three-layer allocation with percentages
3. Plain-language explanation of what this means
4. Expected range of outcomes (downside explicit)
5. Layer breakdown with asset examples

User does NOT see:
- Raw numeric scores
- "AI-powered" or "optimized for you" claims
- Penalty calculations
- Pathological user flags
- Capacity vs willingness breakdown

### 12.3 Consent (Locked Text)

This exact text must be shown and accepted:

> **«متوجه ریسک این سبد دارایی شدم و باهاش موافق هستم.»**

English: "I understand the risk of this portfolio and I agree with it."

This reinforces **ownership**, not authority.

### 12.4 Stability Rules

- The target allocation is **sticky**
- It does not auto-adjust based on behavior
- It changes only if:
  - User explicitly retakes the questionnaire
  - User manually updates preferences later
  - Major life event triggers re-assessment

This prevents silent drift and retroactive justification.

---

## 13. Implementation Reference

### 13.1 File Locations

| File | Purpose |
|------|---------|
| `src/data/questionnaire.v2.fa.json` | Question data, scoring, allocations |
| `src/engine/riskScoring.js` | Scoring engine |
| `src/components/onboarding/` | UI components |
| `src/constants/index.js` | Layer definitions, weights |

### 13.2 Key Functions

```javascript
// In riskScoring.js
export function calculateSubScores(answers, questionnaire)
export function checkConsistency(answers)
export function detectPathologicalUser(answers, flags, scores)
export function getHorizonCap(answers, questionnaire)
export function calculateFinalRisk(answers, questionnaire)
export function getProfileDescription(score)
export function answersToRichFormat(answersObj, questionnaire)
```

### 13.3 Data Flow

```
User answers (indices)
    ↓
answersToRichFormat() → Rich answers with scores & flags
    ↓
calculateSubScores() → C, W, H, G
    ↓
checkConsistency() → Penalties
    ↓
detectPathologicalUser() → Warnings
    ↓
calculateFinalRisk() → Final score (1-10)
    ↓
Lookup allocation from questionnaire.allocations
    ↓
Return profile + allocation to UI
```

---

## 14. Testing & Validation

### 14.1 Required Test Paths

| Test Case | Expected Result |
|-----------|-----------------|
| Panic Seller path (sell all + any capacity) | Score ≤ 3 |
| Gambler path (YOLO tradeoff + any) | Willingness capped at 7 |
| Gambler + High Stakes (YOLO + >75% wealth) | Score ≤ 5 |
| Dangerous Novice (no exp + gambler) | Score ≤ 5 |
| Short horizon (<1 year + any) | Score ≤ 3 |
| Medium horizon (1-3 years + high willing) | Score ≤ 5 |
| Inconsistent (sell all + tolerate 50%) | Penalty applied |
| Perfect conservative | Score 3-4 |
| Perfect balanced | Score 5-6 |
| Perfect growth | Score 7-8 |

### 14.2 Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| All questions answered with lowest scores | Score = 1 |
| All questions answered with highest scores | Score = 10 (no gambler flag) |
| Missing answers | Use default score 5, log warning |
| Horizon cap lower than min(C,W) | Use horizon cap |

### 14.3 Success Metrics

| Metric | Target |
|--------|--------|
| Completion rate | > 85% |
| Average time to complete | 90-120 seconds |
| % users who panic sell in first crash | < 15% |
| % users who stay invested through -20% | > 80% |
| Regret reversal rate (sell → buy back <30d) | < 10% |

---

## Appendix A: One-Sentence Litmus Test

> **If the user ignores all guidance after onboarding, Blu Markets should still remain structurally coherent.**

That is the standard this questionnaire must meet.

---

## Appendix B: Strategic Truth

If Blu Markets:
- Lets users panic → it dies
- Lets users gamble → it dies
- Optimizes for short-term happiness → it dies

If Blu Markets:
- Engineers survival → it thrives
- Engineers expectation → it thrives
- Engineers regret minimization → it becomes **financial infrastructure**

---

## Appendix C: Ethical Commitments

### We Protect, Not Patronize
We don't tell users they're wrong. We show them scenarios and let behavior speak.

### We Default to Safety
When in doubt, we choose the safer profile. A user slightly under-risked is better than a user who panics and sells.

### We Explain, Not Hide
Users deserve to understand why they got their profile. We show the reasoning, not just the result.

### We Allow Override (With Friction)
Users can request a different profile, but must:
- Acknowledge the risks explicitly
- See worst-case scenarios
- Confirm in writing

We respect autonomy while adding appropriate friction.

---

**Document Version:** 2.0  
**Last Updated:** January 2026  
**Owner:** Product Strategy  
**Status:** Canonical — all other documents are superseded
