import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';
import { calculateRiskScore } from '../../services/risk-scoring.service.js';
import type { RiskProfile, TargetAllocation } from '../../types/domain.js';
import type { SubmitQuestionnaireInput, RecordConsentInput, InitialFundingInput } from './onboarding.schemas.js';

export async function submitQuestionnaire(
  userId: string,
  input: SubmitQuestionnaireInput
): Promise<RiskProfile> {
  // Calculate risk profile
  const profile = calculateRiskScore(input.answers);

  // Update user with risk profile
  await prisma.user.update({
    where: { id: userId },
    data: {
      riskScore: profile.score,
      riskTier: profile.tier,
      riskProfileName: profile.name,
      targetFoundation: profile.targetAllocation.foundation,
      targetGrowth: profile.targetAllocation.growth,
      targetUpside: profile.targetAllocation.upside,
      questionnaireData: input.answers,
    },
  });

  return profile;
}

export async function recordConsent(
  userId: string,
  input: RecordConsentInput
): Promise<{ success: boolean }> {
  // Verify user has completed questionnaire
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user?.riskScore) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Please complete the risk questionnaire first',
      400
    );
  }

  // Record consent
  await prisma.user.update({
    where: { id: userId },
    data: {
      consentRisk: input.consentRisk,
      consentLoss: input.consentLoss,
      consentNoGuarantee: input.consentNoGuarantee,
      consentTimestamp: new Date(),
    },
  });

  return { success: true };
}

export async function createInitialPortfolio(
  userId: string,
  input: InitialFundingInput
): Promise<{
  portfolioId: string;
  cashIrr: number;
  targetAllocation: TargetAllocation;
}> {
  // Verify user has completed onboarding prerequisites
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { portfolio: true },
  });

  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  if (!user.riskScore || !user.consentRisk || !user.consentLoss || !user.consentNoGuarantee) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Please complete questionnaire and consent before funding',
      400
    );
  }

  if (user.portfolio) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Portfolio already exists',
      400
    );
  }

  // Create portfolio with initial cash
  const portfolio = await prisma.portfolio.create({
    data: {
      userId,
      cashIrr: input.amountIrr,
      status: 'BALANCED',
      totalValueIrr: input.amountIrr,
      holdingsValueIrr: 0,
      foundationPct: 0,
      growthPct: 0,
      upsidePct: 0,
    },
  });

  // Create initial ledger entry
  await prisma.ledgerEntry.create({
    data: {
      portfolioId: portfolio.id,
      entryType: 'PORTFOLIO_CREATED',
      beforeSnapshot: {
        cashIrr: 0,
        holdings: [],
        totalValueIrr: 0,
      },
      afterSnapshot: {
        cashIrr: input.amountIrr,
        holdings: [],
        totalValueIrr: input.amountIrr,
      },
      amountIrr: input.amountIrr,
      boundary: 'SAFE',
      message: `Portfolio created with ${formatIrr(input.amountIrr)} initial funding`,
    },
  });

  // Create action log entry
  await prisma.actionLog.create({
    data: {
      portfolioId: portfolio.id,
      actionType: 'PORTFOLIO_CREATED',
      boundary: 'SAFE',
      message: `Portfolio created with ${formatIrr(input.amountIrr)}`,
      amountIrr: input.amountIrr,
    },
  });

  return {
    portfolioId: portfolio.id,
    cashIrr: input.amountIrr,
    targetAllocation: {
      foundation: Number(user.targetFoundation),
      growth: Number(user.targetGrowth),
      upside: Number(user.targetUpside),
    },
  };
}

function formatIrr(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + ' IRR';
}
