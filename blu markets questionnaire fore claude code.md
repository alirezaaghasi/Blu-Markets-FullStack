# Blu Markets v10 — Questionnaire System Implementation
## Claude Code Implementation Specification

---

## Overview

This spec implements the new 12-question risk profiling system with:
- Multi-dimensional scoring (Capacity, Willingness, Horizon, Goal)
- Pathological user detection (Panic Seller, Gambler, Liar, Inexperienced)
- Consistency checking with penalties
- Conservative dominance rule
- 10-level granular scoring → 5 named profiles

**Estimated Time:** 4-5 hours

---

## Files to Create

```
src/
├── data/
│   └── questionnaire.v2.fa.json     # New 12-question data
├── engine/
│   └── riskScoring.js               # Scoring algorithm
└── components/
    └── ProfileResult.jsx            # Result screen component
```

## Files to Modify

```
src/
├── components/
│   └── OnboardingControls.jsx       # Updated flow
├── engine/
│   └── domain.js                    # Add profile descriptions
└── App.jsx                          # Import new questionnaire
```

---

## Step 1: Create questionnaire.v2.fa.json

Create `/src/data/questionnaire.v2.fa.json`:

```json
{
  "version": "v10.0",
  "consent_exact": "متوجه ریسک این سبد دارایی شدم و باهاش موافق هستم.",
  "consent_english": "I understand the risk of this portfolio and I agree with it.",
  "blocks": [
    {
      "id": "block_capacity",
      "title": "Your Financial Situation",
      "title_fa": "وضعیت مالی شما",
      "questions": ["q_life_stage", "q_income", "q_buffer", "q_proportion"]
    },
    {
      "id": "block_goals",
      "title": "Your Goals",
      "title_fa": "اهداف شما",
      "questions": ["q_goal", "q_horizon"]
    },
    {
      "id": "block_behavior",
      "title": "How You React",
      "title_fa": "واکنش شما",
      "questions": ["q_crash_20", "q_tradeoff", "q_past_behavior", "q_max_loss"]
    },
    {
      "id": "block_confirm",
      "title": "Quick Confirmation",
      "title_fa": "تأیید نهایی",
      "questions": ["q_self_assess", "q_double_check"]
    }
  ],
  "questions": [
    {
      "id": "q_life_stage",
      "text": "الان تو چه مرحله‌ای از زندگیت هستی؟",
      "english": "What stage of life are you in?",
      "dimension": "capacity",
      "weight": 1.0,
      "options": [
        { "id": "stage_student", "text": "دانشجو یا تازه شروع کردم به کار", "english": "Student or just starting career", "score": 8 },
        { "id": "stage_building", "text": "دارم زندگیم رو می‌سازم (۲۵-۴۰)", "english": "Building my life (25-40)", "score": 7 },
        { "id": "stage_established", "text": "زندگیم جا افتاده (۴۰-۵۵)", "english": "Established (40-55)", "score": 5 },
        { "id": "stage_preretire", "text": "نزدیک بازنشستگی یا بازنشسته", "english": "Near or at retirement", "score": 2 }
      ]
    },
    {
      "id": "q_income",
      "text": "درآمدت چقدر قابل پیش‌بینیه؟",
      "english": "How predictable is your income?",
      "dimension": "capacity",
      "weight": 1.0,
      "options": [
        { "id": "inc_fixed", "text": "ثابت و مطمئن (حقوق، مستمری)", "english": "Fixed and reliable (salary, pension)", "score": 8 },
        { "id": "inc_mostly", "text": "تقریباً ثابت با کمی نوسان", "english": "Mostly stable with some variation", "score": 6 },
        { "id": "inc_variable", "text": "متغیر (فریلنس، کسب‌وکار)", "english": "Variable (freelance, business)", "score": 4 },
        { "id": "inc_uncertain", "text": "نامشخص یا بی‌کار", "english": "Uncertain or unemployed", "score": 1 }
      ]
    },
    {
      "id": "q_buffer",
      "text": "بدون این پول، چند ماه می‌تونی خرج زندگیت رو بدی؟",
      "english": "Without this money, how many months can you cover expenses?",
      "dimension": "capacity",
      "weight": 1.2,
      "options": [
        { "id": "buf_12plus", "text": "بیش از ۱۲ ماه", "english": "More than 12 months", "score": 10 },
        { "id": "buf_6_12", "text": "۶ تا ۱۲ ماه", "english": "6 to 12 months", "score": 7 },
        { "id": "buf_3_6", "text": "۳ تا ۶ ماه", "english": "3 to 6 months", "score": 4 },
        { "id": "buf_under3", "text": "کمتر از ۳ ماه", "english": "Less than 3 months", "score": 1 }
      ]
    },
    {
      "id": "q_proportion",
      "text": "این پول چند درصد از کل دارایی‌هاته؟",
      "english": "What percentage of your total wealth is this?",
      "dimension": "capacity",
      "weight": 1.3,
      "options": [
        { "id": "prop_small", "text": "کمتر از ۲۵٪", "english": "Less than 25%", "score": 10 },
        { "id": "prop_medium", "text": "۲۵٪ تا ۵۰٪", "english": "25% to 50%", "score": 6 },
        { "id": "prop_large", "text": "۵۰٪ تا ۷۵٪", "english": "50% to 75%", "score": 3 },
        { "id": "prop_most", "text": "بیشتر از ۷۵٪", "english": "More than 75%", "score": 1, "flag": "high_proportion" }
      ]
    },
    {
      "id": "q_goal",
      "text": "هدف اصلیت از این سرمایه‌گذاری چیه؟",
      "english": "What's your main goal for this investment?",
      "dimension": "goal",
      "weight": 1.0,
      "options": [
        { "id": "goal_preserve", "text": "حفظ ارزش پول در برابر تورم", "english": "Preserve value against inflation", "score": 2 },
        { "id": "goal_income", "text": "درآمد ثابت (سود منظم)", "english": "Steady income (regular returns)", "score": 4 },
        { "id": "goal_grow", "text": "رشد سرمایه در بلندمدت", "english": "Long-term wealth growth", "score": 7 },
        { "id": "goal_maximize", "text": "حداکثر بازدهی (ریسک بالا قبوله)", "english": "Maximum returns (high risk OK)", "score": 10 }
      ]
    },
    {
      "id": "q_horizon",
      "text": "کِی ممکنه بخوای این پول رو برداری؟",
      "english": "When might you need to withdraw this money?",
      "dimension": "horizon",
      "weight": 1.0,
      "hard_caps": {
        "hz_1year": 3,
        "hz_1_3": 5
      },
      "options": [
        { "id": "hz_1year", "text": "کمتر از ۱ سال", "english": "Less than 1 year", "score": 1 },
        { "id": "hz_1_3", "text": "۱ تا ۳ سال", "english": "1 to 3 years", "score": 4 },
        { "id": "hz_3_7", "text": "۳ تا ۷ سال", "english": "3 to 7 years", "score": 7 },
        { "id": "hz_7plus", "text": "بیش از ۷ سال", "english": "More than 7 years", "score": 10 }
      ]
    },
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
    },
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
    },
    {
      "id": "q_past_behavior",
      "text": "آخرین باری که یه سرمایه‌گذاریت افت کرد، چه حسی داشتی؟",
      "english": "Last time an investment dropped, how did you feel?",
      "dimension": "willingness",
      "weight": 1.0,
      "options": [
        { "id": "past_panic", "text": "خیلی استرس داشتم، شب‌ها خوابم نمی‌برد", "english": "Very stressed, couldn't sleep", "score": 1 },
        { "id": "past_worried", "text": "نگران بودم ولی دووم آوردم", "english": "Worried but managed", "score": 4 },
        { "id": "past_calm", "text": "نسبتاً آروم بودم", "english": "Relatively calm", "score": 7 },
        { "id": "past_none", "text": "تجربه‌ای ندارم", "english": "No experience", "score": 5, "flag": "inexperienced" }
      ]
    },
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
    },
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
    },
    {
      "id": "q_double_check",
      "text": "اگه فردا خبر بد اقتصادی بیاد و بازار ۱۵٪ بریزه، اولین کارت چیه؟",
      "english": "If bad economic news drops the market 15% tomorrow, what's your first move?",
      "dimension": "consistency",
      "weight": 1.0,
      "options": [
        { "id": "dc_exit", "text": "سریع می‌فروشم قبل از اینکه بدتر بشه", "english": "Sell quickly before it gets worse", "score": 1 },
        { "id": "dc_wait", "text": "صبر می‌کنم ببینم چی میشه", "english": "Wait and see what happens", "score": 5 },
        { "id": "dc_ignore", "text": "کاری نمی‌کنم، نگاهش هم نمی‌کنم", "english": "Do nothing, won't even look", "score": 7 },
        { "id": "dc_buy", "text": "فرصته، بیشتر می‌خرم", "english": "It's an opportunity, I'll buy more", "score": 9 }
      ]
    }
  ],
  "profiles": {
    "1": { "name": "Capital Preservation", "name_fa": "حفظ سرمایه" },
    "2": { "name": "Capital Preservation", "name_fa": "حفظ سرمایه" },
    "3": { "name": "Conservative", "name_fa": "محتاط" },
    "4": { "name": "Conservative", "name_fa": "محتاط" },
    "5": { "name": "Balanced", "name_fa": "متعادل" },
    "6": { "name": "Balanced", "name_fa": "متعادل" },
    "7": { "name": "Growth", "name_fa": "رشدگرا" },
    "8": { "name": "Growth", "name_fa": "رشدگرا" },
    "9": { "name": "Aggressive", "name_fa": "جسور" },
    "10": { "name": "Aggressive", "name_fa": "جسور" }
  },
  "allocations": {
    "1": { "FOUNDATION": 85, "GROWTH": 12, "UPSIDE": 3 },
    "2": { "FOUNDATION": 80, "GROWTH": 15, "UPSIDE": 5 },
    "3": { "FOUNDATION": 70, "GROWTH": 25, "UPSIDE": 5 },
    "4": { "FOUNDATION": 65, "GROWTH": 30, "UPSIDE": 5 },
    "5": { "FOUNDATION": 55, "GROWTH": 35, "UPSIDE": 10 },
    "6": { "FOUNDATION": 50, "GROWTH": 35, "UPSIDE": 15 },
    "7": { "FOUNDATION": 45, "GROWTH": 38, "UPSIDE": 17 },
    "8": { "FOUNDATION": 40, "GROWTH": 40, "UPSIDE": 20 },
    "9": { "FOUNDATION": 35, "GROWTH": 40, "UPSIDE": 25 },
    "10": { "FOUNDATION": 30, "GROWTH": 40, "UPSIDE": 30 }
  }
}
```

