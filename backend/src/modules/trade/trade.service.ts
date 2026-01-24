import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';
import { getAssetPrice, getCurrentFxRate } from '../../services/price-fetcher.service.js';
import {
  getPortfolioSnapshot,
  getAssetLayer,
  classifyBoundary,
} from '../portfolio/portfolio.service.js';
import type {
  AssetId,
  TradeAction,
  Boundary,
  TargetAllocation,
  Layer,
} from '../../types/domain.js';
import type { TradePreviewResponse, TradeExecuteResponse } from '../../types/api.js';
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
  isLessThanOrEqual,
  Decimal,
} from '../../utils/money.js';

// Spread rates per PRD Section 21 - Layer-based
const SPREAD_BY_LAYER: Record<Layer, number> = {
  FOUNDATION: 0.0015, // 0.15%
  GROWTH: 0.003,      // 0.30%
  UPSIDE: 0.006,      // 0.60%
};

function getSpreadForAsset(assetId: AssetId): number {
  const layer = getAssetLayer(assetId);
  return SPREAD_BY_LAYER[layer];
}

// Friction copy per boundary type
const FRICTION_COPY: Record<Boundary, string> = {
  SAFE: '',
  DRIFT: 'This moves you slightly away from your target. You can rebalance later.',
  STRUCTURAL: 'This significantly impacts your portfolio balance. Consider the implications.',
  STRESS: 'Warning: This trade pushes your portfolio into a concerning state. Are you sure?',
};

export async function previewTrade(
  userId: string,
  action: TradeAction,
  assetId: AssetId,
  amountIrr: number
): Promise<TradePreviewResponse> {
  // Get current portfolio state
  const snapshot = await getPortfolioSnapshot(userId);

  // Validate minimum trade
  if (amountIrr < 1000000) {
    return {
      valid: false,
      preview: { action, assetId, quantity: 0, amountIrr, priceIrr: 0, spread: 0, spreadAmountIrr: 0 },
      allocation: {
        before: snapshot.allocation,
        target: snapshot.targetAllocation,
        after: snapshot.allocation,
      },
      boundary: 'SAFE',
      movesToward: false,
      error: 'Minimum trade amount is 1,000,000 IRR',
    };
  }

  // Get asset price
  const price = await getAssetPrice(assetId);
  if (!price) {
    return {
      valid: false,
      preview: { action, assetId, quantity: 0, amountIrr, priceIrr: 0, spread: 0, spreadAmountIrr: 0 },
      allocation: {
        before: snapshot.allocation,
        target: snapshot.targetAllocation,
        after: snapshot.allocation,
      },
      boundary: 'SAFE',
      movesToward: false,
      error: 'Price not available for this asset',
    };
  }

  // MONEY FIX M-02: Use Decimal arithmetic for money calculations
  // Calculate trade details with layer-based spread
  const spread = getSpreadForAsset(assetId);
  const amountDecimal = toDecimal(amountIrr);
  const spreadAmountDecimal = roundIrr(multiply(amountDecimal, spread));
  const spreadAmountIrr = toNumber(spreadAmountDecimal);
  const effectiveAmountDecimal = action === 'BUY'
    ? subtract(amountDecimal, spreadAmountDecimal)
    : amountDecimal;
  const quantityDecimal = roundCrypto(divide(effectiveAmountDecimal, price.priceIrr));
  const quantity = toNumber(quantityDecimal);

  // Validate sufficient funds/holdings
  if (action === 'BUY' && amountIrr > snapshot.cashIrr) {
    return {
      valid: false,
      preview: {
        action,
        assetId,
        quantity,
        amountIrr,
        priceIrr: price.priceIrr,
        spread: getSpreadForAsset(assetId),
        spreadAmountIrr,
      },
      allocation: {
        before: snapshot.allocation,
        target: snapshot.targetAllocation,
        after: snapshot.allocation,
      },
      boundary: 'SAFE',
      movesToward: false,
      error: 'Insufficient cash balance',
    };
  }

  if (action === 'SELL') {
    const holding = snapshot.holdings.find((h) => h.assetId === assetId);
    if (!holding || holding.quantity < quantity) {
      return {
        valid: false,
        preview: {
          action,
          assetId,
          quantity,
          amountIrr,
          priceIrr: price.priceIrr,
          spread: getSpreadForAsset(assetId),
          spreadAmountIrr,
        },
        allocation: {
          before: snapshot.allocation,
          target: snapshot.targetAllocation,
          after: snapshot.allocation,
        },
        boundary: 'SAFE',
        movesToward: false,
        error: 'Insufficient holdings',
      };
    }

    // Check if asset is frozen (collateral)
    if (holding.frozen) {
      return {
        valid: false,
        preview: {
          action,
          assetId,
          quantity,
          amountIrr,
          priceIrr: price.priceIrr,
          spread: getSpreadForAsset(assetId),
          spreadAmountIrr,
        },
        allocation: {
          before: snapshot.allocation,
          target: snapshot.targetAllocation,
          after: snapshot.allocation,
        },
        boundary: 'SAFE',
        movesToward: false,
        error: 'Asset is frozen as loan collateral',
      };
    }
  }

  // Calculate after allocation
  const afterAllocation = calculateAfterAllocation(
    snapshot,
    action,
    assetId,
    amountIrr,
    price.priceIrr
  );

  // Determine if moving toward target
  const movesToward = isMovingTowardTarget(
    snapshot.allocation,
    afterAllocation,
    snapshot.targetAllocation
  );

  // Classify boundary
  const beforeStatus = determineStatusFromAllocation(snapshot.allocation, snapshot.targetAllocation);
  const afterStatus = determineStatusFromAllocation(afterAllocation, snapshot.targetAllocation);
  const boundary = classifyBoundary(beforeStatus, afterStatus, movesToward);

  return {
    valid: true,
    preview: {
      action,
      assetId,
      quantity,
      amountIrr,
      priceIrr: price.priceIrr,
      spread,
      spreadAmountIrr,
    },
    allocation: {
      before: snapshot.allocation,
      target: snapshot.targetAllocation,
      after: afterAllocation,
    },
    boundary,
    frictionCopy: FRICTION_COPY[boundary] || undefined,
    movesToward,
  };
}

