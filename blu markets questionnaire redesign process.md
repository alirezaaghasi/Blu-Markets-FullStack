# Blu Markets — Questionnaire Redesign Process
## From Research to Production-Ready User Profiling

---

## Overview

This document outlines a step-by-step process to redesign the onboarding questionnaire based on:
- Global wealth management best practices
- Iran-specific market realities
- Behavioral finance principles
- Crisis-tested risk profiling

**Current State:** 8 questions, basic scoring, maps to 3 allocation profiles  
**Target State:** 10-12 questions, multi-dimensional scoring, pathological user detection

---

## Step 1: Define the Four Core Dimensions

Every question must map to one of these dimensions:

| Dimension | What It Measures | Weight |
|-----------|------------------|--------|
| **Risk Capacity (C)** | Can they afford to lose? | 40% |
| **Risk Willingness (W)** | Do they want volatility? | 35% |
| **Time Horizon (H)** | How long can money stay? | 15% |
| **Investment Goal (G)** | What's the money for? | 10% |

**Critical Rule:**
> Final Risk = min(Capacity, Willingness) — adjusted for penalties

A user who *wants* high risk but *can't afford* it gets conservative.

---

## Step 2: Audit Current Questionnaire

### Current Questions Mapped to Dimensions

| # | Question ID | Dimension | Gap? |
|---|-------------|-----------|------|
| 1 | q_income | Capacity | ✅ OK |
| 2 | q_buffer | Capacity | ✅ OK |
| 3 | q_dependency | Capacity/Liquidity | ✅ OK |
| 4 | q_horizon | Time Horizon | ✅ OK |
| 5 | q_past_behavior | Willingness | ⚠️ Weak — past, not hypothetical |
| 6 | q_check_freq | Behavioral | ⚠️ Indirect proxy |
| 7 | q_regret | Willingness | ✅ OK |
| 8 | q_forced_exit | Capacity | ✅ OK |

### Critical Gaps Identified

| Gap | Impact | Priority |
|-----|--------|----------|
| **No crash scenario question** | Can't measure panic tendency | 🔴 Critical |
| **No risk-return tradeoff** | Can't measure true preference | 🔴 Critical |
| **No investment goal question** | Can't anchor allocation | 🟡 High |
| **No age/life stage** | Missing capacity factor | 🟡 High |
| **No inconsistency detection** | Can't catch liars/gamblers | 🟡 High |
| **No Iran-specific questions** | Missing inflation/currency dimension | 🟢 Medium |

---

## Step 3: Design New Question Set

### 3.1 Structure: 12 Questions in 4 Blocks

```
Block A: Financial Reality (Capacity)     — 4 questions
Block B: Goals & Timeline (Horizon/Goal)  — 2 questions  
Block C: Behavioral Scenarios (Willingness) — 4 questions
Block D: Self-Check & Consistency         — 2 questions
```

### 3.2 New Questions — Detailed Specification

---

## BLOCK A: Financial Reality (Capacity)

### Q1: Life Stage [NEW]
**Purpose:** Age proxy for capacity calculation

```json
{
  "id": "q_life_stage",
  "text": "الان تو چه مرحله‌ای از زندگیت هستی؟",
  "english": "What stage of life are you in?",
  "dimension": "capacity",
  "options": [
    { "id": "stage_student", "text": "دانشجو یا تازه شروع کردم به کار", "english": "Student or just starting career", "score": 8 },
    { "id": "stage_building", "text": "دارم زندگیم رو می‌سازم (۲۵-۴۰)", "english": "Building my life (25-40)", "score": 7 },
    { "id": "stage_established", "text": "زندگیم جا افتاده (۴۰-۵۵)", "english": "Established (40-55)", "score": 5 },
    { "id": "stage_preretire", "text": "نزدیک بازنشستگی یا بازنشسته", "english": "Near or at retirement", "score": 2 }
  ]
}
```

