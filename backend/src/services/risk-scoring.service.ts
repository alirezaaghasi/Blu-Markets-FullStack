// Risk Scoring Algorithm per PRD Section 17
// 4 Dimensions: Capacity (40%), Willingness (35%), Horizon (15%), Goal (10%)

import {
  RiskProfile,
  RiskTier,
  TargetAllocation,
  RISK_PROFILE_NAMES,
  TARGET_ALLOCATIONS,
} from '../types/domain.js';

interface QuestionnaireAnswer {
  questionId: string;
  answerId: string;
  value: number; // Score from question option (1-10)
  flag?: string; // Optional flag like 'panic_seller', 'gambler', etc.
}

interface DimensionScores {
  capacity: number;
  willingness: number;
  horizon: number;
  goal: number;
}

// Question weights per PRD Section 16.1
const QUESTION_WEIGHTS: Record<string, number> = {
  q_income: 1.0,
  q_buffer: 1.2,
  q_proportion: 1.3,
  q_goal: 1.0,
  q_horizon: 1.0,
  q_crash_20: 2.0,
  q_tradeoff: 1.5,
  q_past_behavior: 1.0,
  q_max_loss: 1.5,
};

// Question to dimension mapping
const QUESTION_DIMENSION_MAP: Record<string, keyof DimensionScores> = {
  q_income: 'capacity',
  q_buffer: 'capacity',
  q_proportion: 'capacity',
  q_goal: 'goal',
  q_horizon: 'horizon',
  q_crash_20: 'willingness',
  q_tradeoff: 'willingness',
  q_past_behavior: 'willingness',
  q_max_loss: 'willingness',
};

export function calculateRiskScore(answers: QuestionnaireAnswer[]): RiskProfile {
  // Extract flags from answers
  const flags: string[] = [];
  answers.forEach((a) => {
    if (a.flag) flags.push(a.flag);
  });

  // Step 1: Calculate dimension scores using weighted average
  const dimensions = calculateDimensionScores(answers);

  // Step 2: Apply conservative dominance rule
  // Base score = min(Capacity, Willingness)
  let baseScore = Math.min(dimensions.capacity, dimensions.willingness);

  // Step 3: Apply horizon hard caps
  const horizonAnswer = answers.find((a) => a.questionId === 'q_horizon');
  if (horizonAnswer) {
    if (horizonAnswer.value === 1) {
      // Less than 1 year -> cap at 3
      baseScore = Math.min(baseScore, 3);
    } else if (horizonAnswer.value === 4) {
      // 1-3 years -> cap at 5
      baseScore = Math.min(baseScore, 5);
    }
  }

  // Step 4: Check consistency penalty
  // If q_crash_20 <= 2 AND q_max_loss >= 7 -> penalty of -1
  const crashAnswer = answers.find((a) => a.questionId === 'q_crash_20');
  const maxLossAnswer = answers.find((a) => a.questionId === 'q_max_loss');
  if (crashAnswer && maxLossAnswer) {
    if (crashAnswer.value <= 2 && maxLossAnswer.value >= 7) {
      baseScore -= 1;
    }
  }

  // Step 5: Detect pathological users
  if (flags.includes('panic_seller')) {
    // Hard cap at 3
    baseScore = Math.min(baseScore, 3);
  }

  if (flags.includes('gambler')) {
    if (flags.includes('high_proportion')) {
      // Gambler + high proportion -> cap at 5
      baseScore = Math.min(baseScore, 5);
    } else if (flags.includes('inexperienced')) {
      // Inexperienced + gambler -> cap at 5
      baseScore = Math.min(baseScore, 5);
    } else {
      // Just gambler alone -> cap willingness at 7, recalculate
      const cappedWillingness = Math.min(dimensions.willingness, 7);
      baseScore = Math.min(dimensions.capacity, cappedWillingness);
    }
  }

  // Step 6: Final score - clamp to [1, 10] and round
  const score = Math.max(1, Math.min(10, Math.round(baseScore)));

  // Determine tier
  const tier = getTier(score);

  // Get profile name
  const name = RISK_PROFILE_NAMES[score];

  // Get target allocation
  const targetAllocation = TARGET_ALLOCATIONS[score];

  return {
    score,
    tier,
    name,
    targetAllocation,
  };
}

function calculateDimensionScores(answers: QuestionnaireAnswer[]): DimensionScores {
  const dimensionValues: Record<keyof DimensionScores, { sum: number; weightSum: number }> = {
    capacity: { sum: 0, weightSum: 0 },
    willingness: { sum: 0, weightSum: 0 },
    horizon: { sum: 0, weightSum: 0 },
    goal: { sum: 0, weightSum: 0 },
  };

  for (const answer of answers) {
    const dimension = QUESTION_DIMENSION_MAP[answer.questionId];
    const weight = QUESTION_WEIGHTS[answer.questionId] || 1.0;

    if (dimension) {
      dimensionValues[dimension].sum += answer.value * weight;
      dimensionValues[dimension].weightSum += weight;
    }
  }

  return {
    capacity:
      dimensionValues.capacity.weightSum > 0
        ? dimensionValues.capacity.sum / dimensionValues.capacity.weightSum
        : 5,
    willingness:
      dimensionValues.willingness.weightSum > 0
        ? dimensionValues.willingness.sum / dimensionValues.willingness.weightSum
        : 5,
    horizon:
      dimensionValues.horizon.weightSum > 0
        ? dimensionValues.horizon.sum / dimensionValues.horizon.weightSum
        : 5,
    goal:
      dimensionValues.goal.weightSum > 0
        ? dimensionValues.goal.sum / dimensionValues.goal.weightSum
        : 5,
  };
}

function getTier(score: number): RiskTier {
  if (score <= 3) return 'LOW';
  if (score <= 6) return 'MEDIUM';
  return 'HIGH';
}

export function getTargetAllocation(score: number): TargetAllocation {
  const validScore = Math.max(1, Math.min(10, score));
  return TARGET_ALLOCATIONS[validScore];
}