export async function executeTrade(
  userId: string,
  action: TradeAction,
  assetId: AssetId,
  amountIrr: number,
  acknowledgedWarning: boolean = false
): Promise<TradeExecuteResponse> {
  // Preview first to validate
  const preview = await previewTrade(userId, action, assetId, amountIrr);

  if (!preview.valid) {
    throw new AppError('VALIDATION_ERROR', preview.error || 'Trade not valid', 400);
  }

  // Require acknowledgment for high-risk trades
  if ((preview.boundary === 'STRUCTURAL' || preview.boundary === 'STRESS') && !acknowledgedWarning) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Please acknowledge the warning before proceeding',
      400,
      { boundary: preview.boundary, frictionCopy: preview.frictionCopy }
    );
  }

  // Get portfolio
  const portfolio = await prisma.portfolio.findUnique({
    where: { userId },
    include: { holdings: true },
  });

  if (!portfolio) {
    throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
  }

  const layer = getAssetLayer(assetId);

  // Execute trade within transaction with re-validation
  const result = await prisma.$transaction(async (tx) => {
    // CRITICAL: Re-fetch and validate balances inside transaction to prevent race conditions
    const currentPortfolio = await tx.portfolio.findUnique({
      where: { id: portfolio.id },
      include: { holdings: true },
    });

    if (!currentPortfolio) {
      throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
    }

    // CRITICAL: Re-fetch price inside transaction to ensure we use current price
    // Price may have changed between preview and execution
    const currentPrice = await getAssetPrice(assetId);
    if (!currentPrice) {
      throw new AppError('SERVICE_UNAVAILABLE', 'Current price not available', 503);
    }

    // MONEY FIX M-02: Recalculate trade values with current price using Decimal arithmetic
    const spread = getSpreadForAsset(assetId);
    const amountDecimal = toDecimal(amountIrr);
    const spreadAmountDecimal = roundIrr(multiply(amountDecimal, spread));
    const spreadAmountIrr = toNumber(spreadAmountDecimal);
    const effectiveAmountDecimal = action === 'BUY'
      ? subtract(amountDecimal, spreadAmountDecimal)
      : amountDecimal;
    const quantityDecimal = roundCrypto(divide(effectiveAmountDecimal, currentPrice.priceIrr));
    const quantity = toNumber(quantityDecimal);
    const priceIrr = currentPrice.priceIrr;

    let newCashIrr: number;
    let holdingQuantity: number;

    if (action === 'BUY') {
      // Re-validate cash balance inside transaction
      const currentCash = Number(currentPortfolio.cashIrr);
      if (currentCash < amountIrr) {
        throw new AppError('INSUFFICIENT_CASH', 'Insufficient cash balance (concurrent modification)', 400);
      }

      // MONEY FIX M-02: Deduct cash (including spread) using Decimal
      newCashIrr = toNumber(roundIrr(subtract(currentCash, amountIrr)));

      await tx.portfolio.update({
        where: { id: portfolio.id },
        data: { cashIrr: newCashIrr },
      });

      // Add or update holding
      const existingHolding = currentPortfolio.holdings.find((h) => h.assetId === assetId);

      if (existingHolding) {
        const updatedHolding = await tx.holding.update({
          where: { id: existingHolding.id },
          data: { quantity: { increment: quantity } },
        });
        holdingQuantity = Number(updatedHolding.quantity);
      } else {
        const newHolding = await tx.holding.create({
          data: {
            portfolioId: portfolio.id,
            assetId,
            quantity,
            layer,
            purchaseDate: new Date(),
          },
        });
        holdingQuantity = quantity;
      }
    } else {
      // SELL
      // Re-validate holding inside transaction
      const existingHolding = currentPortfolio.holdings.find((h) => h.assetId === assetId);
      if (!existingHolding) {
        throw new AppError('NOT_FOUND', 'Holding not found', 404);
      }

      const currentQuantity = Number(existingHolding.quantity);
      if (currentQuantity < quantity) {
        throw new AppError('INSUFFICIENT_HOLDINGS', 'Insufficient holdings (concurrent modification)', 400);
      }

      if (existingHolding.frozen) {
        throw new AppError('ASSET_FROZEN', 'Asset is frozen as loan collateral', 400);
      }

      // MONEY FIX M-02: Add cash (minus spread) using Decimal
      const cashReceivedDecimal = subtract(amountIrr, spreadAmountIrr);
      newCashIrr = toNumber(roundIrr(add(currentPortfolio.cashIrr, cashReceivedDecimal)));

      await tx.portfolio.update({
        where: { id: portfolio.id },
        data: { cashIrr: newCashIrr },
      });

      // MONEY FIX M-02: Reduce holding using Decimal
      const newQuantity = toNumber(roundCrypto(subtract(currentQuantity, quantity)));

      if (newQuantity <= 0.00000001) {
        // Remove holding if negligible
        await tx.holding.delete({ where: { id: existingHolding.id } });
        holdingQuantity = 0;
      } else {
        const updatedHolding = await tx.holding.update({
          where: { id: existingHolding.id },
          data: { quantity: newQuantity },
        });
        holdingQuantity = newQuantity;
      }
    }

    // Create ledger entry
    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        portfolioId: portfolio.id,
        entryType: action === 'BUY' ? 'TRADE_BUY' : 'TRADE_SELL',
        beforeSnapshot: {
          cashIrr: Number(portfolio.cashIrr),
          foundation: preview.allocation.before.foundation,
          growth: preview.allocation.before.growth,
          upside: preview.allocation.before.upside,
        },
        afterSnapshot: {
          cashIrr: newCashIrr,
          foundation: preview.allocation.after.foundation,
          growth: preview.allocation.after.growth,
          upside: preview.allocation.after.upside,
        },
        assetId,
        quantity,
        amountIrr,
        boundary: preview.boundary,
        message: `${action === 'BUY' ? 'Bought' : 'Sold'} ${assetId} (${formatIrr(amountIrr)})`,
      },
    });

    // Create action log
    await tx.actionLog.create({
      data: {
        portfolioId: portfolio.id,
        actionType: action === 'BUY' ? 'TRADE_BUY' : 'TRADE_SELL',
        boundary: preview.boundary,
        message: `${action === 'BUY' ? 'Bought' : 'Sold'} ${assetId} (${formatIrr(amountIrr)})`,
        amountIrr,
        assetId,
      },
    });

    return {
      success: true,
      trade: {
        action,
        assetId,
        quantity,
        amountIrr,
        priceIrr,
      },
      newBalance: {
        cashIrr: newCashIrr,
        holdingQuantity,
      },
      boundary: preview.boundary,
      ledgerEntryId: ledgerEntry.id,
    };
  });

  return result;
}