### Q2: Income Stability [KEEP - Enhanced]
```json
{
  "id": "q_income",
  "text": "درآمدت چقدر قابل پیش‌بینیه؟",
  "english": "How predictable is your income?",
  "dimension": "capacity",
  "options": [
    { "id": "inc_fixed", "text": "ثابت و مطمئن (حقوق، مستمری)", "english": "Fixed and reliable (salary, pension)", "score": 8 },
    { "id": "inc_mostly", "text": "تقریباً ثابت با کمی نوسان", "english": "Mostly stable with some variation", "score": 6 },
    { "id": "inc_variable", "text": "متغیر (فریلنس، کسب‌وکار)", "english": "Variable (freelance, business)", "score": 4 },
    { "id": "inc_uncertain", "text": "نامشخص یا بی‌کار", "english": "Uncertain or unemployed", "score": 1 }
  ]
}
```

### Q3: Emergency Buffer [KEEP - Enhanced]
```json
{
  "id": "q_buffer",
  "text": "بدون این پول، چند ماه می‌تونی خرج زندگیت رو بدی؟",
  "english": "Without this money, how many months can you cover expenses?",
  "dimension": "capacity",
  "options": [
    { "id": "buf_12plus", "text": "بیش از ۱۲ ماه", "english": "More than 12 months", "score": 10 },
    { "id": "buf_6_12", "text": "۶ تا ۱۲ ماه", "english": "6 to 12 months", "score": 7 },
    { "id": "buf_3_6", "text": "۳ تا ۶ ماه", "english": "3 to 6 months", "score": 4 },
    { "id": "buf_under3", "text": "کمتر از ۳ ماه", "english": "Less than 3 months", "score": 1 }
  ]
}
```

### Q4: Portfolio Proportion [NEW]
**Purpose:** Critical capacity limiter — how much of wealth is this?

```json
{
  "id": "q_proportion",
  "text": "این پول چند درصد از کل دارایی‌هاته؟",
  "english": "What percentage of your total wealth is this?",
  "dimension": "capacity",
  "options": [
    { "id": "prop_small", "text": "کمتر از ۲۵٪", "english": "Less than 25%", "score": 10 },
    { "id": "prop_medium", "text": "۲۵٪ تا ۵۰٪", "english": "25% to 50%", "score": 6 },
    { "id": "prop_large", "text": "۵۰٪ تا ۷۵٪", "english": "50% to 75%", "score": 3 },
    { "id": "prop_most", "text": "بیشتر از ۷۵٪", "english": "More than 75%", "score": 1 }
  ]
}
```

---

## BLOCK B: Goals & Timeline

### Q5: Investment Goal [NEW]
**Purpose:** Anchor allocation strategy

```json
{
  "id": "q_goal",
  "text": "هدف اصلیت از این سرمایه‌گذاری چیه؟",
  "english": "What's your main goal for this investment?",
  "dimension": "goal",
  "options": [
    { "id": "goal_preserve", "text": "حفظ ارزش پول در برابر تورم", "english": "Preserve value against inflation", "score": 2 },
    { "id": "goal_income", "text": "درآمد ثابت (سود منظم)", "english": "Steady income (regular returns)", "score": 4 },
    { "id": "goal_grow", "text": "رشد سرمایه در بلندمدت", "english": "Long-term wealth growth", "score": 7 },
    { "id": "goal_maximize", "text": "حداکثر بازدهی (ریسک بالا قبوله)", "english": "Maximum returns (high risk OK)", "score": 10 }
  ]
}
```

### Q6: Time Horizon [KEEP - Enhanced]
```json
{
  "id": "q_horizon",
  "text": "کِی ممکنه بخوای این پول رو برداری؟",
  "english": "When might you need to withdraw this money?",
  "dimension": "horizon",
  "options": [
    { "id": "hz_1year", "text": "کمتر از ۱ سال", "english": "Less than 1 year", "score": 1, "hard_cap": 3 },
    { "id": "hz_1_3", "text": "۱ تا ۳ سال", "english": "1 to 3 years", "score": 4 },
    { "id": "hz_3_7", "text": "۳ تا ۷ سال", "english": "3 to 7 years", "score": 7 },
    { "id": "hz_7plus", "text": "بیش از ۷ سال", "english": "More than 7 years", "score": 10 }
  ]
}
```

---

## BLOCK C: Behavioral Scenarios (MOST IMPORTANT)

### Q7: Crash Scenario [NEW - CRITICAL]
**Purpose:** Direct measure of panic tendency

