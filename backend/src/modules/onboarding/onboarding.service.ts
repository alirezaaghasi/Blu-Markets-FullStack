import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';
import { calculateRiskScore } from '../../services/risk-scoring.service.js';
import { getCurrentPrices } from '../../services/price-fetcher.service.js';
import type { RiskProfile, TargetAllocation, AssetId, Layer } from '../../types/domain.js';
import type { SubmitQuestionnaireInput, RecordConsentInput, InitialFundingInput } from './onboarding.schemas.js';

// ============================================================
// INITIAL ALLOCATION CONFIGURATION
// Define which assets to buy for each layer and their weights
// ============================================================
const LAYER_ASSETS: Record<Layer, Array<{ assetId: AssetId; weight: number }>> = {
  FOUNDATION: [
    { assetId: 'PAXG', weight: 0.50 },   // PAX Gold - 50% of foundation
    { assetId: 'USDT', weight: 0.50 },   // Tether USD - 50% of foundation
  ],
  GROWTH: [
    { assetId: 'BTC', weight: 0.45 },    // Bitcoin - 45% of growth
    { assetId: 'ETH', weight: 0.35 },    // Ethereum - 35% of growth
    { assetId: 'BNB', weight: 0.20 },    // BNB - 20% of growth
  ],
  UPSIDE: [
    { assetId: 'SOL', weight: 0.40 },    // Solana - 40% of upside
    { assetId: 'TON', weight: 0.30 },    // Toncoin - 30% of upside
    { assetId: 'LINK', weight: 0.30 },   // Chainlink - 30% of upside
  ],
};

// Minimum trade amount in IRR (1 million IRR)
const MIN_TRADE_AMOUNT_IRR = 1_000_000;

