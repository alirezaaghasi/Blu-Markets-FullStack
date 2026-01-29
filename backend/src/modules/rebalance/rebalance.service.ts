// Rebalance Service - HRAM Algorithm Implementation
// Based on PRD Section 19 - HRAM Rebalancing Algorithm

import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';
import { getPortfolioSnapshot, classifyBoundary, getAssetLayer } from '../portfolio/portfolio.service.js';
import { getCurrentPrices } from '../../services/price-fetcher.service.js';
import type {
  AssetId,
  Layer,
  PortfolioSnapshot,
  Boundary,
} from '../../types/domain.js';
import type { RebalancePreviewResponse, RebalanceTrade, GapAnalysis } from '../../types/api.js';
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
  min,
  Decimal,
} from '../../utils/money.js';
import { logger } from '../../utils/logger.js';
import { getLayerAssets, ASSETS_CONFIG } from '../../config/assets.js';
import { getDynamicLayerWeights, type StrategyPreset } from '../../services/intra-layer-balancer.js';

// Rebalance modes per PRD Section 18.3
export type RebalanceMode = 'HOLDINGS_ONLY' | 'HOLDINGS_PLUS_CASH' | 'SMART';

// Strategy presets per PRD Section 18.2
export type RebalanceStrategy = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

// Spread per layer (same as trade)
const SPREAD_BY_LAYER: Record<Layer, number> = {
  FOUNDATION: 0.002,
  GROWTH: 0.003,
  UPSIDE: 0.004,
};

// Minimum trade amount
const MIN_TRADE_AMOUNT = 1_000_000;

// Cooldown period in hours (set to 0 for testing)
const REBALANCE_COOLDOWN_HOURS = 0;

interface LayerHoldings {
  frozen: { assetId: AssetId; quantity: number; valueIrr: number }[];
  unfrozen: { assetId: AssetId; quantity: number; valueIrr: number }[];
  totalValue: number;
  frozenValue: number;
  unfrozenValue: number;
}

interface RebalanceResult {
  trades: RebalanceTrade[];
  beforeAllocation: { foundation: number; growth: number; upside: number };
  afterAllocation: { foundation: number; growth: number; upside: number };
  totalBuyIrr: number;
  totalSellIrr: number;
  canFullyRebalance: boolean;
  residualDrift: number;
  hasLockedCollateral: boolean;
}

export async function checkRebalanceCooldown(userId: string): Promise<{
  canRebalance: boolean;
  lastRebalanceAt: Date | null;
  hoursSinceRebalance: number | null;
  hoursRemaining: number | null;
}> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { userId },
    select: { lastRebalanceAt: true },
  });

  if (!portfolio?.lastRebalanceAt) {
    return {
      canRebalance: true,
      lastRebalanceAt: null,
      hoursSinceRebalance: null,
      hoursRemaining: null,
    };
  }

  const hoursSinceRebalance = (Date.now() - portfolio.lastRebalanceAt.getTime()) / (1000 * 60 * 60);
  const canRebalance = hoursSinceRebalance >= REBALANCE_COOLDOWN_HOURS;
  const hoursRemaining = canRebalance ? null : Math.ceil(REBALANCE_COOLDOWN_HOURS - hoursSinceRebalance);

  return {
    canRebalance,
    lastRebalanceAt: portfolio.lastRebalanceAt,
    hoursSinceRebalance: Math.floor(hoursSinceRebalance),
    hoursRemaining,
  };
}

export async function previewRebalance(
  userId: string,
  mode: RebalanceMode = 'HOLDINGS_ONLY'
): Promise<RebalancePreviewResponse> {
  const snapshot = await getPortfolioSnapshot(userId);
  const prices = await getCurrentPrices();

  // AUDIT FIX #6: Debug logging only in development to prevent sensitive data leaks
  if (process.env.NODE_ENV === 'development' || process.env.REBALANCE_DEBUG === 'true') {
    logger.debug('REBALANCE DEBUG - Snapshot:', {
      currentAllocation: snapshot.allocation,
      targetAllocation: snapshot.targetAllocation,
      cashIrr: snapshot.cashIrr,
      holdingsValueIrr: snapshot.holdingsValueIrr,
      totalValueIrr: snapshot.totalValueIrr,
      driftPct: snapshot.driftPct,
    });
  }

  // Partition holdings by layer and frozen status
  const holdingsByLayer = partitionHoldingsByLayer(snapshot, prices);

  // AUDIT FIX #6: Debug logging only in development
  if (process.env.NODE_ENV === 'development' || process.env.REBALANCE_DEBUG === 'true') {
    logger.debug('REBALANCE DEBUG - Holdings by Layer:', {
      FOUNDATION: { total: holdingsByLayer.FOUNDATION.totalValue, unfrozen: holdingsByLayer.FOUNDATION.unfrozenValue },
      GROWTH: { total: holdingsByLayer.GROWTH.totalValue, unfrozen: holdingsByLayer.GROWTH.unfrozenValue },
      UPSIDE: { total: holdingsByLayer.UPSIDE.totalValue, unfrozen: holdingsByLayer.UPSIDE.unfrozenValue },
    });
  }

  // Calculate gap analysis
  // BUG FIX: When mode is HOLDINGS_PLUS_CASH, calculate gaps based on total portfolio value
  // (holdings + cash) so that all layers appear underweight and cash gets deployed
  const gapAnalysis = calculateGapAnalysis(snapshot, holdingsByLayer, mode);

  // AUDIT FIX #6: Debug logging only in development
  if (process.env.NODE_ENV === 'development' || process.env.REBALANCE_DEBUG === 'true') {
    logger.debug('REBALANCE DEBUG - Gap Analysis:', { gaps: gapAnalysis, mode });
  }

  // Generate rebalance trades
  const result = generateRebalanceTrades(snapshot, holdingsByLayer, gapAnalysis, mode, prices);

  // AUDIT FIX #6: Debug logging only in development
  if (process.env.NODE_ENV === 'development' || process.env.REBALANCE_DEBUG === 'true') {
    logger.debug('REBALANCE DEBUG - Generated Trades:', {
      trades: result.trades,
      totalBuyIrr: result.totalBuyIrr,
      totalSellIrr: result.totalSellIrr,
      afterAllocation: result.afterAllocation,
    });
  }

  // Check if there are any locked collateral
  const hasLockedCollateral = snapshot.holdings.some((h) => h.frozen);

  return {
    trades: result.trades,
    currentAllocation: snapshot.allocation,
    targetAllocation: snapshot.targetAllocation,
    afterAllocation: result.afterAllocation,
    totalBuyIrr: result.totalBuyIrr,
    totalSellIrr: result.totalSellIrr,
    canFullyRebalance: result.canFullyRebalance,
    residualDrift: result.residualDrift,
    hasLockedCollateral,
    gapAnalysis,
  };
}

