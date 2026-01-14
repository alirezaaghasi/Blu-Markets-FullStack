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

  return hardCaps[horizonAnswer.optionId] || null;
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
  checkOverconfidence,
  detectPathologicalUser,
  getHorizonCap,
  calculateFinalRisk,
  getProfileDescription,
  answersToRichFormat
};