---

## Step 2: Create riskScoring.js

Create `/src/engine/riskScoring.js`:

```javascript
/**
 * Risk Scoring Engine for Blu Markets v10
 * 
 * Implements:
 * - Multi-dimensional scoring (Capacity, Willingness, Horizon, Goal)
 * - Conservative dominance rule: Final = min(Capacity, Willingness)
 * - Pathological user detection
 * - Consistency checking with penalties
 */

// Question IDs by dimension
const CAPACITY_QUESTIONS = ['q_life_stage', 'q_income', 'q_buffer', 'q_proportion'];
const WILLINGNESS_QUESTIONS = ['q_crash_20', 'q_tradeoff', 'q_past_behavior', 'q_max_loss'];
const HORIZON_QUESTION = 'q_horizon';
const GOAL_QUESTION = 'q_goal';
const SELF_ASSESS_QUESTION = 'q_self_assess';
const CONSISTENCY_QUESTION = 'q_double_check';
const CRASH_QUESTION = 'q_crash_20';

/**
 * Calculate weighted average score for a set of questions
 */
function weightedAverage(answers, questionIds, questionnaire) {
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const qId of questionIds) {
    const answer = answers[qId];
    if (!answer) continue;
    
    const question = questionnaire.questions.find(q => q.id === qId);
    const weight = question?.weight || 1.0;
    
    weightedSum += answer.score * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 5;
}

/**
 * Collect all flags from answers
 */
function collectFlags(answers) {
  const flags = [];
  
  for (const [qId, answer] of Object.entries(answers)) {
    if (answer.flag) {
      flags.push(answer.flag);
    }
  }
  
  return flags;
}

/**
 * Calculate sub-scores for each dimension
 */
export function calculateSubScores(answers, questionnaire) {
  // Capacity Score (C): Financial ability to take risk
  const C = weightedAverage(answers, CAPACITY_QUESTIONS, questionnaire);
  
  // Willingness Score (W): Psychological tolerance
  const W = weightedAverage(answers, WILLINGNESS_QUESTIONS, questionnaire);
  
  // Horizon Score (H)
  const H = answers[HORIZON_QUESTION]?.score || 5;
  
  // Goal Score (G)
  const G = answers[GOAL_QUESTION]?.score || 5;
  
  // Self Assessment (for consistency check)
  const selfAssess = answers[SELF_ASSESS_QUESTION]?.score || 5;
  
  return { C, W, H, G, selfAssess };
}

/**
 * Check for inconsistencies between answers
 */
export function checkConsistency(answers) {
  const penalties = [];
  
  // Q7 (crash) vs Q12 (double check) — should be similar
  const crashAnswer = answers[CRASH_QUESTION];
  const doubleCheckAnswer = answers[CONSISTENCY_QUESTION];
  
  if (crashAnswer && doubleCheckAnswer) {
    const drift = Math.abs(crashAnswer.score - doubleCheckAnswer.score);
    
    if (drift > 5) {
      penalties.push({
        type: 'inconsistent_panic',
        amount: -2,
        message: 'Inconsistent responses to crash scenarios'
      });
    } else if (drift > 3) {
      penalties.push({
        type: 'mild_inconsistency',
        amount: -1,
        message: 'Slightly inconsistent crash responses'
      });
    }
  }
  
  return penalties;
}

/**
 * Check for overconfidence (self-assessment vs revealed behavior)
 */
export function checkOverconfidence(answers, calculatedW) {
  const penalties = [];
  
  const selfScore = answers[SELF_ASSESS_QUESTION]?.score || 5;
  
  // If self-assessment is much higher than revealed behavior
  if (selfScore > calculatedW + 4) {
    penalties.push({
      type: 'overconfident',
      amount: -1,
      message: 'Self-assessment significantly exceeds behavioral indicators'
    });
  }
  
  return penalties;
}

/**
 * Detect pathological user patterns
 */
export function detectPathologicalUser(answers, flags, scores) {
  const warnings = [];
  
  // THE PANIC SELLER
  // Selects "sell everything" in crash scenario
  if (flags.includes('panic_seller')) {
    warnings.push({
      type: 'panic_seller',
      action: 'hard_cap_3',
      severity: 'high',
      message: 'User indicates panic selling tendency. Maximum risk: 3.'
    });
  }
  
  // THE GAMBLER
  // Selects highest-risk tradeoff + high proportion of wealth
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
  
  // THE LIAR
  // Claims aggressive but reveals conservative
  const selfScore = answers[SELF_ASSESS_QUESTION]?.score || 5;
  if (selfScore >= 8 && scores.W <= 4) {
    warnings.push({
      type: 'likely_liar',
      action: 'use_revealed',
      severity: 'medium',
      message: 'Claims aggressive but behavioral responses indicate conservative.'
    });
  }
  
  // INEXPERIENCED + HIGH RISK APPETITE
  if (flags.includes('inexperienced') && flags.includes('check_capacity')) {
    warnings.push({
      type: 'inexperienced_overreach',
      action: 'cap_and_educate',
      severity: 'medium',
      message: 'No market experience but desires high risk. Consider education.'
    });
  }
  
  // INEXPERIENCED + GAMBLER
  if (flags.includes('inexperienced') && flags.includes('gambler')) {
    warnings.push({
      type: 'dangerous_novice',
      action: 'hard_cap_5',
      severity: 'high',
      message: 'No experience + gambling tendency. Maximum risk: 5.'
    });
  }
  
  return warnings;
}

/**
 * Get horizon hard cap if applicable
 */
export function getHorizonCap(answers, questionnaire) {
  const horizonAnswer = answers[HORIZON_QUESTION];
  if (!horizonAnswer) return null;
  
  const horizonQuestion = questionnaire.questions.find(q => q.id === HORIZON_QUESTION);
  const hardCaps = horizonQuestion?.hard_caps || {};
  
  return hardCaps[horizonAnswer.id] || null;
}

/**
 * Main scoring function
 * Returns final risk score (1-10) with all metadata
 */
export function calculateFinalRisk(answers, questionnaire) {
  // Step 1: Calculate sub-scores
  const scores = calculateSubScores(answers, questionnaire);
  const { C, W, H, G, selfAssess } = scores;
  
  // Step 2: Collect flags
  const flags = collectFlags(answers);
  
  // Step 3: Check consistency
  const consistencyPenalties = checkConsistency(answers);
  
  // Step 4: Check overconfidence
  const overconfidencePenalties = checkOverconfidence(answers, W);
  
  // Step 5: Detect pathological users
  const warnings = detectPathologicalUser(answers, flags, scores);
  
  // Step 6: Apply CONSERVATIVE DOMINANCE RULE
  // Final = min(Capacity, Willingness)
  let rawScore = Math.min(C, W);
  
  // Determine limiting factor
  const limitingFactor = C < W ? 'capacity' : 'willingness';
  
  // Step 7: Apply horizon hard cap
  const horizonCap = getHorizonCap(answers, questionnaire);
  if (horizonCap !== null) {
    rawScore = Math.min(rawScore, horizonCap);
  }
  
  // Step 8: Apply consistency penalties
  const allPenalties = [...consistencyPenalties, ...overconfidencePenalties];
  const penaltyTotal = allPenalties.reduce((sum, p) => sum + p.amount, 0);
  rawScore += penaltyTotal;
  
  // Step 9: Apply hard caps from pathological detection
  for (const warning of warnings) {
    if (warning.action === 'hard_cap_3') {
      rawScore = Math.min(rawScore, 3);
    } else if (warning.action === 'hard_cap_5') {
      rawScore = Math.min(rawScore, 5);
    } else if (warning.action === 'cap_willingness_7') {
      // Recalculate with capped willingness
      const cappedW = Math.min(W, 7);
      rawScore = Math.min(rawScore, Math.min(C, cappedW));
    }
  }
  
  // Step 10: Clamp to valid range
  const finalScore = Math.max(1, Math.min(10, Math.round(rawScore)));
  
  // Step 11: Get profile and allocation
  const profile = questionnaire.profiles[String(finalScore)];
  const allocation = questionnaire.allocations[String(finalScore)];
  
  return {
    score: finalScore,
    profile: profile.name,
    profile_fa: profile.name_fa,
    allocation,
    
    // Detailed breakdown
    capacity: Math.round(C * 10) / 10,
    willingness: Math.round(W * 10) / 10,
    horizon: H,
    goal: G,
    selfAssessment: selfAssess,
    
    // Adjustments
    limitingFactor,
    horizonCap,
    penalties: allPenalties,
    warnings,
    flags,
    
    // Metadata
    rawScoreBeforeAdjustments: Math.min(C, W),
    totalPenalty: penaltyTotal
  };
}

/**
 * Get profile description for result screen
 */
export function getProfileDescription(score, allocation) {
  const descriptions = {
    'Capital Preservation': {
      headline: 'Safety is your priority',
      body: 'Your portfolio focuses on protecting your capital with minimal volatility. Expect steady, modest returns.',
      expectation: 'Typical range: -5% to +15% annually'
    },
    'Conservative': {
      headline: 'Stability with modest growth',
      body: 'Your portfolio balances safety with some growth potential. You can handle small dips for better returns.',
      expectation: 'Typical range: -10% to +20% annually'
    },
    'Balanced': {
      headline: 'Growth with protection',
      body: 'Your portfolio seeks meaningful growth while maintaining a safety net. Expect some ups and downs.',
      expectation: 'Typical range: -20% to +30% annually'
    },
    'Growth': {
      headline: 'Long-term wealth building',
      body: 'Your portfolio prioritizes growth over stability. You understand volatility is the price of higher returns.',
      expectation: 'Typical range: -30% to +50% annually'
    },
    'Aggressive': {
      headline: 'Maximum growth potential',
      body: 'Your portfolio is optimized for maximum returns. Significant volatility is expected and accepted.',
      expectation: 'Typical range: -40% to +80% annually'
    }
  };
  
  const profileName = getProfileNameFromScore(score);
  return descriptions[profileName] || descriptions['Balanced'];
}

/**
 * Helper to get profile name from score
 */
function getProfileNameFromScore(score) {
  if (score <= 2) return 'Capital Preservation';
  if (score <= 4) return 'Conservative';
  if (score <= 6) return 'Balanced';
  if (score <= 8) return 'Growth';
  return 'Aggressive';
}

/**
 * Convert answers array to answers object
 * (for compatibility with existing questionnaire flow)
 */
export function answersArrayToObject(answersArray, questionnaire) {
  const answersObj = {};
  
  questionnaire.questions.forEach((question, index) => {
    if (answersArray[index] !== undefined && answersArray[index] !== null) {
      const selectedOption = question.options[answersArray[index]];
      if (selectedOption) {
        answersObj[question.id] = {
          questionId: question.id,
          optionId: selectedOption.id,
          optionIndex: answersArray[index],
          score: selectedOption.score,
          flag: selectedOption.flag || null
        };
      }
    }
  });
  
  return answersObj;
}

export default {
  calculateSubScores,
  checkConsistency,
  checkOverconfidence,
  detectPathologicalUser,
  getHorizonCap,
  calculateFinalRisk,
  getProfileDescription,
  answersArrayToObject
};
```