export async function executeRebalance(
  userId: string,
  mode: RebalanceMode = 'HOLDINGS_ONLY',
  acknowledgedWarning = false
): Promise<{
  success: boolean;
  tradesExecuted: number;
  newAllocation: { foundation: number; growth: number; upside: number };
  ledgerEntryId: string;
  boundary: Boundary;
}> {
  // Check cooldown
  const cooldown = await checkRebalanceCooldown(userId);
  if (!cooldown.canRebalance) {
    throw new AppError(
      'REBALANCE_COOLDOWN',
      `Please wait ${cooldown.hoursRemaining} more hours before rebalancing again`,
      400
    );
  }

  const snapshot = await getPortfolioSnapshot(userId);
  const prices = await getCurrentPrices();

  // Check if rebalance is needed
  if (snapshot.driftPct < 1) {
    throw new AppError('NO_REBALANCE_NEEDED', 'Portfolio is already balanced', 400);
  }

  // Get preview to determine trades
  const preview = await previewRebalance(userId, mode);

  if (preview.trades.length === 0) {
    throw new AppError('NO_TRADES', 'No trades can be executed for rebalancing', 400);
  }

  // Classify boundary
  const beforeStatus = snapshot.status;
  const afterDrift = calculateDriftFromAllocation(preview.afterAllocation, snapshot.targetAllocation);
  const afterStatus = afterDrift <= 5 ? 'BALANCED' : afterDrift <= 10 ? 'SLIGHTLY_OFF' : 'ATTENTION_REQUIRED';
  const boundary = classifyBoundary(beforeStatus, afterStatus, afterDrift < snapshot.driftPct);

  // Require acknowledgment for risky rebalances
  if ((boundary === 'STRUCTURAL' || boundary === 'STRESS') && !acknowledgedWarning) {
    throw new AppError(
      'ACKNOWLEDGMENT_REQUIRED',
      'This rebalance may not fully achieve target allocation due to locked collateral',
      400
    );
  }

  // Execute trades in a transaction
  const portfolio = await prisma.portfolio.findUnique({
    where: { userId },
    include: { holdings: true },
  });

  if (!portfolio) {
    throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
  }

  const result = await prisma.$transaction(async (tx) => {
    // CRITICAL: Re-fetch portfolio and holdings inside transaction
    // to get current frozen status and prevent race conditions with loan creation
    const currentPortfolio = await tx.portfolio.findUnique({
      where: { id: portfolio.id },
      include: { holdings: true },
    });

    if (!currentPortfolio) {
      throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
    }

    let cashIrr = Number(currentPortfolio.cashIrr);
    const holdingsMap = new Map(
      currentPortfolio.holdings.map((h) => [h.assetId, { id: h.id, quantity: Number(h.quantity), frozen: h.frozen }])
    );

    // Execute each trade
    for (const trade of preview.trades) {
      const price = prices.get(trade.assetId as AssetId);
      if (!price) continue;

      const spread = SPREAD_BY_LAYER[getAssetLayer(trade.assetId as AssetId)];

      // MONEY FIX M-02: Use Decimal arithmetic for rebalance trades
      if (trade.side === 'SELL') {
        const holding = holdingsMap.get(trade.assetId);
        if (!holding) continue;

        // CRITICAL: Check frozen status - can't sell collateral
        if (holding.frozen) {
          logger.warn('Skipping frozen asset in rebalance', { assetId: trade.assetId });
          continue;
        }

        const quantityToSellDecimal = roundCrypto(divide(trade.amountIrr, price.priceIrr));
        const newQuantityDecimal = subtract(holding.quantity, quantityToSellDecimal);
        const newQuantity = toNumber(newQuantityDecimal);
        const netProceedsDecimal = roundIrr(multiply(trade.amountIrr, subtract(1, spread)));

        // DIVERSIFICATION PROTECTION: Never delete holdings during rebalance
        // Even if quantity becomes very small, keep the position to maintain diversification
        // Only user-initiated sells should be able to close a position entirely
        if (isLessThan(newQuantityDecimal, 0.00000001)) {
          logger.warn('Rebalance attempted to liquidate position entirely - skipping to preserve diversification', {
            assetId: trade.assetId,
            originalQuantity: holding.quantity,
            attemptedSellQuantity: toNumber(quantityToSellDecimal),
          });
          // Skip this trade rather than delete the holding
          continue;
        } else {
          await tx.holding.update({
            where: { id: holding.id },
            data: { quantity: newQuantity },
          });
          holding.quantity = newQuantity;
        }

        cashIrr = toNumber(roundIrr(add(cashIrr, netProceedsDecimal)));
      } else {
        // BUY
        // Cash guard: ensure sufficient cash after spreads before deduction
        if (isLessThan(cashIrr, trade.amountIrr)) {
          throw new AppError('INSUFFICIENT_FUNDS', 'Insufficient cash after spreads', 400);
        }

        const netAmountDecimal = roundIrr(multiply(trade.amountIrr, subtract(1, spread)));
        const quantityToBuyDecimal = roundCrypto(divide(netAmountDecimal, price.priceIrr));
        const quantityToBuy = toNumber(quantityToBuyDecimal);
        const holding = holdingsMap.get(trade.assetId);

        if (holding) {
          const newQuantityDecimal = add(holding.quantity, quantityToBuyDecimal);
          const newQuantity = toNumber(newQuantityDecimal);
          await tx.holding.update({
            where: { id: holding.id },
            data: { quantity: newQuantity },
          });
          holding.quantity = newQuantity;
        } else {
          const newHolding = await tx.holding.create({
            data: {
              portfolioId: portfolio.id,
              assetId: trade.assetId,
              quantity: quantityToBuy,
              layer: getAssetLayer(trade.assetId as AssetId),
              frozen: false,
            },
          });
          holdingsMap.set(trade.assetId, { id: newHolding.id, quantity: quantityToBuy, frozen: false });
        }

        cashIrr = toNumber(roundIrr(subtract(cashIrr, trade.amountIrr)));
      }
    }

    // Update portfolio cash and last rebalance time
    await tx.portfolio.update({
      where: { id: portfolio.id },
      data: {
        cashIrr,
        lastRebalanceAt: new Date(),
      },
    });

    // Create ledger entry
    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        portfolioId: portfolio.id,
        entryType: 'REBALANCE',
        beforeSnapshot: JSON.parse(JSON.stringify({
          allocation: snapshot.allocation,
          cashIrr: Number(portfolio.cashIrr),
        })),
        afterSnapshot: JSON.parse(JSON.stringify({
          allocation: preview.afterAllocation,
          cashIrr,
        })),
        boundary,
        message: `Rebalanced portfolio (${preview.trades.filter((t) => t.side === 'SELL').length} sells, ${preview.trades.filter((t) => t.side === 'BUY').length} buys)`,
        metadata: JSON.parse(JSON.stringify({
          trades: preview.trades,
          mode,
        })),
      },
    });

    // Create action log
    await tx.actionLog.create({
      data: {
        portfolioId: portfolio.id,
        actionType: 'REBALANCE',
        boundary,
        message: `Rebalanced portfolio`,
      },
    });

    return { ledgerEntryId: ledgerEntry.id, cashIrr };
  });

  return {
    success: true,
    tradesExecuted: preview.trades.length,
    newAllocation: preview.afterAllocation,
    ledgerEntryId: result.ledgerEntryId,
    boundary,
  };
}