```json
{
  "id": "q_crash_20",
  "text": "فرض کن ۳ ماه بعد از سرمایه‌گذاری، ارزش پورتفوت ۲۰٪ کم شده. چیکار می‌کنی؟",
  "english": "Imagine 3 months after investing, your portfolio is down 20%. What do you do?",
  "dimension": "willingness",
  "weight": 2.0,
  "options": [
    { "id": "crash_sell_all", "text": "همه رو می‌فروشم که بیشتر ضرر نکنم", "english": "Sell everything to avoid more loss", "score": 1, "flag": "panic_seller" },
    { "id": "crash_sell_some", "text": "یه مقدار می‌فروشم، بقیه رو نگه می‌دارم", "english": "Sell some, keep the rest", "score": 3 },
    { "id": "crash_hold", "text": "صبر می‌کنم تا بازار برگرده", "english": "Wait for the market to recover", "score": 6 },
    { "id": "crash_buy", "text": "بیشتر می‌خرم چون ارزون شده", "english": "Buy more because it's cheaper", "score": 9, "flag": "check_capacity" }
  ]
}
```

### Q8: Risk-Return Tradeoff [NEW - CRITICAL]
**Purpose:** Revealed preference, not stated belief

```json
{
  "id": "q_tradeoff",
  "text": "کدوم رو ترجیح میدی؟",
  "english": "Which do you prefer?",
  "dimension": "willingness",
  "weight": 1.5,
  "options": [
    { "id": "trade_safe", "text": "سود تضمینی ۲۰٪ در سال", "english": "Guaranteed 20% annual return", "score": 2 },
    { "id": "trade_moderate", "text": "۵۰٪ شانس سود ۴۰٪ یا ضرر ۱۰٪", "english": "50% chance of +40% or -10%", "score": 5 },
    { "id": "trade_risky", "text": "۵۰٪ شانس سود ۸۰٪ یا ضرر ۲۵٪", "english": "50% chance of +80% or -25%", "score": 8 },
    { "id": "trade_yolo", "text": "۵۰٪ شانس سود ۱۵۰٪ یا ضرر ۵۰٪", "english": "50% chance of +150% or -50%", "score": 10, "flag": "gambler" }
  ]
}
```

### Q9: Past Behavior [KEEP - Enhanced]
```json
{
  "id": "q_past_behavior",
  "text": "آخرین باری که یه سرمایه‌گذاریت افت کرد، چه حسی داشتی؟",
  "english": "Last time an investment dropped, how did you feel?",
  "dimension": "willingness",
  "options": [
    { "id": "past_panic", "text": "خیلی استرس داشتم، شب‌ها خوابم نمی‌برد", "english": "Very stressed, couldn't sleep", "score": 1 },
    { "id": "past_worried", "text": "نگران بودم ولی دووم آوردم", "english": "Worried but managed", "score": 4 },
    { "id": "past_calm", "text": "نسبتاً آروم بودم", "english": "Relatively calm", "score": 7 },
    { "id": "past_none", "text": "تجربه‌ای ندارم", "english": "No experience", "score": 5, "flag": "inexperienced" }
  ]
}
```

### Q10: Maximum Loss Tolerance [NEW]
**Purpose:** Explicit downside anchor

```json
{
  "id": "q_max_loss",
  "text": "حداکثر چند درصد افت رو می‌تونی تحمل کنی بدون اینکه بفروشی؟",
  "english": "What's the maximum drop you can tolerate without selling?",
  "dimension": "willingness",
  "weight": 1.5,
  "options": [
    { "id": "loss_5", "text": "۵٪ — بیشتر از این نه", "english": "5% — no more than this", "score": 1 },
    { "id": "loss_15", "text": "۱۵٪ — یه کم درد داره ولی اوکیه", "english": "15% — hurts but OK", "score": 4 },
    { "id": "loss_30", "text": "۳۰٪ — سخته ولی صبر می‌کنم", "english": "30% — tough but I'll wait", "score": 7 },
    { "id": "loss_50", "text": "۵۰٪ یا بیشتر — بلندمدت فکر می‌کنم", "english": "50%+ — I think long-term", "score": 10, "flag": "check_capacity" }
  ]
}
```

