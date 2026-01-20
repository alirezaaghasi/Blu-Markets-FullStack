// Risk Profile Calculator
// Based on PRD Section 17 - Risk Profiling Algorithm

import { RiskProfile, TargetLayerPct } from '../types';
import { QUESTIONS } from '../constants/questionnaire';
import { RISK_PROFILE_ALLOCATIONS, RISK_PROFILE_NAMES } from '../constants/business';

interface AnswerWithScore {
  questionId: string;
  optionIndex: number;
  score: number;
  weight: number;
  flag?: string;
}

interface DimensionScores {
  capacity: number;
  willingness: number;
  horizon: number;
  goal: number;
}

// Calculate weighted average for a dimension
const calculateDimensionScore = (
  answers: AnswerWithScore[],
  dimension: string
): number => {
  const dimensionAnswers = answers.filter(
    (a) => QUESTIONS.find((q) => q.id === a.questionId)?.dimension === dimension
  );

  if (dimensionAnswers.length === 0) return 5; // Default middle score

  const numerator = dimensionAnswers.reduce((sum, a) => sum + a.score * a.weight, 0);
  const denominator = dimensionAnswers.reduce((sum, a) => sum + a.weight, 0);

  return numerator / denominator;
};

// Detect pathological user patterns
const detectFlags = (answers: AnswerWithScore[]): string[] => {
  const flags: string[] = [];

  answers.forEach((answer) => {
    const question = QUESTIONS.find((q) => q.id === answer.questionId);
    if (question) {
      const option = question.options[answer.optionIndex];
      if (option?.flag) {
        flags.push(option.flag);
      }
    }
  });

  return flags;
};

// Check for consistency penalty
const hasConsistencyPenalty = (answers: AnswerWithScore[]): boolean => {
  const crashAnswer = answers.find((a) => a.questionId === 'q_crash_20');
  const maxLossAnswer = answers.find((a) => a.questionId === 'q_max_loss');

  if (crashAnswer && maxLossAnswer) {
    // Panic at -20% but claims 30%+ tolerance
    return crashAnswer.score <= 2 && maxLossAnswer.score >= 7;
  }

  return false;
};

// Get horizon hard cap
const getHorizonCap = (answers: AnswerWithScore[]): number | null => {
  const horizonAnswer = answers.find((a) => a.questionId === 'q_horizon');
  if (!horizonAnswer) return null;

  const score = horizonAnswer.score;
  if (score === 1) return 3; // Less than 1 year -> cap at 3
  if (score === 4) return 5; // 1-3 years -> cap at 5
  return null;
};

export const calculateRiskProfile = (
  rawAnswers: Record<string, number>
): RiskProfile => {
  // Convert raw answers to scored answers
  const answers: AnswerWithScore[] = Object.entries(rawAnswers).map(
    ([questionId, optionIndex]) => {
      const question = QUESTIONS.find((q) => q.id === questionId);
      const option = question?.options[optionIndex];

      return {
        questionId,
        optionIndex,
        score: option?.score ?? 5,
        weight: question?.weight ?? 1,
        flag: option?.flag,
      };
    }
  );

  // Step 1: Calculate dimension scores
  const dimensions: DimensionScores = {
    capacity: calculateDimensionScore(answers, 'CAPACITY'),
    willingness: calculateDimensionScore(answers, 'WILLINGNESS'),
    horizon: calculateDimensionScore(answers, 'HORIZON'),
    goal: calculateDimensionScore(answers, 'GOAL'),
  };

  // Step 2: Apply conservative dominance rule
  let baseScore = Math.min(dimensions.capacity, dimensions.willingness);

  // Step 3: Apply horizon hard caps
  const horizonCap = getHorizonCap(answers);
  if (horizonCap !== null) {
    baseScore = Math.min(baseScore, horizonCap);
  }

  // Step 4: Check consistency penalty
  if (hasConsistencyPenalty(answers)) {
    baseScore -= 1;
  }

  // Step 5: Detect pathological users
  const flags = detectFlags(answers);

  if (flags.includes('panic_seller')) {
    baseScore = Math.min(baseScore, 3);
  }

  if (flags.includes('gambler')) {
    if (flags.includes('high_proportion')) {
      baseScore = Math.min(baseScore, 5);
    } else if (flags.includes('inexperienced')) {
      baseScore = Math.min(baseScore, 5);
    } else {
      // Just gambler alone - cap willingness contribution
      const cappedWillingness = Math.min(dimensions.willingness, 7);
      baseScore = Math.min(dimensions.capacity, cappedWillingness);
    }
  }

  // Step 6: Final score - clamp to [1, 10] and round
  const finalScore = Math.max(1, Math.min(10, Math.round(baseScore)));

  // Get profile name and allocation
  const profileNames = RISK_PROFILE_NAMES[finalScore];
  const targetAllocation = RISK_PROFILE_ALLOCATIONS[finalScore];

  return {
    score: finalScore,
    profileName: profileNames.en,
    profileNameFarsi: profileNames.fa,
    targetAllocation,
  };
};

// Format allocation as percentages
export const formatAllocation = (allocation: TargetLayerPct): {
  foundation: string;
  growth: string;
  upside: string;
} => {
  return {
    foundation: `${Math.round(allocation.FOUNDATION * 100)}%`,
    growth: `${Math.round(allocation.GROWTH * 100)}%`,
    upside: `${Math.round(allocation.UPSIDE * 100)}%`,
  };
};