// MONEY FIX M-02: Use Decimal arithmetic for holding partitioning
function partitionHoldingsByLayer(
  snapshot: PortfolioSnapshot,
  prices: Map<AssetId, { priceIrr: number }>
): Record<Layer, LayerHoldings> {
  const result: Record<Layer, LayerHoldings> = {
    FOUNDATION: { frozen: [], unfrozen: [], totalValue: 0, frozenValue: 0, unfrozenValue: 0 },
    GROWTH: { frozen: [], unfrozen: [], totalValue: 0, frozenValue: 0, unfrozenValue: 0 },
    UPSIDE: { frozen: [], unfrozen: [], totalValue: 0, frozenValue: 0, unfrozenValue: 0 },
  };

  // DRIFT FIX: Don't include cash in layer totals
  // Cash is tracked separately and available for buying, not part of allocation
  const layerTotals: Record<Layer, { frozen: Decimal; unfrozen: Decimal; total: Decimal }> = {
    FOUNDATION: { frozen: toDecimal(0), unfrozen: toDecimal(0), total: toDecimal(0) },
    GROWTH: { frozen: toDecimal(0), unfrozen: toDecimal(0), total: toDecimal(0) },
    UPSIDE: { frozen: toDecimal(0), unfrozen: toDecimal(0), total: toDecimal(0) },
  };

  for (const holding of snapshot.holdings) {
    const layer = holding.layer as Layer;
    const price = prices.get(holding.assetId as AssetId);
    if (!price) continue;

    const valueIrrDecimal = roundIrr(multiply(holding.quantity, price.priceIrr));
    const valueIrr = toNumber(valueIrrDecimal);
    const item = { assetId: holding.assetId as AssetId, quantity: holding.quantity, valueIrr };

    if (holding.frozen) {
      result[layer].frozen.push(item);
      layerTotals[layer].frozen = add(layerTotals[layer].frozen, valueIrrDecimal);
    } else {
      result[layer].unfrozen.push(item);
      layerTotals[layer].unfrozen = add(layerTotals[layer].unfrozen, valueIrrDecimal);
    }
    layerTotals[layer].total = add(layerTotals[layer].total, valueIrrDecimal);
  }

  // Convert Decimals to numbers for result
  for (const layer of ['FOUNDATION', 'GROWTH', 'UPSIDE'] as Layer[]) {
    result[layer].frozenValue = toNumber(roundIrr(layerTotals[layer].frozen));
    result[layer].unfrozenValue = toNumber(roundIrr(layerTotals[layer].unfrozen));
    result[layer].totalValue = toNumber(roundIrr(layerTotals[layer].total));
  }

  return result;
}