---

## BLOCK D: Self-Check & Consistency

### Q11: Self-Assessment [LOW WEIGHT]
**Purpose:** Sanity check against calculated score

```json
{
  "id": "q_self_assess",
  "text": "خودت رو چطور توصیف می‌کنی؟",
  "english": "How would you describe yourself?",
  "dimension": "check",
  "weight": 0.5,
  "options": [
    { "id": "self_conservative", "text": "محتاط — امنیت مهم‌تره", "english": "Conservative — safety first", "score": 2 },
    { "id": "self_balanced", "text": "متعادل — یه کم ریسک اوکیه", "english": "Balanced — some risk is OK", "score": 5 },
    { "id": "self_growth", "text": "رشدگرا — آماده‌ی نوسانم", "english": "Growth-oriented — ready for swings", "score": 8 },
    { "id": "self_aggressive", "text": "جسور — میخوام حداکثر سود ببرم", "english": "Aggressive — want maximum gains", "score": 10 }
  ]
}
```

### Q12: Consistency Check [NEW - CRITICAL]
**Purpose:** Detect inconsistency between stated and revealed preference

```json
{
  "id": "q_double_check",
  "text": "اگه فردا خبر بد اقتصادی بیاد و بازار ۱۵٪ بریزه، اولین کارت چیه؟",
  "english": "If bad economic news drops the market 15% tomorrow, what's your first move?",
  "dimension": "consistency",
  "options": [
    { "id": "dc_exit", "text": "سریع می‌فروشم قبل از اینکه بدتر بشه", "english": "Sell quickly before it gets worse", "score": 1 },
    { "id": "dc_wait", "text": "صبر می‌کنم ببینم چی میشه", "english": "Wait and see what happens", "score": 5 },
    { "id": "dc_ignore", "text": "کاری نمی‌کنم، نگاهش هم نمی‌کنم", "english": "Do nothing, won't even look", "score": 7 },
    { "id": "dc_buy", "text": "فرصته، بیشتر می‌خرم", "english": "It's an opportunity, I'll buy more", "score": 9 }
  ]
}
```

---

## Step 4: Scoring Algorithm

### 4.1 Calculate Sub-Scores

```javascript
function calculateScores(answers) {
  // Capacity Score (C): Financial ability to take risk
  const capacityQuestions = ['q_life_stage', 'q_income', 'q_buffer', 'q_proportion'];
  const C = weightedAverage(answers, capacityQuestions);
  
  // Willingness Score (W): Psychological tolerance
  const willingnessQuestions = ['q_crash_20', 'q_tradeoff', 'q_past_behavior', 'q_max_loss'];
  const W = weightedAverage(answers, willingnessQuestions);
  
  // Horizon Score (H)
  const H = answers['q_horizon'].score;
  
  // Goal Score (G)
  const G = answers['q_goal'].score;
  
  return { C, W, H, G };
}
```

### 4.2 Apply Consistency Check

```javascript
function checkConsistency(answers) {
  const penalties = [];
  
  // Q7 (crash) vs Q12 (double check) — should be similar
  const crashScore = answers['q_crash_20'].score;
  const doubleCheckScore = answers['q_double_check'].score;
  const drift = Math.abs(crashScore - doubleCheckScore);
  
  if (drift > 5) {
    penalties.push({
      type: 'inconsistent_panic',
      amount: -2,
      message: 'Inconsistent responses to crash scenarios'
    });
  }
  
  // Self-assessment vs calculated — big gap = override needed
  const selfScore = answers['q_self_assess'].score;
  const calculatedW = calculateWillingness(answers);
  
  if (selfScore > calculatedW + 4) {
    penalties.push({
      type: 'overconfident',
      amount: -1,
      message: 'Self-assessment exceeds behavioral indicators'
    });
  }
  
  return penalties;
}
```

### 4.3 Detect Pathological Users

