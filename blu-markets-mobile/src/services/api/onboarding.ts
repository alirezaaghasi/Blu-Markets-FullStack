// Onboarding API Module
// src/services/api/onboarding.ts

import { apiClient } from './client';
import type { QuestionnaireResponse, PortfolioResponse } from './types';

export const onboarding = {
  submitQuestionnaire: (answers: Record<string, number>): Promise<QuestionnaireResponse> =>
    apiClient.post('/onboarding/questionnaire', { answers }),

  recordConsent: (): Promise<{ success: boolean }> =>
    apiClient.post('/onboarding/consent'),

  createPortfolio: (amountIrr: number): Promise<PortfolioResponse> =>
    apiClient.post('/onboarding/initial-funding', { amountIrr }),
};