// MONEY FIX M-02: Use Decimal arithmetic for gap analysis
// DRIFT FIX: Use holdings value for gap calculation, not total value (which includes cash)
function calculateGapAnalysis(
  snapshot: PortfolioSnapshot,
  holdingsByLayer: Record<Layer, LayerHoldings>,
  mode: RebalanceMode = 'HOLDINGS_ONLY'
): GapAnalysis[] {
  const layers: Layer[] = ['FOUNDATION', 'GROWTH', 'UPSIDE'];

  // BUG FIX: When mode is HOLDINGS_PLUS_CASH, calculate what each layer SHOULD be
  // if all funds (holdings + cash) were deployed to target allocation.
  // This creates buy gaps for each layer to deploy the cash.
  if (mode === 'HOLDINGS_PLUS_CASH' || mode === 'SMART') {
    const totalValueDecimal = toDecimal(snapshot.totalValueIrr);
    const holdingsValueDecimal = toDecimal(snapshot.holdingsValueIrr);

    return layers.map((layer) => {
      const targetPct = snapshot.targetAllocation[layer.toLowerCase() as keyof typeof snapshot.targetAllocation];
      // Target value if all funds were deployed
      const targetValueDecimal = roundIrr(multiply(divide(targetPct, 100), totalValueDecimal));
      const targetValue = toNumber(targetValueDecimal);
      // Current layer value
      const currentValue = holdingsByLayer[layer].totalValue;
      // Current percentage based on holdings only
      const currentPct = holdingsValueDecimal.greaterThan(0)
        ? toNumber(multiply(divide(currentValue, holdingsValueDecimal), 100))
        : 0;
      // Gap is how much to BUY to reach target (positive = need to buy)
      const gapIrr = targetValue - currentValue;
      const gap = targetPct - currentPct;
      const sellableIrr = holdingsByLayer[layer].unfrozenValue;
      const frozenIrr = holdingsByLayer[layer].frozenValue;

      return {
        layer,
        current: currentPct,
        target: targetPct,
        gap,
        gapIrr,
        sellableIrr,
        frozenIrr,
      };
    });
  }

  // HOLDINGS_ONLY: Use holdings value for gap calculation (original behavior)
  const holdingsValueDecimal = toDecimal(snapshot.holdingsValueIrr);

  return layers.map((layer) => {
    const currentPct = snapshot.allocation[layer.toLowerCase() as keyof typeof snapshot.allocation];
    const targetPct = snapshot.targetAllocation[layer.toLowerCase() as keyof typeof snapshot.targetAllocation];
    const gap = targetPct - currentPct;
    // Gap in IRR is based on holdings value, not total portfolio
    const gapIrrDecimal = roundIrr(multiply(divide(gap, 100), holdingsValueDecimal));
    const gapIrr = toNumber(gapIrrDecimal);
    const sellableIrr = holdingsByLayer[layer].unfrozenValue;
    const frozenIrr = holdingsByLayer[layer].frozenValue;

    return {
      layer,
      current: currentPct,
      target: targetPct,
      gap,
      gapIrr,
      sellableIrr,
      frozenIrr,
    };
  });
}