```javascript
function detectPathologicalUser(answers, flags) {
  const warnings = [];
  
  // THE PANIC SELLER
  if (flags.includes('panic_seller')) {
    warnings.push({
      type: 'panic_seller',
      action: 'hard_cap_3',
      message: 'User indicates panic selling tendency'
    });
  }
  
  // THE GAMBLER
  if (flags.includes('gambler') && answers['q_proportion'].id === 'prop_most') {
    warnings.push({
      type: 'gambler_high_stakes',
      action: 'hard_cap_5',
      message: 'High-risk preference with high portfolio proportion'
    });
  }
  
  // THE LIAR
  const claimed = answers['q_self_assess'].score;
  const revealed = weightedAverage(['q_crash_20', 'q_tradeoff', 'q_max_loss']);
  if (claimed >= 8 && revealed <= 4) {
    warnings.push({
      type: 'likely_liar',
      action: 'use_revealed',
      message: 'Claims aggressive but reveals conservative'
    });
  }
  
  // INEXPERIENCED + HIGH RISK
  if (flags.includes('inexperienced') && flags.includes('check_capacity')) {
    warnings.push({
      type: 'inexperienced_overreach',
      action: 'cap_and_educate',
      message: 'No experience but wants high risk'
    });
  }
  
  return warnings;
}
```

### 4.4 Calculate Final Risk Score

```javascript
function calculateFinalRisk(answers) {
  const { C, W, H, G } = calculateScores(answers);
  const penalties = checkConsistency(answers);
  const warnings = detectPathologicalUser(answers, collectFlags(answers));
  
  // CONSERVATIVE DOMINANCE RULE
  // Final = min(Capacity, Willingness)
  let rawScore = Math.min(C, W);
  
  // Apply horizon modifier
  // Short horizon caps risk regardless of preference
  const horizonCap = answers['q_horizon'].hard_cap;
  if (horizonCap) {
    rawScore = Math.min(rawScore, horizonCap);
  }
  
  // Apply penalties
  const penaltyTotal = penalties.reduce((sum, p) => sum + p.amount, 0);
  rawScore += penaltyTotal;
  
  // Apply hard caps from pathological detection
  for (const warning of warnings) {
    if (warning.action.startsWith('hard_cap_')) {
      const cap = parseInt(warning.action.split('_')[2]);
      rawScore = Math.min(rawScore, cap);
    }
  }
  
  // Clamp to valid range
  const finalScore = Math.max(1, Math.min(10, Math.round(rawScore)));
  
  return {
    score: finalScore,
    capacity: C,
    willingness: W,
    horizon: H,
    goal: G,
    penalties,
    warnings,
    limitingFactor: C < W ? 'capacity' : 'willingness'
  };
}
```

---

## Step 5: Map Score to Blu Markets Layers

### 5.1 Score to Profile Mapping

| Score | Profile | Foundation | Growth | Upside |
|-------|---------|------------|--------|--------|
| 1-2 | Capital Preservation | 80% | 15% | 5% |
| 3-4 | Conservative | 65% | 30% | 5% |
| 5-6 | Balanced | 50% | 35% | 15% |
| 7-8 | Growth | 40% | 40% | 20% |
| 9-10 | Aggressive | 30% | 40% | 30% |

### 5.2 Layer Allocation Function

```javascript
function scoreToAllocation(score) {
  const allocations = {
    1: { FOUNDATION: 85, GROWTH: 12, UPSIDE: 3 },
    2: { FOUNDATION: 80, GROWTH: 15, UPSIDE: 5 },
    3: { FOUNDATION: 70, GROWTH: 25, UPSIDE: 5 },
    4: { FOUNDATION: 65, GROWTH: 30, UPSIDE: 5 },
    5: { FOUNDATION: 55, GROWTH: 35, UPSIDE: 10 },
    6: { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 },
    7: { FOUNDATION: 45, GROWTH: 38, UPSIDE: 17 },
    8: { FOUNDATION: 40, GROWTH: 40, UPSIDE: 20 },
    9: { FOUNDATION: 35, GROWTH: 40, UPSIDE: 25 },
    10: { FOUNDATION: 30, GROWTH: 40, UPSIDE: 30 },
  };
  
  return allocations[score] || allocations[5];
}
```

---

## Step 6: UX Flow Design

### 6.1 Screen Sequence