---

## Step 3: Create ProfileResult.jsx

Create `/src/components/ProfileResult.jsx`:

```jsx
import React from 'react';
import { getProfileDescription } from '../engine/riskScoring';

/**
 * ProfileResult - Displays risk profile result after questionnaire
 */
function ProfileResult({ result, onContinue }) {
  const { 
    score, 
    profile, 
    allocation, 
    capacity, 
    willingness, 
    limitingFactor,
    warnings 
  } = result;
  
  const description = getProfileDescription(score, allocation);
  
  // Determine if we need to show any warnings
  const hasHighSeverityWarning = warnings.some(w => w.severity === 'high');
  
  return (
    <div className="profile-result">
      {/* Profile Badge */}
      <div className="profile-badge">
        <div className="profile-score">{score}</div>
        <div className="profile-name">{profile}</div>
      </div>
      
      {/* Description */}
      <div className="profile-description">
        <h3>{description.headline}</h3>
        <p>{description.body}</p>
        <p className="expectation">{description.expectation}</p>
      </div>
      
      {/* Allocation Preview */}
      <div className="allocation-preview">
        <h4>Your Allocation</h4>
        <div className="allocation-bars">
          <div className="allocation-row">
            <span className="layer-dot foundation">●</span>
            <span className="layer-name">Foundation</span>
            <span className="layer-percent">{allocation.FOUNDATION}%</span>
            <div className="layer-bar">
              <div 
                className="layer-fill foundation" 
                style={{ width: `${allocation.FOUNDATION}%` }}
              />
            </div>
          </div>
          <div className="allocation-row">
            <span className="layer-dot growth">●</span>
            <span className="layer-name">Growth</span>
            <span className="layer-percent">{allocation.GROWTH}%</span>
            <div className="layer-bar">
              <div 
                className="layer-fill growth" 
                style={{ width: `${allocation.GROWTH}%` }}
              />
            </div>
          </div>
          <div className="allocation-row">
            <span className="layer-dot upside">●</span>
            <span className="layer-name">Upside</span>
            <span className="layer-percent">{allocation.UPSIDE}%</span>
            <div className="layer-bar">
              <div 
                className="layer-fill upside" 
                style={{ width: `${allocation.UPSIDE}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Limiting Factor Explanation */}
      <div className="limiting-factor">
        <p className="factor-label">
          {limitingFactor === 'capacity' 
            ? 'Your financial situation suggests a more cautious approach.'
            : 'Your comfort with volatility shaped this recommendation.'}
        </p>
      </div>
      
      {/* Warning (if applicable) */}
      {hasHighSeverityWarning && (
        <div className="profile-warning">
          <span className="warning-icon">⚠️</span>
          <p>
            Based on your answers, we've adjusted your profile to better protect 
            your investment during market volatility.
          </p>
        </div>
      )}
      
      {/* Continue Button */}
      <button className="continue-btn" onClick={onContinue}>
        Continue with this profile
      </button>
    </div>
  );
}

