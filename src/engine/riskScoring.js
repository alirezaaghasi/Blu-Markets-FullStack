/**
 * Risk Scoring Engine for Blu Markets v10
 *
 * Implements (per Canonical User Profiling Document v2.0):
 * - Four dimensions: Capacity (40%), Willingness (35%), Horizon (15%), Goal (10%)
 * - Conservative dominance rule: Final = min(Capacity, Willingness)
 * - Pathological user detection (panic_seller, gambler, dangerous_novice)
 * - Consistency checking with penalties
 * - Horizon hard caps
 */

// Question IDs by dimension (v10.1: 9 questions per canonical spec)
const CAPACITY_QUESTIONS = ['q_income', 'q_buffer', 'q_proportion'];
const WILLINGNESS_QUESTIONS = ['q_crash_20', 'q_tradeoff', 'q_past_behavior', 'q_max_loss'];
const HORIZON_QUESTION = 'q_horizon';
const GOAL_QUESTION = 'q_goal';
const CRASH_QUESTION = 'q_crash_20';
const MAX_LOSS_QUESTION = 'q_max_loss';

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
 * Per canonical spec section 7.1:
 * - Capacity (C): weighted avg of q_income, q_buffer, q_proportion
 * - Willingness (W): weighted avg of q_crash_20, q_tradeoff, q_past_behavior, q_max_loss
 * - Horizon (H): direct from q_horizon
 * - Goal (G): direct from q_goal
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

  return { C, W, H, G };
}

/**
 * Check for inconsistencies between answers
 * Per canonical spec: Compares crash scenario (q_crash_20) with max_loss tolerance
 */
export function checkConsistency(answers) {
  const penalties = [];

  const crashAnswer = answers[CRASH_QUESTION];
  const maxLossAnswer = answers[MAX_LOSS_QUESTION];

  // Inconsistency: Claims to tolerate 30%+ loss but would sell at -20%
  // Per canonical spec section 7.2
  if (crashAnswer && maxLossAnswer) {
    if (crashAnswer.score <= 2 && maxLossAnswer.score >= 7) {
      penalties.push({
        type: 'inconsistent_loss_tolerance',
        amount: -1,
        message: 'Stated loss tolerance higher than behavioral response suggests'
      });
    }
  }

  return penalties;
}

/**
 * Detect pathological user patterns
 * Per canonical spec section 8 - Four dangerous archetypes:
 * - Panic Seller: hard_cap_3
 * - Gambler + High Stakes: hard_cap_5
 * - Gambler alone: cap_willingness_7
 * - Dangerous Novice (inexperienced + gambler): hard_cap_5
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

  return hardCaps[horizonAnswer.optionId] || null;
}

/**
 * Main scoring function - per canonical spec section 7.3
 * Implements Conservative Dominance Rule: R_final = min(C, W)
 * Then applies horizon caps, consistency penalties, pathological user caps
 * Returns final risk score (1-10) with all metadata
 */