function generateRebalanceTrades(
  snapshot: PortfolioSnapshot,
  holdingsByLayer: Record<Layer, LayerHoldings>,
  gapAnalysis: GapAnalysis[],
  mode: RebalanceMode,
  prices: Map<AssetId, { priceIrr: number }>
): RebalanceResult {
  const trades: RebalanceTrade[] = [];
  let totalBuyIrr = 0;
  let totalSellIrr = 0;

  // === REBALANCE LOGGING START ===
  logger.info('=== REBALANCE CALCULATION START ===', {
    mode,
    cashIrr: snapshot.cashIrr,
    totalValueIrr: snapshot.totalValueIrr,
    currentAllocation: snapshot.allocation,
    targetAllocation: snapshot.targetAllocation,
  });

  logger.info('Gap Analysis:', {
    gaps: gapAnalysis.map(g => ({
      layer: g.layer,
      currentPct: g.current.toFixed(2),
      targetPct: g.target.toFixed(2),
      gapPct: g.gap.toFixed(2),
      gapIrr: Math.round(g.gapIrr).toLocaleString(),
    })),
  });

  // Find overweight and underweight layers
  // BUG FIX: For HOLDINGS_PLUS_CASH mode, a layer is only "underweight" if:
  // 1. Its gapIrr > 0 (needs more to reach target % of total)
  // 2. AND it's not already overweight by percentage (based on current holdings)
  // This prevents buying into layers that are already over-allocated due to frozen assets
  const useIrrGaps = mode === 'HOLDINGS_PLUS_CASH' || mode === 'SMART';
  const overweight = gapAnalysis.filter((g) =>
    useIrrGaps ? g.gapIrr < -MIN_TRADE_AMOUNT : g.gap < -1
  ); // Need to sell
  const underweight = gapAnalysis.filter((g) => {
    if (useIrrGaps) {
      // Layer is underweight only if:
      // - gapIrr > MIN_TRADE_AMOUNT (needs buying to reach target value)
      // - AND gap > -5 (not already significantly overweight by percentage)
      // This prevents buying Upside when it's 38% of holdings but target is 10%
      return g.gapIrr > MIN_TRADE_AMOUNT && g.gap > -5;
    }
    return g.gap > 1;
  }); // Need to buy

  logger.info('Layer Classification:', {
    overweight: overweight.map(g => ({ layer: g.layer, gapIrr: Math.round(g.gapIrr).toLocaleString() })),
    underweight: underweight.map(g => ({ layer: g.layer, gapIrr: Math.round(g.gapIrr).toLocaleString() })),
  });

  // Calculate total sellable amount from overweight layers
  let totalSellableAmount = 0;
  for (const gap of overweight) {
    const layerKey = gap.layer as Layer;
    const sellable = Math.min(Math.abs(gap.gapIrr), holdingsByLayer[layerKey].unfrozenValue);
    totalSellableAmount += sellable;
  }

  // Include cash if mode allows
  let availableCash = mode === 'HOLDINGS_ONLY' ? 0 : snapshot.cashIrr;

  // Generate SELL trades from overweight layers using pro-rata allocation
  // Per PRD Section 7.3: Sell proportionally from each asset in the layer
  // Track NET proceeds after spread deduction
  let totalNetSellProceeds = 0;

  for (const gap of overweight) {
    const layerKey = gap.layer as Layer;
    const layerHoldings = holdingsByLayer[layerKey];
    const targetSellAmount = Math.min(Math.abs(gap.gapIrr), layerHoldings.unfrozenValue);

    if (targetSellAmount >= MIN_TRADE_AMOUNT) {
      // Generate pro-rata sell trades
      const layerSellTrades = generateLayerSellTrades(
        layerKey,
        targetSellAmount,
        layerHoldings,
        prices
      );

      for (const trade of layerSellTrades) {
        // Calculate net proceeds after spread
        const assetLayer = getAssetLayer(trade.assetId as AssetId);
        const spread = SPREAD_BY_LAYER[assetLayer];
        const netProceeds = trade.amountIrr * (1 - spread);

        trades.push(trade);
        totalSellIrr += trade.amountIrr;
        totalNetSellProceeds += netProceeds;
      }
    }
  }

  // Calculate total available for buys (using NET proceeds after spread)
  const totalAvailableForBuys = totalNetSellProceeds + availableCash;

  // Generate BUY trades for underweight layers using HRAM intra-layer weights
  // Per PRD Section 7.3: Distribute buys according to layer weights
  const totalGapIrr = underweight.reduce((sum, l) => sum + l.gapIrr, 0);

  // BUG FIX: Track remaining cash to ensure we don't exceed available funds
  let remainingCash = totalAvailableForBuys;

  for (const gap of underweight) {
    if (totalGapIrr <= 0 || remainingCash < MIN_TRADE_AMOUNT) continue;

    const layerKey = gap.layer as Layer;
    const proportion = gap.gapIrr / totalGapIrr;
    // Cap layer buy amount to remaining cash
    const layerBuyAmount = Math.min(gap.gapIrr, totalAvailableForBuys * proportion, remainingCash);

    if (layerBuyAmount >= MIN_TRADE_AMOUNT) {
      // Generate intra-layer buy trades according to HRAM weights
      const layerBuyTrades = generateLayerBuyTrades(
        layerKey,
        layerBuyAmount,
        holdingsByLayer[layerKey],
        prices
      );

      for (const trade of layerBuyTrades) {
        // Double-check we don't exceed remaining cash
        if (trade.amountIrr <= remainingCash) {
          trades.push(trade);
          totalBuyIrr += trade.amountIrr;
          remainingCash -= trade.amountIrr;
        }
      }
    }
  }

  logger.info('Inter-layer trades generated:', {
    tradesCount: trades.length,
    totalBuyIrr: Math.round(totalBuyIrr).toLocaleString(),
    totalSellIrr: Math.round(totalSellIrr).toLocaleString(),
    remainingCash: Math.round(remainingCash).toLocaleString(),
    trades: trades.map(t => ({ side: t.side, asset: t.assetId, amount: Math.round(t.amountIrr).toLocaleString(), layer: t.layer })),
  });

  // INTRA-LAYER REBALANCING: Rebalance assets within layers that are at target
  // This handles cases where a layer is at its target % but individual assets
  // within the layer are significantly over/underweight
  const INTRA_LAYER_OVERWEIGHT_THRESHOLD = 0.15; // 15% overweight triggers sell
  const INTRA_LAYER_UNDERWEIGHT_THRESHOLD = 0.10; // 10% underweight triggers buy

  for (const layer of ['FOUNDATION', 'GROWTH', 'UPSIDE'] as Layer[]) {
    const layerHoldings = holdingsByLayer[layer];
    const layerTotal = layerHoldings.frozen.reduce((sum, h) => sum + h.valueIrr, 0) +
                       layerHoldings.unfrozen.reduce((sum, h) => sum + h.valueIrr, 0);

    if (layerTotal < MIN_TRADE_AMOUNT) continue;

    // Get target weights for this layer
    const layerWeights = getDynamicLayerWeights(layer, 'BALANCED');
    const layerAssets = getLayerAssets(layer);

    // Calculate current weights within layer
    const assetValues: Record<string, number> = {};
    for (const h of [...layerHoldings.frozen, ...layerHoldings.unfrozen]) {
      assetValues[h.assetId] = (assetValues[h.assetId] || 0) + h.valueIrr;
    }

    // Find overweight and underweight assets WITHIN this layer
    const intraOverweight: { assetId: string; excess: number; currentWeight: number; targetWeight: number }[] = [];
    const intraUnderweight: { assetId: string; deficit: number; currentWeight: number; targetWeight: number }[] = [];

    for (const assetId of layerAssets) {
      const currentValue = assetValues[assetId] || 0;
      const currentWeight = layerTotal > 0 ? currentValue / layerTotal : 0;
      const targetWeight = layerWeights[assetId] || 0;
      const diff = currentWeight - targetWeight;

      if (diff > INTRA_LAYER_OVERWEIGHT_THRESHOLD) {
        // This asset is > 15% overweight within its layer
        const excessValue = (diff - 0.05) * layerTotal; // Sell down to 5% above target
        intraOverweight.push({ assetId, excess: excessValue, currentWeight, targetWeight });
      } else if (diff < -INTRA_LAYER_UNDERWEIGHT_THRESHOLD) {
        // This asset is > 10% underweight within its layer
        const deficitValue = (-diff - 0.05) * layerTotal; // Buy up to 5% below target
        intraUnderweight.push({ assetId, deficit: deficitValue, currentWeight, targetWeight });
      }
    }

    // Log intra-layer analysis
    logger.info(`Intra-layer analysis for ${layer}:`, {
      layerTotal: Math.round(layerTotal).toLocaleString(),
      overweight: intraOverweight.map(a => ({
        asset: a.assetId,
        current: (a.currentWeight * 100).toFixed(1) + '%',
        target: (a.targetWeight * 100).toFixed(1) + '%',
        excess: Math.round(a.excess).toLocaleString(),
      })),
      underweight: intraUnderweight.map(a => ({
        asset: a.assetId,
        current: (a.currentWeight * 100).toFixed(1) + '%',
        target: (a.targetWeight * 100).toFixed(1) + '%',
        deficit: Math.round(a.deficit).toLocaleString(),
      })),
    });

    // If we have both overweight and underweight assets in this layer, rebalance
    if (intraOverweight.length > 0 && intraUnderweight.length > 0) {
      // Calculate total excess to sell
      const totalExcess = intraOverweight.reduce((sum, a) => sum + a.excess, 0);
      const totalDeficit = intraUnderweight.reduce((sum, a) => sum + a.deficit, 0);

      // Account for spread when selling
      const spread = SPREAD_BY_LAYER[layer];
      const netExcessAfterSpread = totalExcess * (1 - spread);

      // Limit buys to available proceeds
      const availableForIntraBuys = Math.min(netExcessAfterSpread, totalDeficit);

      if (availableForIntraBuys >= MIN_TRADE_AMOUNT) {
        // Generate SELL trades for overweight assets
        for (const asset of intraOverweight) {
          const sellAmount = Math.min(asset.excess, totalExcess);
          if (sellAmount >= MIN_TRADE_AMOUNT) {
            // Check if asset is frozen
            const frozenHolding = layerHoldings.frozen.find(h => h.assetId === asset.assetId);
            const unfrozenHolding = layerHoldings.unfrozen.find(h => h.assetId === asset.assetId);

            if (unfrozenHolding && unfrozenHolding.valueIrr >= sellAmount) {
              trades.push({
                side: 'SELL',
                assetId: asset.assetId as AssetId,
                amountIrr: Math.round(sellAmount),
                layer,
              });
              totalSellIrr += sellAmount;
            }
          }
        }

        // Generate BUY trades for underweight assets
        const buyRatio = availableForIntraBuys / totalDeficit;
        for (const asset of intraUnderweight) {
          const buyAmount = Math.round(asset.deficit * buyRatio);
          if (buyAmount >= MIN_TRADE_AMOUNT && prices.has(asset.assetId as AssetId)) {
            trades.push({
              side: 'BUY',
              assetId: asset.assetId as AssetId,
              amountIrr: buyAmount,
              layer,
            });
            totalBuyIrr += buyAmount;
          }
        }
      }
    }
  }

  // Calculate after allocation
  const afterAllocation = calculateAfterAllocation(snapshot, trades, prices);

  // Calculate residual drift
  const residualDrift = calculateDriftFromAllocation(afterAllocation, snapshot.targetAllocation);

  // Check if we can fully rebalance
  const canFullyRebalance = residualDrift < 2;

  // Check for locked collateral
  const hasLockedCollateral = snapshot.holdings.some((h) => h.frozen);

  logger.info('=== REBALANCE CALCULATION COMPLETE ===', {
    totalTrades: trades.length,
    totalBuyIrr: Math.round(totalBuyIrr).toLocaleString(),
    totalSellIrr: Math.round(totalSellIrr).toLocaleString(),
    beforeAllocation: snapshot.allocation,
    afterAllocation,
    residualDrift: residualDrift.toFixed(2) + '%',
    canFullyRebalance,
    allTrades: trades.map(t => ({ side: t.side, asset: t.assetId, amount: Math.round(t.amountIrr).toLocaleString(), layer: t.layer })),
  });

  return {
    trades,
    beforeAllocation: snapshot.allocation,
    afterAllocation,
    totalBuyIrr,
    totalSellIrr,
    canFullyRebalance,
    residualDrift,
    hasLockedCollateral,
  };
}

