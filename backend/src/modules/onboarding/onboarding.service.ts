import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';
import { calculateRiskScore } from '../../services/risk-scoring.service.js';
import { getCurrentPrices } from '../../services/price-fetcher.service.js';
import type { RiskProfile, TargetAllocation, AssetId, Layer } from '../../types/domain.js';
import type { SubmitQuestionnaireInput, RecordConsentInput, InitialFundingInput } from './onboarding.schemas.js';
import {
  toDecimal,
  multiply,
  subtract,
  add,
  divide,
  roundIrr,
  roundCrypto,
  toNumber,
  isGreaterThan,
  isLessThan,
  Decimal,
} from '../../utils/money.js';
import { logger } from '../../utils/logger.js';

// ============================================================
// INITIAL ALLOCATION CONFIGURATION
// All 15 assets allocated across 3 layers per PRD
// ============================================================
const LAYER_ASSETS: Record<Layer, Array<{ assetId: AssetId; weight: number }>> = {
  FOUNDATION: [
    { assetId: 'USDT', weight: 0.40 },           // Tether USD - 40%
    { assetId: 'PAXG', weight: 0.30 },           // PAX Gold - 30%
    { assetId: 'IRR_FIXED_INCOME', weight: 0.30 }, // Fixed Income - 30%
  ],
  GROWTH: [
    { assetId: 'BTC', weight: 0.25 },    // Bitcoin - 25%
    { assetId: 'ETH', weight: 0.20 },    // Ethereum - 20%
    { assetId: 'BNB', weight: 0.15 },    // BNB - 15%
    { assetId: 'XRP', weight: 0.10 },    // XRP - 10%
    { assetId: 'KAG', weight: 0.15 },    // Kinesis Silver - 15%
    { assetId: 'QQQ', weight: 0.15 },    // Nasdaq ETF - 15%
  ],
  UPSIDE: [
    { assetId: 'SOL', weight: 0.20 },    // Solana - 20%
    { assetId: 'TON', weight: 0.18 },    // Toncoin - 18%
    { assetId: 'LINK', weight: 0.18 },   // Chainlink - 18%
    { assetId: 'AVAX', weight: 0.16 },   // Avalanche - 16%
    { assetId: 'MATIC', weight: 0.14 },  // Polygon - 14%
    { assetId: 'ARB', weight: 0.14 },    // Arbitrum - 14%
  ],
};

// Minimum trade amount in IRR (100K IRR - allows diversification for small investments)
// PRD specifies all 15 assets should be allocated, so minimum must be low enough
const MIN_TRADE_AMOUNT_IRR = 100_000;

