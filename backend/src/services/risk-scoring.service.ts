import {
  RiskProfile,
  RiskTier,
  TargetAllocation,
  RISK_PROFILE_NAMES,
  TARGET_ALLOCATIONS,
} from '../types/domain.js';

// Risk Scoring Algorithm per PRD Section 17
// Five dimensions with weights

interface QuestionnaireAnswer {
  questionId: string;
  answerId: string;
  value: number; // 1-5 scale
}

interface DimensionScores {
  lossComfort: number;      // Weight: 30%
  timeHorizon: number;      // Weight: 25%
  experience: number;       // Weight: 20%
  financialStability: number; // Weight: 15%
  goalClarity: number;      // Weight: 10%
}

const DIMENSION_WEIGHTS: Record<keyof DimensionScores, number> = {
  lossComfort: 0.30,
  timeHorizon: 0.25,
  experience: 0.20,
  financialStability: 0.15,
  goalClarity: 0.10,
};

// Question to dimension mapping (per PRD)
const QUESTION_DIMENSION_MAP: Record<string, keyof DimensionScores> = {
  q1: 'lossComfort',
  q2: 'lossComfort',
  q3: 'timeHorizon',
  q4: 'timeHorizon',
  q5: 'experience',
  q6: 'experience',
  q7: 'financialStability',
  q8: 'financialStability',
  q9: 'goalClarity',
  q10: 'goalClarity',
};

export function calculateRiskScore(answers: QuestionnaireAnswer[]): RiskProfile {
  // Group answers by dimension
  const dimensionValues: Record<keyof DimensionScores, number[]> = {
    lossComfort: [],
    timeHorizon: [],
    experience: [],
    financialStability: [],
    goalClarity: [],
  };

  for (const answer of answers) {
    const dimension = QUESTION_DIMENSION_MAP[answer.questionId];
    if (dimension) {
      dimensionValues[dimension].push(answer.value);
    }
  }

  // Calculate dimension averages
  const dimensionScores: DimensionScores = {
    lossComfort: average(dimensionValues.lossComfort),
    timeHorizon: average(dimensionValues.timeHorizon),
    experience: average(dimensionValues.experience),
    financialStability: average(dimensionValues.financialStability),
    goalClarity: average(dimensionValues.goalClarity),
  };

  // Calculate weighted score (1-5 scale initially)
  let weightedScore = 0;
  for (const [dimension, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    weightedScore += dimensionScores[dimension as keyof DimensionScores] * weight;
  }

  // Scale to 1-10
  let rawScore = Math.round((weightedScore - 1) * (9 / 4) + 1);

  // Apply adjustments per PRD

  // 1. Conservative dominance rule: if lossComfort <= 2, cap at score 5
  if (dimensionScores.lossComfort <= 2) {
    rawScore = Math.min(rawScore, 5);
  }

  // 2. Time horizon hard cap: if timeHorizon <= 2 (short-term), cap at score 6
  if (dimensionScores.timeHorizon <= 2) {
    rawScore = Math.min(rawScore, 6);
  }

  // 3. Experience floor: if experience <= 2, reduce score by 1 (min 1)
  if (dimensionScores.experience <= 2) {
    rawScore = Math.max(1, rawScore - 1);
  }

  // 4. Consistency penalty: high variance in answers indicates uncertainty
  const allValues = answers.map((a) => a.value);
  const variance = calculateVariance(allValues);
  if (variance > 1.5) {
    // High inconsistency, reduce score by 1 toward conservative
    rawScore = Math.max(1, rawScore - 1);
  }

  // 5. Pathological user detection: all 5s or all 1s
  const uniqueValues = new Set(allValues);
  if (uniqueValues.size === 1) {
    // All same answers - apply conservative adjustment
    if (allValues[0] === 5) {
      rawScore = 7; // Cap aggressive to moderate-aggressive
    } else if (allValues[0] === 1) {
      rawScore = 2; // Keep conservative
    }
  }

  // Ensure bounds
  const score = Math.max(1, Math.min(10, rawScore));

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

function average(values: number[]): number {
  if (values.length === 0) return 3; // Default to middle
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return average(squaredDiffs);
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
