// Onboarding API Module
// src/services/api/onboarding.ts

import { apiClient } from './client';
import type { QuestionnaireResponse, PortfolioResponse } from './types';

interface QuestionnaireAnswer {
  questionId: string;
  answerId: string;
  value: number;
}

export const onboarding = {
  submitQuestionnaire: (answers: QuestionnaireAnswer[]): Promise<QuestionnaireResponse> =>
    apiClient.post('/onboarding/questionnaire', { answers }),

  recordConsent: (): Promise<{ success: boolean }> =>
    apiClient.post('/onboarding/consent', {
      consentRisk: true,
      consentLoss: true,
      consentNoGuarantee: true,
    }),

  createPortfolio: (amountIrr: number): Promise<PortfolioResponse> =>
    apiClient.post('/onboarding/initial-funding', { amountIrr }),
};