/**
 * Generate BUY trades for a layer using intra-layer HRAM weights (PRD Section 7.3)
 * Distributes buy amount across assets proportionally to their target layer weights
 */
function generateLayerBuyTrades(
  layer: Layer,
  layerBuyAmount: number,
  layerHoldings: LayerHoldings,
  prices: Map<AssetId, { priceIrr: number }>,
  strategy: StrategyPreset = 'BALANCED'
): RebalanceTrade[] {
  const trades: RebalanceTrade[] = [];
  // Use HRAM dynamic weights instead of static weights
  const layerWeights = getDynamicLayerWeights(layer, strategy);
  const layerAssets = getLayerAssets(layer);

  // Calculate current weights within layer
  const currentValues: Record<string, number> = {};
  let currentLayerTotal = 0;

  for (const h of [...layerHoldings.frozen, ...layerHoldings.unfrozen]) {
    currentValues[h.assetId] = h.valueIrr;
    currentLayerTotal += h.valueIrr;
  }

  // After buying, layer will be worth: currentLayerTotal + layerBuyAmount
  const afterLayerValue = currentLayerTotal + layerBuyAmount;

  // Calculate how much each asset should be worth after rebalancing
  // and how much we need to buy to get there
  for (const assetId of layerAssets) {
    const targetWeight = layerWeights[assetId] || 0;
    const targetValue = afterLayerValue * targetWeight;
    const currentValue = currentValues[assetId] || 0;
    const buyNeeded = targetValue - currentValue;

    // Only buy if we need more than minimum trade amount
    if (buyNeeded >= MIN_TRADE_AMOUNT) {
      const price = prices.get(assetId);
      if (!price) continue;

      trades.push({
        side: 'BUY',
        assetId,
        amountIrr: Math.round(buyNeeded),
        layer,
      });
    }
  }

  // If no individual trades meet minimum, buy the highest-weight asset
  if (trades.length === 0 && layerBuyAmount >= MIN_TRADE_AMOUNT) {
    // Find asset with highest target weight that has a price
    const sortedAssets = layerAssets
      .filter(a => prices.has(a))
      .sort((a, b) => (layerWeights[b] || 0) - (layerWeights[a] || 0));

    if (sortedAssets.length > 0) {
      trades.push({
        side: 'BUY',
        assetId: sortedAssets[0],
        amountIrr: Math.round(layerBuyAmount),
        layer,
      });
    }
  }

  return trades;
}

