// Onboarding API Module
// src/services/api/onboarding.ts

import { apiClient } from './client';
import type { QuestionnaireResponse, PortfolioResponse, TargetLayerPct } from './types';

interface QuestionnaireAnswer {
  questionId: string;
  answerId: string;
  value: number;
  flag?: string; // Pathological user flags: panic_seller, gambler, high_proportion, inexperienced
}

/**
 * Normalize allocation values from backend format to frontend format
 * Backend: lowercase keys (foundation, growth, upside) with integer percentages (85, 12, 3)
 * Frontend: UPPERCASE keys (FOUNDATION, GROWTH, UPSIDE) with decimals (0.85, 0.12, 0.03)
 */
function normalizeAllocation(allocation: Record<string, number> | undefined): TargetLayerPct {
  if (!allocation) {
    return { FOUNDATION: 0.5, GROWTH: 0.35, UPSIDE: 0.15 }; // Default allocation
  }

  const normalizeValue = (val: number | undefined): number => {
    if (val === undefined || val === null) return 0;
    // Convert integers (>1) to decimals
    return val > 1 ? val / 100 : val;
  };

  return {
    FOUNDATION: normalizeValue(allocation.FOUNDATION ?? allocation.foundation),
    GROWTH: normalizeValue(allocation.GROWTH ?? allocation.growth),
    UPSIDE: normalizeValue(allocation.UPSIDE ?? allocation.upside),
  };
}

/**
 * Normalize backend questionnaire response to match mobile QuestionnaireResponse type
 */
function normalizeQuestionnaireResponse(data: any): QuestionnaireResponse {
  return {
    riskScore: data.riskScore ?? data.risk_score ?? data.score ?? 5,
    riskTier: data.riskTier ?? data.risk_tier ?? 'MEDIUM',
    profileName: data.profileName ?? data.profile_name ?? 'Balanced',
    targetAllocation: normalizeAllocation(data.targetAllocation ?? data.target_allocation),
  };
}

/**
 * Normalize backend portfolio response to match mobile PortfolioResponse type
 */
function normalizePortfolioResponse(data: any): PortfolioResponse {
  return {
    cashIrr: data.cashIrr ?? data.cash_irr ?? 0,
    holdings: data.holdings ?? [],
    targetAllocation: normalizeAllocation(data.targetAllocation ?? data.target_allocation),
    status: data.status ?? 'IDLE',
    totalValueIrr: data.totalValueIrr ?? data.total_value_irr ?? data.totalValue ?? 0,
    dailyChangePercent: data.dailyChangePercent ?? data.daily_change_percent ?? 0,
  };
}

export const onboarding = {
  submitQuestionnaire: async (answers: QuestionnaireAnswer[]): Promise<QuestionnaireResponse> => {
    const data = await apiClient.post('/onboarding/questionnaire', { answers });
    return normalizeQuestionnaireResponse(data);
  },

  recordConsent: (): Promise<{ success: boolean }> =>
    apiClient.post('/onboarding/consent', {
      consentRisk: true,
      consentLoss: true,
      consentNoGuarantee: true,
    }),

  createPortfolio: async (amountIrr: number): Promise<PortfolioResponse> => {
    const data = await apiClient.post('/onboarding/initial-funding', { amountIrr });
    return normalizePortfolioResponse(data);
  },
};
