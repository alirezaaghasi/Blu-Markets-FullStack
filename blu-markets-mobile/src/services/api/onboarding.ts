// Onboarding API Module
// src/services/api/onboarding.ts

import { apiClient } from './client';
import type { QuestionnaireResponse, PortfolioResponse, TargetLayerPct, Holding, AssetId, Layer, PortfolioStatus } from './types';

interface QuestionnaireAnswer {
  questionId: string;
  answerId: string;
  value: number;
  flag?: string; // Pathological user flags: panic_seller, gambler, high_proportion, inexperienced
}

// TYPE SAFETY FIX #9: Define proper types for backend API responses
// These types handle both camelCase and snake_case field naming conventions from the API
// Note: apiClient.post returns unwrapped data due to response interceptor
interface BackendQuestionnaireResponse {
  riskScore?: number;
  risk_score?: number;
  score?: number;
  riskTier?: string;
  risk_tier?: string;
  profileName?: string;
  profile_name?: string;
  targetAllocation?: Record<string, number>;
  target_allocation?: Record<string, number>;
}

interface BackendHolding {
  assetId: string;
  holdingId?: string;
  quantity: number | string;
  layer: string;
  valueIrr?: number;
  frozen?: boolean;
}

interface BackendPortfolioResponse {
  cashIrr?: number;
  cash_irr?: number;
  holdings?: BackendHolding[];
  targetAllocation?: Record<string, number>;
  target_allocation?: Record<string, number>;
  status?: string;
  totalValueIrr?: number;
  total_value_irr?: number;
  totalValue?: number;
  dailyChangePercent?: number;
  daily_change_percent?: number;
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
 * TYPE SAFETY FIX #9: Use proper types instead of `any`
 */
function normalizeQuestionnaireResponse(data: BackendQuestionnaireResponse): QuestionnaireResponse {
  return {
    riskScore: data.riskScore ?? data.risk_score ?? data.score ?? 5,
    riskTier: data.riskTier ?? data.risk_tier ?? 'MEDIUM',
    profileName: data.profileName ?? data.profile_name ?? 'Balanced',
    targetAllocation: normalizeAllocation(data.targetAllocation ?? data.target_allocation),
  };
}

/**
 * Transform backend holdings array to frontend Holding[] type
 * TYPE SAFETY FIX #9: Properly transform backend fields to frontend types
 */
function normalizeHoldings(backendHoldings: BackendHolding[] | undefined): Holding[] {
  if (!backendHoldings) return [];
  return backendHoldings.map((h) => ({
    id: h.holdingId,
    assetId: h.assetId as AssetId,
    quantity: typeof h.quantity === 'string' ? parseFloat(h.quantity) : h.quantity,
    frozen: h.frozen ?? false,
    layer: h.layer as Layer,
  }));
}

/**
 * Normalize backend portfolio response to match mobile PortfolioResponse type
 * TYPE SAFETY FIX #9: Use proper types instead of `any`
 */
function normalizePortfolioResponse(data: BackendPortfolioResponse): PortfolioResponse {
  return {
    cashIrr: data.cashIrr ?? data.cash_irr ?? 0,
    holdings: normalizeHoldings(data.holdings),
    targetAllocation: normalizeAllocation(data.targetAllocation ?? data.target_allocation),
    status: (data.status ?? 'IDLE') as PortfolioStatus,
    totalValueIrr: data.totalValueIrr ?? data.total_value_irr ?? data.totalValue ?? 0,
    dailyChangePercent: data.dailyChangePercent ?? data.daily_change_percent ?? 0,
  };
}

export const onboarding = {
  submitQuestionnaire: async (answers: QuestionnaireAnswer[]): Promise<QuestionnaireResponse> => {
    // apiClient.post returns unwrapped data due to response interceptor
    const data = await apiClient.post('/onboarding/questionnaire', { answers }) as unknown as BackendQuestionnaireResponse;
    return normalizeQuestionnaireResponse(data);
  },

  recordConsent: (): Promise<{ success: boolean }> =>
    apiClient.post('/onboarding/consent', {
      consentRisk: true,
      consentLoss: true,
      consentNoGuarantee: true,
    }) as unknown as Promise<{ success: boolean }>,

  createPortfolio: async (amountIrr: number): Promise<PortfolioResponse> => {
    // apiClient.post returns unwrapped data due to response interceptor
    const data = await apiClient.post('/onboarding/initial-funding', { amountIrr }) as unknown as BackendPortfolioResponse;
    return normalizePortfolioResponse(data);
  },
};