// DIVERSIFICATION PROTECTION: Never sell more than this percentage of any single asset
// This prevents rebalancing from liquidating entire positions and destroying diversification
const MAX_SELL_PERCENTAGE_PER_ASSET = 0.80; // 80% max - always keep at least 20%

// Minimum value to keep per asset to maintain layer diversification
const MIN_ASSET_VALUE_TO_KEEP = 5_000_000; // 5M IRR minimum position

/**
 * Generate SELL trades for a layer using pro-rata allocation (PRD Section 7.3)
 * Sells from each asset proportionally to its current value within the layer
 *
 * DIVERSIFICATION FIX: Never sell more than 80% of any single asset to maintain
 * layer diversification. Preferentially sells from larger positions.
 */
function generateLayerSellTrades(
  layer: Layer,
  layerSellAmount: number,
  layerHoldings: LayerHoldings,
  prices: Map<AssetId, { priceIrr: number }>
): RebalanceTrade[] {
  const trades: RebalanceTrade[] = [];
  let remainingToSell = layerSellAmount;

  // Sort unfrozen holdings by value (largest first - sell more from bigger positions)
  const sortedHoldings = [...layerHoldings.unfrozen].sort((a, b) => b.valueIrr - a.valueIrr);
  const layerTotal = sortedHoldings.reduce((sum, h) => sum + h.valueIrr, 0);

  if (layerTotal <= 0) return trades;

  // First pass: Calculate max sellable per asset while maintaining diversification
  const maxSellable: Map<string, number> = new Map();
  for (const holding of sortedHoldings) {
    // Max we can sell is 80% of value OR value minus minimum position, whichever is smaller
    const maxByPercentage = holding.valueIrr * MAX_SELL_PERCENTAGE_PER_ASSET;
    const maxByMinPosition = Math.max(0, holding.valueIrr - MIN_ASSET_VALUE_TO_KEEP);
    maxSellable.set(holding.assetId, Math.min(maxByPercentage, maxByMinPosition));
  }

  // Second pass: Distribute sells proportionally but respect max limits
  // We may need multiple iterations if some assets hit their cap
  let iterations = 0;
  const maxIterations = 5;

  while (remainingToSell >= MIN_TRADE_AMOUNT && iterations < maxIterations) {
    iterations++;
    const eligibleHoldings = sortedHoldings.filter(h => {
      const maxForAsset = maxSellable.get(h.assetId) || 0;
      const alreadySelling = trades.find(t => t.assetId === h.assetId)?.amountIrr || 0;
      return maxForAsset - alreadySelling >= MIN_TRADE_AMOUNT;
    });

    if (eligibleHoldings.length === 0) break;

    const eligibleTotal = eligibleHoldings.reduce((sum, h) => {
      const maxForAsset = maxSellable.get(h.assetId) || 0;
      const alreadySelling = trades.find(t => t.assetId === h.assetId)?.amountIrr || 0;
      return sum + (maxForAsset - alreadySelling);
    }, 0);

    if (eligibleTotal <= 0) break;

    let soldThisRound = 0;
    for (const holding of eligibleHoldings) {
      if (remainingToSell < MIN_TRADE_AMOUNT) break;

      const maxForAsset = maxSellable.get(holding.assetId) || 0;
      const alreadySelling = trades.find(t => t.assetId === holding.assetId)?.amountIrr || 0;
      const remainingCapacity = maxForAsset - alreadySelling;

      // Pro-rata based on remaining sellable capacity
      const proportion = remainingCapacity / eligibleTotal;
      const sellAmount = Math.min(
        remainingToSell * proportion,
        remainingCapacity,
        remainingToSell
      );

      if (sellAmount >= MIN_TRADE_AMOUNT) {
        const existingTrade = trades.find(t => t.assetId === holding.assetId);
        if (existingTrade) {
          existingTrade.amountIrr += Math.round(sellAmount);
        } else {
          trades.push({
            side: 'SELL',
            assetId: holding.assetId,
            amountIrr: Math.round(sellAmount),
            layer,
          });
        }
        remainingToSell -= sellAmount;
        soldThisRound += sellAmount;
      }
    }

    // If we couldn't sell anything this round, break to prevent infinite loop
    if (soldThisRound < MIN_TRADE_AMOUNT) break;
  }

  // Log warning if we couldn't sell enough due to diversification protection
  if (remainingToSell >= MIN_TRADE_AMOUNT) {
    logger.warn('Rebalance: Could not fully reduce layer due to diversification protection', {
      layer,
      targetSell: layerSellAmount,
      actualSell: layerSellAmount - remainingToSell,
      shortfall: remainingToSell,
    });
  }

  return trades;
}