```
[1] Welcome → "Let's understand your situation"
[2] Block A (4 questions) → Financial Reality
[3] Block B (2 questions) → Goals & Timeline  
[4] Block C (4 questions) → "How you react matters most"
[5] Block D (2 questions) → Quick confirmation
[6] Processing → "Calculating your profile..."
[7] Result → Show allocation + explanation
[8] Consent → Persian consent sentence
[9] Amount → "How much to start with?"
```

### 6.2 Progress Indicator

```
Step 1 of 4: Your Situation      ████░░░░░░░░ 33%
Step 2 of 4: Your Goals          ████████░░░░ 50%
Step 3 of 4: Your Reactions      ████████████ 83%
Step 4 of 4: Confirm             ████████████ 100%
```

### 6.3 Result Screen Copy

**For Conservative (Score 3-4):**
```
Your Profile: Conservative

Based on your answers, we recommend a safety-first approach.
Your portfolio will focus on stability with modest growth.

Foundation: 65% — Stable assets that protect during drops
Growth: 30% — Balanced assets for steady appreciation  
Upside: 5% — Small exposure to higher-growth opportunities

This allocation is designed to help you sleep at night
while still beating inflation.
```

**For Balanced (Score 5-6):**
```
Your Profile: Balanced

You're comfortable with some ups and downs in exchange
for better long-term growth.

Foundation: 50% — Your safety net
Growth: 35% — Your wealth builder
Upside: 15% — Your opportunity for bigger gains

Expect occasional dips of 15-20%. History shows patience
pays off.
```

**For Growth (Score 7-8):**
```
Your Profile: Growth

You understand that volatility is the price of higher returns.
Your portfolio will lean into growth opportunities.

Foundation: 40% — Still protected
Growth: 40% — Strong wealth building
Upside: 20% — Real exposure to high-growth assets

Be prepared for 25-30% drops. They're normal.
Don't panic. Don't sell.
```

---

## Step 7: Implementation Checklist

### 7.1 Data Model

- [ ] Create `questionnaire.v2.fa.json` with new questions
- [ ] Add scoring weights to each question
- [ ] Add flags for pathological detection
- [ ] Add hard_cap field for horizon limits

### 7.2 Scoring Engine

- [ ] Create `src/engine/riskScoring.js`
- [ ] Implement `calculateScores()`
- [ ] Implement `checkConsistency()`
- [ ] Implement `detectPathologicalUser()`
- [ ] Implement `calculateFinalRisk()`
- [ ] Implement `scoreToAllocation()`

### 7.3 UI Components

- [ ] Update `OnboardingControls.jsx` for new flow
- [ ] Create progress indicator component
- [ ] Update result screen with profile explanation
- [ ] Add warning display for pathological users

### 7.4 Testing

- [ ] Test Panic Seller path → should get score ≤ 3
- [ ] Test Gambler path → should get capped
- [ ] Test Liar path → revealed score used
- [ ] Test Inconsistent path → penalty applied
- [ ] Test all edge cases

---

## Step 8: Future Enhancements (v10+)

1. **Re-assessment triggers**
   - After 6 months
   - After major life event
   - After market crash

2. **Dynamic risk adjustment**
   - User behavior during first crash → adjust profile
   - Panic selling detected → auto de-risk

3. **Iran-specific questions**
   - Currency preference (IRR vs USD-pegged)
   - Gold affinity level
   - Sanctions awareness

4. **A/B testing**
   - Question order optimization
   - Wording variations
   - Visual vs text scenarios

---

## Summary

| Aspect | Current | New |
|--------|---------|-----|
| Questions | 8 | 12 |
| Dimensions | 2 (implicit) | 4 (explicit) |
| Crash scenario | ❌ None | ✅ Two questions |
| Risk-return tradeoff | ❌ None | ✅ Explicit |
| Consistency check | ❌ None | ✅ Built-in |
| Pathological detection | ❌ None | ✅ 4 types |
| Scoring | Simple sum | Multi-factor + penalties |
| Output | 3 profiles | 10 granular levels |

**Estimated Implementation Time:** 6-8 hours

---

## Next Step

Create the Claude Code spec with:
1. New `questionnaire.v2.fa.json`
2. `riskScoring.js` engine
3. Updated UI components
4. Test cases

Ready to proceed?