function calculateAfterAllocation(
  snapshot: { allocation: TargetAllocation; totalValueIrr: number; holdings: { assetId: string; valueIrr?: number }[] },
  action: TradeAction,
  assetId: AssetId,
  amountIrr: number,
  priceIrr: number
): TargetAllocation {
  const layer = getAssetLayer(assetId);
  const totalValue = snapshot.totalValueIrr;

  // Guard against division by zero for new/empty portfolios
  if (totalValue <= 0) {
    // For empty portfolios, the first trade defines 100% allocation to that layer
    const zeroAllocation = { foundation: 0, growth: 0, upside: 0 };
    if (action === 'BUY') {
      if (layer === 'FOUNDATION') zeroAllocation.foundation = 100;
      else if (layer === 'GROWTH') zeroAllocation.growth = 100;
      else zeroAllocation.upside = 100;
    }
    return zeroAllocation;
  }

  // MONEY FIX M-02: Use Decimal for allocation calculations
  // Clone current allocation as Decimals
  let foundationDec = toDecimal(snapshot.allocation.foundation);
  let growthDec = toDecimal(snapshot.allocation.growth);
  let upsideDec = toDecimal(snapshot.allocation.upside);

  // Calculate value change for the layer
  const valueChangeDecimal = action === 'BUY' ? toDecimal(amountIrr) : toDecimal(-amountIrr);
  const layerPctChangeDecimal = multiply(divide(valueChangeDecimal, totalValue), 100);

  // Adjust allocation
  if (layer === 'FOUNDATION') {
    foundationDec = add(foundationDec, layerPctChangeDecimal);
  } else if (layer === 'GROWTH') {
    growthDec = add(growthDec, layerPctChangeDecimal);
  } else {
    upsideDec = add(upsideDec, layerPctChangeDecimal);
  }

  // Normalize (ensure sums to ~100%)
  const totalDec = add(foundationDec, growthDec, upsideDec);
  if (isGreaterThan(totalDec, 0)) {
    foundationDec = multiply(divide(foundationDec, totalDec), 100);
    growthDec = multiply(divide(growthDec, totalDec), 100);
    upsideDec = multiply(divide(upsideDec, totalDec), 100);
  }

  return {
    foundation: toNumber(foundationDec),
    growth: toNumber(growthDec),
    upside: toNumber(upsideDec),
  };
}