export default React.memo(ProfileResult);
```

---

## Step 4: Add CSS for ProfileResult

Add to `/src/index.css`:

```css
/* =============================================
   PROFILE RESULT STYLES
   ============================================= */

.profile-result {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px 16px;
  max-width: 400px;
  margin: 0 auto;
}

/* Profile Badge */
.profile-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.profile-score {
  font-size: 48px;
  font-weight: 700;
  color: #4ade80;
  line-height: 1;
}

.profile-name {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Description */
.profile-description {
  text-align: center;
}

.profile-description h3 {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 8px;
}

.profile-description p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
}

.profile-description .expectation {
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

/* Allocation Preview */
.allocation-preview {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 16px;
}

.allocation-preview h4 {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.allocation-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.allocation-row {
  display: grid;
  grid-template-columns: 20px 80px 40px 1fr;
  align-items: center;
  gap: 8px;
}

.layer-dot {
  font-size: 12px;
}

.layer-dot.foundation { color: #3b82f6; }
.layer-dot.growth { color: #f59e0b; }
.layer-dot.upside { color: #8b5cf6; }

.layer-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.layer-percent {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  text-align: right;
}

.layer-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.layer-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.layer-fill.foundation { background: #3b82f6; }
.layer-fill.growth { background: #f59e0b; }
.layer-fill.upside { background: #8b5cf6; }

/* Limiting Factor */
.limiting-factor {
  text-align: center;
  padding: 12px;
  background: rgba(74, 222, 128, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(74, 222, 128, 0.2);
}

.limiting-factor .factor-label {
  font-size: 13px;
  color: rgba(74, 222, 128, 0.9);
  margin: 0;
}

/* Warning */
.profile-warning {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(251, 191, 36, 0.2);
}

.profile-warning .warning-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.profile-warning p {
  font-size: 13px;
  color: rgba(251, 191, 36, 0.9);
  margin: 0;
  line-height: 1.4;
}

/* Continue Button */
.profile-result .continue-btn {
  width: 100%;
  padding: 16px;
  background: #4ade80;
  color: #000;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.profile-result .continue-btn:hover {
  background: #22c55e;
}

/* =============================================
   QUESTIONNAIRE PROGRESS INDICATOR
   ============================================= */

.questionnaire-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.progress-bar-container {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #4ade80;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.block-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  margin-bottom: 8px;
}
```

---

## Step 5: Update OnboardingControls.jsx

Modify `/src/components/OnboardingControls.jsx` to use new questionnaire and scoring:

```jsx
// Add imports at top
import questionnaireV2 from '../data/questionnaire.v2.fa.json';
import { calculateFinalRisk, answersArrayToObject } from '../engine/riskScoring';
import ProfileResult from './ProfileResult';

// Inside OnboardingControls component, update the questionnaire processing:

// Replace the existing scoreToAllocation logic with:
function computeProfileFromAnswers(answers) {
  // Convert answers array to object format
  const answersObj = answersArrayToObject(answers, questionnaireV2);
  
  // Calculate final risk using new scoring engine
  const result = calculateFinalRisk(answersObj, questionnaireV2);
  
  return result;
}

// Add state for showing profile result
const [profileResult, setProfileResult] = useState(null);
const [showProfileResult, setShowProfileResult] = useState(false);

// When questionnaire is complete, show profile result before consent
function handleQuestionnaireComplete() {
  const result = computeProfileFromAnswers(answers);
  setProfileResult(result);
  setShowProfileResult(true);
}

// When user accepts profile, move to consent
function handleProfileAccepted() {
  setShowProfileResult(false);
  // Continue to consent screen with result.allocation
  dispatch({ 
    type: 'SET_TARGET', 
    payload: profileResult.allocation 
  });
  setStage('consent');
}

// Add progress indicator component
function QuestionnaireProgress({ currentQuestion, totalQuestions, blockTitle }) {
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;
  
  return (
    <div className="questionnaire-progress">
      <div className="block-title">{blockTitle}</div>
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${progress}%` }} 
        />
      </div>
      <div className="progress-label">
        <span>Question {currentQuestion + 1} of {totalQuestions}</span>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

// Get current block title based on question index
function getCurrentBlockTitle(questionIndex) {
  let count = 0;
  for (const block of questionnaireV2.blocks) {
    count += block.questions.length;
    if (questionIndex < count) {
      return block.title;
    }
  }
  return '';
}

// In render, add profile result screen:
{showProfileResult && profileResult && (
  <ProfileResult 
    result={profileResult}
    onContinue={handleProfileAccepted}
  />
)}
```

---

## Step 6: Update domain.js

Add profile descriptions to `/src/engine/domain.js`:

```javascript
// Add after LAYER_META

export const RISK_PROFILES = {
  1: { 
    name: 'Capital Preservation', 
    description: 'Maximum safety, minimal volatility',
    maxDrawdown: '5%'
  },
  2: { 
    name: 'Capital Preservation', 
    description: 'Maximum safety, minimal volatility',
    maxDrawdown: '5%'
  },
  3: { 
    name: 'Conservative', 
    description: 'Stability with modest growth',
    maxDrawdown: '10%'
  },
  4: { 
    name: 'Conservative', 
    description: 'Stability with modest growth',
    maxDrawdown: '10%'
  },
  5: { 
    name: 'Balanced', 
    description: 'Growth with protection',
    maxDrawdown: '20%'
  },
  6: { 
    name: 'Balanced', 
    description: 'Growth with protection',
    maxDrawdown: '20%'
  },
  7: { 
    name: 'Growth', 
    description: 'Long-term wealth building',
    maxDrawdown: '30%'
  },
  8: { 
    name: 'Growth', 
    description: 'Long-term wealth building',
    maxDrawdown: '30%'
  },
  9: { 
    name: 'Aggressive', 
    description: 'Maximum growth potential',
    maxDrawdown: '40%'
  },
  10: { 
    name: 'Aggressive', 
    description: 'Maximum growth potential',
    maxDrawdown: '40%'
  }
};
```

---

## Step 7: Testing Scenarios

Create test cases in `/src/engine/riskScoring.test.js`:

```javascript
import { calculateFinalRisk, answersArrayToObject } from './riskScoring';
import questionnaire from '../data/questionnaire.v2.fa.json';

describe('Risk Scoring Engine', () => {
  
  // Helper to create answer object
  const createAnswers = (selections) => {
    const answers = {};
    questionnaire.questions.forEach((q, i) => {
      if (selections[i] !== undefined) {
        const option = q.options[selections[i]];
        answers[q.id] = {
          questionId: q.id,
          optionId: option.id,
          optionIndex: selections[i],
          score: option.score,
          flag: option.flag || null
        };
      }
    });
    return answers;
  };
  
  test('Panic Seller gets capped at 3', () => {
    // User selects "sell everything" in crash scenario
    const answers = createAnswers([
      1, // stage_building (7)
      0, // inc_fixed (8)
      0, // buf_12plus (10)
      0, // prop_small (10)
      2, // goal_grow (7)
      3, // hz_7plus (10)
      0, // crash_sell_all (1) - PANIC FLAG
      1, // trade_moderate (5)
      1, // past_worried (4)
      1, // loss_15 (4)
      2, // self_growth (8)
      1  // dc_wait (5)
    ]);
    
    const result = calculateFinalRisk(answers, questionnaire);
    
    expect(result.score).toBeLessThanOrEqual(3);
    expect(result.warnings.some(w => w.type === 'panic_seller')).toBe(true);
  });
  
  test('Gambler with high stakes gets capped at 5', () => {
    // User selects highest risk + most of wealth
    const answers = createAnswers([
      0, // stage_student (8)
      0, // inc_fixed (8)
      0, // buf_12plus (10)
      3, // prop_most (1) - HIGH PROPORTION FLAG
      3, // goal_maximize (10)
      3, // hz_7plus (10)
      3, // crash_buy (9)
      3, // trade_yolo (10) - GAMBLER FLAG
      2, // past_calm (7)
      3, // loss_50 (10)
      3, // self_aggressive (10)
      3  // dc_buy (9)
    ]);
    
    const result = calculateFinalRisk(answers, questionnaire);
    
    expect(result.score).toBeLessThanOrEqual(5);
    expect(result.warnings.some(w => w.type === 'gambler_high_stakes')).toBe(true);
  });
  
  test('Short horizon caps risk regardless of preferences', () => {
    // User wants aggressive but needs money in < 1 year
    const answers = createAnswers([
      0, // stage_student (8)
      0, // inc_fixed (8)
      0, // buf_12plus (10)
      0, // prop_small (10)
      3, // goal_maximize (10)
      0, // hz_1year (1) - SHORT HORIZON
      3, // crash_buy (9)
      2, // trade_risky (8)
      2, // past_calm (7)
      3, // loss_50 (10)
      3, // self_aggressive (10)
      3  // dc_buy (9)
    ]);
    
    const result = calculateFinalRisk(answers, questionnaire);
    
    expect(result.score).toBeLessThanOrEqual(3);
    expect(result.horizonCap).toBe(3);
  });
  
  test('Conservative dominance rule applies', () => {
    // High capacity but low willingness
    const answers = createAnswers([
      1, // stage_building (7)
      0, // inc_fixed (8)
      0, // buf_12plus (10)
      0, // prop_small (10)
      0, // goal_preserve (2)
      2, // hz_3_7 (7)
      1, // crash_sell_some (3)
      0, // trade_safe (2)
      0, // past_panic (1)
      0, // loss_5 (1)
      0, // self_conservative (2)
      0  // dc_exit (1)
    ]);
    
    const result = calculateFinalRisk(answers, questionnaire);
    
    // Should be limited by willingness, not capacity
    expect(result.limitingFactor).toBe('willingness');
    expect(result.score).toBeLessThanOrEqual(3);
  });
  
  test('Inconsistent answers apply penalty', () => {
    // Contradicts self between Q7 and Q12
    const answers = createAnswers([
      1, // stage_building
      1, // inc_mostly
      1, // buf_6_12
      1, // prop_medium
      2, // goal_grow
      2, // hz_3_7
      3, // crash_buy (9) - says will buy in crash
      1, // trade_moderate
      2, // past_calm
      2, // loss_30
      2, // self_growth
      0  // dc_exit (1) - but says will sell immediately
    ]);
    
    const result = calculateFinalRisk(answers, questionnaire);
    
    expect(result.penalties.some(p => p.type === 'inconsistent_panic')).toBe(true);
  });
  
  test('Balanced user gets score 5-6', () => {
    // Moderate everything
    const answers = createAnswers([
      1, // stage_building (7)
      1, // inc_mostly (6)
      1, // buf_6_12 (7)
      1, // prop_medium (6)
      2, // goal_grow (7)
      2, // hz_3_7 (7)
      2, // crash_hold (6)
      1, // trade_moderate (5)
      1, // past_worried (4)
      2, // loss_30 (7)
      1, // self_balanced (5)
      1  // dc_wait (5)
    ]);
    
    const result = calculateFinalRisk(answers, questionnaire);
    
    expect(result.score).toBeGreaterThanOrEqual(5);
    expect(result.score).toBeLessThanOrEqual(6);
    expect(result.profile).toBe('Balanced');
  });
});
```

---

## Verification Checklist

### Data Layer
- [ ] `questionnaire.v2.fa.json` created with 12 questions
- [ ] All questions have dimension, weight, options with scores
- [ ] Flags defined for pathological detection
- [ ] Hard caps defined for horizon limits
- [ ] Profiles and allocations defined for scores 1-10

### Scoring Engine
- [ ] `riskScoring.js` implements all functions
- [ ] `calculateSubScores()` computes C, W, H, G
- [ ] `checkConsistency()` detects Q7 vs Q12 drift
- [ ] `checkOverconfidence()` detects self-assessment gap
- [ ] `detectPathologicalUser()` catches 4 types
- [ ] `calculateFinalRisk()` applies conservative dominance
- [ ] Horizon hard caps applied correctly
- [ ] Final score clamped to 1-10

### UI Layer
- [ ] `ProfileResult.jsx` displays score, profile, allocation
- [ ] Allocation bars render correctly
- [ ] Limiting factor explanation shown
- [ ] Warnings displayed for high-severity flags
- [ ] Continue button triggers consent flow

### Integration
- [ ] `OnboardingControls.jsx` uses v2 questionnaire
- [ ] Progress indicator shows block title
- [ ] Profile result screen appears before consent
- [ ] Allocation passed correctly to portfolio state

### Testing
- [ ] Panic Seller path → score ≤ 3
- [ ] Gambler + high stakes → score ≤ 5
- [ ] Short horizon → capped regardless
- [ ] Conservative dominance applied
- [ ] Inconsistency penalty applied
- [ ] Balanced user → score 5-6

---

## Migration Notes

### Breaking Changes
- Questionnaire JSON structure changed (blocks added)
- Scoring no longer simple sum
- 3 profiles → 10 levels → 5 named profiles

### Backward Compatibility
- Keep old `questionnaire.fa.json` for reference
- Old answer format still supported via `answersArrayToObject()`
- Profile names map to same allocations conceptually

### Data Migration
- Existing users keep current profile
- Re-assessment triggered on next login (optional)
- No forced profile changes

---

## Summary

| Component | Action | Complexity |
|-----------|--------|------------|
| questionnaire.v2.fa.json | Create | Medium |
| riskScoring.js | Create | High |
| ProfileResult.jsx | Create | Medium |
| CSS additions | Add | Low |
| OnboardingControls.jsx | Modify | Medium |
| domain.js | Add | Low |
| Tests | Create | Medium |

**Total Estimated Time:** 4-5 hours

---

**Document Version:** 1.0  
**Target Version:** Blu Markets v10  
**Created:** January 2026