// FUNDING RULES:
// - Initial Funding: 100% goes to assets, 0% to cash (remaining from rounding is redistributed)
// - Add Funds: 100% goes to cash wallet (user then trades manually)
const CASH_BUFFER_PCT = 0; // 0% - not used, kept for reference

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

  // MONEY FIX M-02: Calculate investable amount using Decimal arithmetic
  const totalAmountDecimal = toDecimal(input.amountIrr);
  const cashBufferDecimal = roundIrr(multiply(totalAmountDecimal, CASH_BUFFER_PCT));
  const investableAmountDecimal = subtract(totalAmountDecimal, cashBufferDecimal);

  // Calculate amount per layer using Decimal
  const foundationAmountDecimal = roundIrr(multiply(investableAmountDecimal, divide(targetAllocation.foundation, 100)));
  const growthAmountDecimal = roundIrr(multiply(investableAmountDecimal, divide(targetAllocation.growth, 100)));
  const upsideAmountDecimal = roundIrr(multiply(investableAmountDecimal, divide(targetAllocation.upside, 100)));

  // Convert to numbers for processing
  const totalAmount = toNumber(totalAmountDecimal);
  const foundationAmount = toNumber(foundationAmountDecimal);
  const growthAmount = toNumber(growthAmountDecimal);
  const upsideAmount = toNumber(upsideAmountDecimal);

  // Prepare holdings to create
  const holdingsToCreate: Array<{
    assetId: string;
    quantity: number;
    layer: Layer;
    valueIrr: number;
  }> = [];

  // MONEY FIX M-02: Process each layer using Decimal arithmetic
  const processLayer = (layerAmount: number, layer: Layer) => {
    const assets = LAYER_ASSETS[layer];
    const layerAmountDecimal = toDecimal(layerAmount);
    for (const asset of assets) {
      const assetAmountDecimal = roundIrr(multiply(layerAmountDecimal, asset.weight));
      const assetAmountIrr = toNumber(assetAmountDecimal);

      // Skip if below minimum trade amount
      if (isLessThan(assetAmountDecimal, MIN_TRADE_AMOUNT_IRR)) continue;

      // Get price for this asset
      const price = prices.get(asset.assetId);
      if (!price || price.priceIrr <= 0) {
        logger.error('Price not available, skipping asset', undefined, { assetId: asset.assetId });
        continue;
      }

      // Calculate quantity using Decimal
      const quantityDecimal = roundCrypto(divide(assetAmountDecimal, price.priceIrr));
      const quantity = toNumber(quantityDecimal);

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

  // BUG-1 FIX: Validate that holdings were created
  // If prices aren't available, no holdings can be created and the money would be lost
  if (holdingsToCreate.length === 0) {
    logger.error('Portfolio creation failed: no holdings could be created (prices not available)', undefined, {
      userId,
      amountIrr: input.amountIrr,
      pricesAvailable: prices.size,
    });
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      'Unable to create portfolio - asset prices are temporarily unavailable. Please try again in a few minutes.',
      503
    );
  }

  // MONEY FIX M-02: Calculate total holdings value using Decimal
  let totalHoldingsValueDecimal = holdingsToCreate.reduce(
    (sum, h) => add(sum, h.valueIrr),
    toDecimal(0)
  );

  // INITIAL FUNDING: 100% goes to assets, 0% to cash
  // Redistribute any remaining amount (from rounding) proportionally to holdings
  let remainingCashDecimal = subtract(totalAmountDecimal, totalHoldingsValueDecimal);

  if (isGreaterThan(remainingCashDecimal, 0) && holdingsToCreate.length > 0) {
    // Distribute remaining cash proportionally to each holding
    const remainingAmount = toNumber(remainingCashDecimal);
    const totalValue = toNumber(totalHoldingsValueDecimal);

    for (const holding of holdingsToCreate) {
      const proportion = holding.valueIrr / totalValue;
      const additionalValue = roundIrr(multiply(remainingAmount, proportion));
      const additionalValueNum = toNumber(additionalValue);

      // Get price to calculate additional quantity
      const price = prices.get(holding.assetId as AssetId);
      if (price && price.priceIrr > 0) {
        const additionalQuantity = toNumber(roundCrypto(divide(additionalValue, price.priceIrr)));
        holding.quantity += additionalQuantity;
        holding.valueIrr += additionalValueNum;
      }
    }

    // Recalculate totals after redistribution
    totalHoldingsValueDecimal = holdingsToCreate.reduce(
      (sum, h) => add(sum, h.valueIrr),
      toDecimal(0)
    );
    remainingCashDecimal = subtract(totalAmountDecimal, totalHoldingsValueDecimal);
  }

  const totalHoldingsValue = toNumber(roundIrr(totalHoldingsValueDecimal));
  // Any tiny remaining due to rounding goes to the first holding
  const remainingCash = 0; // Initial funding: 0% cash

  // Calculate actual allocation percentages using Decimal
  const foundationValueDecimal = holdingsToCreate
    .filter(h => h.layer === 'FOUNDATION')
    .reduce((sum, h) => add(sum, h.valueIrr), toDecimal(0));
  const growthValueDecimal = holdingsToCreate
    .filter(h => h.layer === 'GROWTH')
    .reduce((sum, h) => add(sum, h.valueIrr), toDecimal(0));
  const upsideValueDecimal = holdingsToCreate
    .filter(h => h.layer === 'UPSIDE')
    .reduce((sum, h) => add(sum, h.valueIrr), toDecimal(0));

  const actualFoundationPct = isGreaterThan(totalAmountDecimal, 0)
    ? toNumber(multiply(divide(foundationValueDecimal, totalAmountDecimal), 100))
    : 0;
  const actualGrowthPct = isGreaterThan(totalAmountDecimal, 0)
    ? toNumber(multiply(divide(growthValueDecimal, totalAmountDecimal), 100))
    : 0;
  const actualUpsidePct = isGreaterThan(totalAmountDecimal, 0)
    ? toNumber(multiply(divide(upsideValueDecimal, totalAmountDecimal), 100))
    : 0;

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