function isMovingTowardTarget(
  before: TargetAllocation,
  after: TargetAllocation,
  target: TargetAllocation
): boolean {
  const beforeDrift =
    Math.abs(before.foundation - target.foundation) +
    Math.abs(before.growth - target.growth) +
    Math.abs(before.upside - target.upside);

  const afterDrift =
    Math.abs(after.foundation - target.foundation) +
    Math.abs(after.growth - target.growth) +
    Math.abs(after.upside - target.upside);

  return afterDrift < beforeDrift;
}

function determineStatusFromAllocation(
  allocation: TargetAllocation,
  target: TargetAllocation
): 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED' {
  // Per PRD Section 20.1:
  // ATTENTION_REQUIRED: Foundation < 30% OR Upside > 25%
  if (allocation.foundation < 30 || allocation.upside > 25) {
    return 'ATTENTION_REQUIRED';
  }

  const maxDrift = Math.max(
    Math.abs(allocation.foundation - target.foundation),
    Math.abs(allocation.growth - target.growth),
    Math.abs(allocation.upside - target.upside)
  );

  if (maxDrift <= 5) return 'BALANCED';
  if (maxDrift <= 10) return 'SLIGHTLY_OFF';
  return 'ATTENTION_REQUIRED';
}

function formatIrr(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + ' IRR';
}
