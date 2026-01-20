import { FastifyReply, FastifyRequest } from 'fastify';
import {
  submitQuestionnaireSchema,
  recordConsentSchema,
  initialFundingSchema,
  type SubmitQuestionnaireInput,
  type RecordConsentInput,
  type InitialFundingInput,
} from './onboarding.schemas.js';
import {
  submitQuestionnaire,
  recordConsent,
  createInitialPortfolio,
} from './onboarding.service.js';
import type { SubmitQuestionnaireResponse } from '../../types/api.js';

export async function handleSubmitQuestionnaire(
  request: FastifyRequest<{ Body: SubmitQuestionnaireInput }>,
  reply: FastifyReply
): Promise<SubmitQuestionnaireResponse> {
  const input = submitQuestionnaireSchema.parse(request.body);
  const profile = await submitQuestionnaire(request.userId, input);

  return {
    riskScore: profile.score,
    riskTier: profile.tier,
    profileName: profile.name,
    targetAllocation: profile.targetAllocation,
  };
}

export async function handleRecordConsent(
  request: FastifyRequest<{ Body: RecordConsentInput }>,
  reply: FastifyReply
): Promise<{ success: boolean }> {
  const input = recordConsentSchema.parse(request.body);
  return recordConsent(request.userId, input);
}

export async function handleInitialFunding(
  request: FastifyRequest<{ Body: InitialFundingInput }>,
  reply: FastifyReply
): Promise<{
  portfolioId: string;
  cashIrr: number;
  targetAllocation: { foundation: number; growth: number; upside: number };
}> {
  const input = initialFundingSchema.parse(request.body);
  return createInitialPortfolio(request.userId, input);
}