export function calculateFinalRisk(answers, questionnaire) {
  // Step 1: Calculate sub-scores
  const scores = calculateSubScores(answers, questionnaire);
  const { C, W, H, G } = scores;

  // Step 2: Collect flags
  const flags = collectFlags(answers);

  // Step 3: Check consistency
  const penalties = checkConsistency(answers);

  // Step 4: Detect pathological users
  const warnings = detectPathologicalUser(answers, flags, scores);

  // Step 5: Apply CONSERVATIVE DOMINANCE RULE
  // Final = min(Capacity, Willingness)
  let rawScore = Math.min(C, W);

  // Determine limiting factor
  const limitingFactor = C < W ? 'capacity' : 'willingness';

  // Step 6: Apply horizon hard cap
  const horizonCap = getHorizonCap(answers, questionnaire);
  if (horizonCap !== null) {
    rawScore = Math.min(rawScore, horizonCap);
  }

  // Step 7: Apply consistency penalties
  const penaltyTotal = penalties.reduce((sum, p) => sum + p.amount, 0);
  rawScore += penaltyTotal;

  // Step 8: Apply hard caps from pathological detection
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

  // Step 9: Clamp to valid range
  const finalScore = Math.max(1, Math.min(10, Math.round(rawScore)));

  // Step 10: Get profile and allocation
  const profile = questionnaire.profiles[String(finalScore)];
  const allocation = questionnaire.allocations[String(finalScore)];

  return {
    score: finalScore,
    profile: profile.name,
    profile_fa: profile.name_fa,
    allocation,

    // Detailed breakdown (internal use)
    capacity: Math.round(C * 10) / 10,
    willingness: Math.round(W * 10) / 10,
    horizon: H,
    goal: G,

    // Adjustments
    limitingFactor,
    horizonCap,
    penalties,
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
export function getProfileDescription(score) {
  const descriptions = {
    'Capital Preservation': {
      headline: 'Safety is your priority',
      headline_fa: 'امنیت اولویت شماست',
      body: 'Your portfolio focuses on protecting your capital with minimal volatility. Expect steady, modest returns.',
      body_fa: 'پورتفوی شما روی حفظ سرمایه با حداقل نوسان تمرکز داره. انتظار بازده ثابت و معقول داشته باش.',
      expectation: 'Typical range: -5% to +15% annually',
      expectation_fa: 'محدوده معمول: -۵٪ تا +۱۵٪ سالانه'
    },
    'Conservative': {
      headline: 'Stability with modest growth',
      headline_fa: 'ثبات با رشد ملایم',
      body: 'Your portfolio balances safety with some growth potential. You can handle small dips for better returns.',
      body_fa: 'پورتفوی شما بین امنیت و پتانسیل رشد تعادل برقرار می‌کنه. افت‌های کوچیک رو تحمل می‌کنی.',
      expectation: 'Typical range: -10% to +20% annually',
      expectation_fa: 'محدوده معمول: -۱۰٪ تا +۲۰٪ سالانه'
    },
    'Balanced': {
      headline: 'Growth with protection',
      headline_fa: 'رشد همراه با حفاظت',
      body: 'Your portfolio seeks meaningful growth while maintaining a safety net. Expect some ups and downs.',
      body_fa: 'پورتفوی شما دنبال رشد معنادار با حفظ یک شبکه امنیت میره. انتظار نوسان داشته باش.',
      expectation: 'Typical range: -20% to +30% annually',
      expectation_fa: 'محدوده معمول: -۲۰٪ تا +۳۰٪ سالانه'
    },
    'Growth': {
      headline: 'Long-term wealth building',
      headline_fa: 'ساختن ثروت بلندمدت',
      body: 'Your portfolio prioritizes growth over stability. You understand volatility is the price of higher returns.',
      body_fa: 'پورتفوی شما رشد رو به ثبات ترجیح میده. می‌فهمی که نوسان قیمت بازده بالاتره.',
      expectation: 'Typical range: -30% to +50% annually',
      expectation_fa: 'محدوده معمول: -۳۰٪ تا +۵۰٪ سالانه'
    },
    'Aggressive': {
      headline: 'Maximum growth potential',
      headline_fa: 'حداکثر پتانسیل رشد',
      body: 'Your portfolio is optimized for maximum returns. Significant volatility is expected and accepted.',
      body_fa: 'پورتفوی شما برای حداکثر بازده بهینه شده. نوسان قابل توجه پذیرفته شده.',
      expectation: 'Typical range: -40% to +80% annually',
      expectation_fa: 'محدوده معمول: -۴۰٪ تا +۸۰٪ سالانه'
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
 * Convert answers object (questionId -> optionIndex) to rich answer format
 * Compatible with existing questionnaire flow that stores { qId: optionIndex }
 */
export function answersToRichFormat(answersObj, questionnaire) {
  const richAnswers = {};

  for (const [qId, optionIndex] of Object.entries(answersObj)) {
    const question = questionnaire.questions.find(q => q.id === qId);
    if (!question) continue;

    const selectedOption = question.options[optionIndex];
    if (selectedOption) {
      richAnswers[qId] = {
        questionId: qId,
        optionId: selectedOption.id,
        optionIndex: optionIndex,
        score: selectedOption.score,
        flag: selectedOption.flag || null
      };
    }
  }

  return richAnswers;
}

export default {
  calculateSubScores,
  checkConsistency,
  detectPathologicalUser,
  getHorizonCap,
  calculateFinalRisk,
  getProfileDescription,
  answersToRichFormat
};