// MONEY FIX M-02: Use Decimal arithmetic for after allocation calculation
// DRIFT FIX: Calculate allocation based on HOLDINGS VALUE ONLY
// Cash is tracked separately and doesn't affect layer allocation percentages
function calculateAfterAllocation(
  snapshot: PortfolioSnapshot,
  trades: RebalanceTrade[],
  prices: Map<AssetId, { priceIrr: number }>
): { foundation: number; growth: number; upside: number } {
  // Track holdings values by layer (NOT including cash)
  const layerValues = {
    FOUNDATION: toDecimal(0),
    GROWTH: toDecimal(0),
    UPSIDE: toDecimal(0),
  };

  // Track cash separately
  let cashDecimal = toDecimal(snapshot.cashIrr);

  // Add holdings values (not including cash)
  for (const holding of snapshot.holdings) {
    const price = prices.get(holding.assetId as AssetId);
    if (price) {
      const valueDecimal = multiply(holding.quantity, price.priceIrr);
      layerValues[holding.layer as Layer] = add(layerValues[holding.layer as Layer], valueDecimal);
    }
  }

  // Apply trades - cash changes but doesn't affect layer allocation
  for (const trade of trades) {
    const spread = SPREAD_BY_LAYER[trade.layer as Layer];
    if (trade.side === 'SELL') {
      const netProceedsDecimal = roundIrr(multiply(trade.amountIrr, subtract(1, spread)));
      layerValues[trade.layer as Layer] = subtract(layerValues[trade.layer as Layer], trade.amountIrr);
      // Proceeds go to cash (not Foundation layer holdings)
      cashDecimal = add(cashDecimal, netProceedsDecimal);
    } else {
      const netAmountDecimal = roundIrr(multiply(trade.amountIrr, subtract(1, spread)));
      layerValues[trade.layer as Layer] = add(layerValues[trade.layer as Layer], netAmountDecimal);
      // Cash used for purchase
      cashDecimal = subtract(cashDecimal, trade.amountIrr);
    }
  }

  // DRIFT FIX: Total is HOLDINGS only, not including cash
  const holdingsTotalDecimal = add(layerValues.FOUNDATION, layerValues.GROWTH, layerValues.UPSIDE);

  return {
    foundation: isGreaterThan(holdingsTotalDecimal, 0) ? toNumber(multiply(divide(layerValues.FOUNDATION, holdingsTotalDecimal), 100)) : 0,
    growth: isGreaterThan(holdingsTotalDecimal, 0) ? toNumber(multiply(divide(layerValues.GROWTH, holdingsTotalDecimal), 100)) : 0,
    upside: isGreaterThan(holdingsTotalDecimal, 0) ? toNumber(multiply(divide(layerValues.UPSIDE, holdingsTotalDecimal), 100)) : 0,
  };
}

function calculateDriftFromAllocation(
  current: { foundation: number; growth: number; upside: number },
  target: { foundation: number; growth: number; upside: number }
): number {
  const foundationDrift = Math.abs(current.foundation - target.foundation);
  const growthDrift = Math.abs(current.growth - target.growth);
  const upsideDrift = Math.abs(current.upside - target.upside);

  return Math.max(foundationDrift, growthDrift, upsideDrift);
}