// No cash buffer during onboarding - invest 100% into assets
// When user adds funds later, 100% goes to cash wallet
const CASH_BUFFER_PCT = 0; // 0%

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
  holdings: Array<{ assetId: string; quantity: number; valueIrr: number }>;
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

  // Get current prices for all assets
  const prices = await getCurrentPrices();

  // Calculate target allocation from user profile
  const targetAllocation: TargetAllocation = {
    foundation: Number(user.targetFoundation) || 50,
    growth: Number(user.targetGrowth) || 35,
    upside: Number(user.targetUpside) || 15,
  };

  // Calculate investable amount (total - cash buffer)
  const totalAmount = input.amountIrr;
  const cashBuffer = Math.floor(totalAmount * CASH_BUFFER_PCT);
  const investableAmount = totalAmount - cashBuffer;

  // Calculate amount per layer
  const foundationAmount = Math.floor(investableAmount * (targetAllocation.foundation / 100));
  const growthAmount = Math.floor(investableAmount * (targetAllocation.growth / 100));
  const upsideAmount = Math.floor(investableAmount * (targetAllocation.upside / 100));

  // Prepare holdings to create
  const holdingsToCreate: Array<{
    assetId: string;
    quantity: number;
    layer: Layer;
    valueIrr: number;
  }> = [];

  // Process each layer
  const processLayer = (layerAmount: number, layer: Layer) => {
    const assets = LAYER_ASSETS[layer];
    for (const asset of assets) {
      const assetAmountIrr = Math.floor(layerAmount * asset.weight);

      // Skip if below minimum trade amount
      if (assetAmountIrr < MIN_TRADE_AMOUNT_IRR) continue;

      // Get price for this asset
      const price = prices.get(asset.assetId);
      if (!price || price.priceIrr <= 0) {
        console.error(`Price not available for ${asset.assetId}, skipping`);
        continue;
      }

      // Calculate quantity
      const quantity = assetAmountIrr / price.priceIrr;

      holdingsToCreate.push({
        assetId: asset.assetId,
        quantity,
        layer,
        valueIrr: assetAmountIrr,
      });
    }
  };

  processLayer(foundationAmount, 'FOUNDATION');
  processLayer(growthAmount, 'GROWTH');
  processLayer(upsideAmount, 'UPSIDE');

  // Calculate total holdings value
  const totalHoldingsValue = holdingsToCreate.reduce((sum, h) => sum + h.valueIrr, 0);
  const remainingCash = totalAmount - totalHoldingsValue;

  // Calculate actual allocation percentages
  const foundationValue = holdingsToCreate
    .filter(h => h.layer === 'FOUNDATION')
    .reduce((sum, h) => sum + h.valueIrr, 0);
  const growthValue = holdingsToCreate
    .filter(h => h.layer === 'GROWTH')
    .reduce((sum, h) => sum + h.valueIrr, 0);
  const upsideValue = holdingsToCreate
    .filter(h => h.layer === 'UPSIDE')
    .reduce((sum, h) => sum + h.valueIrr, 0);

  const actualFoundationPct = totalAmount > 0 ? (foundationValue / totalAmount) * 100 : 0;
  const actualGrowthPct = totalAmount > 0 ? (growthValue / totalAmount) * 100 : 0;
  const actualUpsidePct = totalAmount > 0 ? (upsideValue / totalAmount) * 100 : 0;

  // Create portfolio with holdings in a transaction
  const portfolio = await prisma.$transaction(async (tx) => {
    // Create portfolio
    const newPortfolio = await tx.portfolio.create({
      data: {
        userId,
        cashIrr: remainingCash,
        status: 'BALANCED',
        totalValueIrr: totalAmount,
        holdingsValueIrr: totalHoldingsValue,
        foundationPct: actualFoundationPct,
        growthPct: actualGrowthPct,
        upsidePct: actualUpsidePct,
      },
    });

    // Create holdings
    for (const holding of holdingsToCreate) {
      await tx.holding.create({
        data: {
          portfolioId: newPortfolio.id,
          assetId: holding.assetId,
          quantity: holding.quantity,
          layer: holding.layer,
          purchaseDate: new Date(),
        },
      });
    }

    // Create initial portfolio creation ledger entry
    await tx.ledgerEntry.create({
      data: {
        portfolioId: newPortfolio.id,
        entryType: 'PORTFOLIO_CREATED',
        beforeSnapshot: {
          cashIrr: 0,
          holdings: [],
          totalValueIrr: 0,
        },
        afterSnapshot: {
          cashIrr: remainingCash,
          holdings: holdingsToCreate.map(h => ({
            assetId: h.assetId,
            quantity: h.quantity,
            valueIrr: h.valueIrr,
          })),
          totalValueIrr: totalAmount,
        },
        amountIrr: totalAmount,
        boundary: 'SAFE',
        message: `Portfolio created with ${formatIrr(totalAmount)} - ${holdingsToCreate.length} assets allocated`,
      },
    });

    // Create action log for portfolio creation
    await tx.actionLog.create({
      data: {
        portfolioId: newPortfolio.id,
        actionType: 'PORTFOLIO_CREATED',
        boundary: 'SAFE',
        message: `Portfolio created with ${formatIrr(totalAmount)}`,
        amountIrr: totalAmount,
      },
    });

    // Create individual trade entries for each asset allocation
    for (const holding of holdingsToCreate) {
      await tx.ledgerEntry.create({
        data: {
          portfolioId: newPortfolio.id,
          entryType: 'TRADE_BUY',
          assetId: holding.assetId,
          quantity: holding.quantity,
          amountIrr: holding.valueIrr,
          boundary: 'SAFE',
          message: `Initial allocation: Bought ${holding.quantity.toFixed(6)} ${holding.assetId} (${formatIrr(holding.valueIrr)})`,
          beforeSnapshot: {},
          afterSnapshot: {},
        },
      });

      await tx.actionLog.create({
        data: {
          portfolioId: newPortfolio.id,
          actionType: 'TRADE_BUY',
          assetId: holding.assetId,
          boundary: 'SAFE',
          message: `Initial allocation: ${holding.assetId}`,
          amountIrr: holding.valueIrr,
        },
      });
    }

    return newPortfolio;
  });

  return {
    portfolioId: portfolio.id,
    cashIrr: remainingCash,
    targetAllocation,
    holdings: holdingsToCreate.map(h => ({
      assetId: h.assetId,
      quantity: h.quantity,
      valueIrr: h.valueIrr,
    })),
  };
}

function formatIrr(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + ' IRR';
}
