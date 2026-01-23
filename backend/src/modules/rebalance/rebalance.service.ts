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

// Cooldown period in hours
const REBALANCE_COOLDOWN_HOURS = 24;

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

  // Partition holdings by layer and frozen status
  const holdingsByLayer = partitionHoldingsByLayer(snapshot, prices);

  // Calculate gap analysis
  const gapAnalysis = calculateGapAnalysis(snapshot, holdingsByLayer);

  // Generate rebalance trades
  const result = generateRebalanceTrades(snapshot, holdingsByLayer, gapAnalysis, mode, prices);

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
    let cashIrr = Number(portfolio.cashIrr);
    const holdingsMap = new Map(
      portfolio.holdings.map((h) => [h.assetId, { id: h.id, quantity: Number(h.quantity) }])
    );

    // Execute each trade
    for (const trade of preview.trades) {
      const price = prices.get(trade.assetId as AssetId);
      if (!price) continue;

      const spread = SPREAD_BY_LAYER[getAssetLayer(trade.assetId as AssetId)];

      if (trade.side === 'SELL') {
        const holding = holdingsMap.get(trade.assetId);
        if (!holding) continue;

        const quantityToSell = trade.amountIrr / price.priceIrr;
        const newQuantity = holding.quantity - quantityToSell;
        const netProceeds = trade.amountIrr * (1 - spread);

        if (newQuantity < 0.00000001) {
          await tx.holding.delete({ where: { id: holding.id } });
          holdingsMap.delete(trade.assetId);
        } else {
          await tx.holding.update({
            where: { id: holding.id },
            data: { quantity: newQuantity },
          });
          holding.quantity = newQuantity;
        }

        cashIrr += netProceeds;
      } else {
        // BUY
        // Cash guard: ensure sufficient cash after spreads before deduction
        if (cashIrr < trade.amountIrr) {
          throw new AppError('INSUFFICIENT_FUNDS', 'Insufficient cash after spreads', 400);
        }

        const netAmount = trade.amountIrr * (1 - spread);
        const quantityToBuy = netAmount / price.priceIrr;
        const holding = holdingsMap.get(trade.assetId);

        if (holding) {
          const newQuantity = holding.quantity + quantityToBuy;
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
          holdingsMap.set(trade.assetId, { id: newHolding.id, quantity: quantityToBuy });
        }

        cashIrr -= trade.amountIrr;
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

function partitionHoldingsByLayer(
  snapshot: PortfolioSnapshot,
  prices: Map<AssetId, { priceIrr: number }>
): Record<Layer, LayerHoldings> {
  const result: Record<Layer, LayerHoldings> = {
    FOUNDATION: { frozen: [], unfrozen: [], totalValue: 0, frozenValue: 0, unfrozenValue: 0 },
    GROWTH: { frozen: [], unfrozen: [], totalValue: 0, frozenValue: 0, unfrozenValue: 0 },
    UPSIDE: { frozen: [], unfrozen: [], totalValue: 0, frozenValue: 0, unfrozenValue: 0 },
  };

  // Add cash to Foundation (cash is never frozen)
  result.FOUNDATION.unfrozenValue += snapshot.cashIrr;
  result.FOUNDATION.totalValue += snapshot.cashIrr;

  for (const holding of snapshot.holdings) {
    const layer = holding.layer as Layer;
    const price = prices.get(holding.assetId as AssetId);
    if (!price) continue;

    const valueIrr = holding.quantity * price.priceIrr;
    const item = { assetId: holding.assetId as AssetId, quantity: holding.quantity, valueIrr };

    if (holding.frozen) {
      result[layer].frozen.push(item);
      result[layer].frozenValue += valueIrr;
    } else {
      result[layer].unfrozen.push(item);
      result[layer].unfrozenValue += valueIrr;
    }
    result[layer].totalValue += valueIrr;
  }

  return result;
}

function calculateGapAnalysis(
  snapshot: PortfolioSnapshot,
  holdingsByLayer: Record<Layer, LayerHoldings>
): GapAnalysis[] {
  const totalValue = snapshot.totalValueIrr;
  const layers: Layer[] = ['FOUNDATION', 'GROWTH', 'UPSIDE'];

  return layers.map((layer) => {
    const currentPct = snapshot.allocation[layer.toLowerCase() as keyof typeof snapshot.allocation];
    const targetPct = snapshot.targetAllocation[layer.toLowerCase() as keyof typeof snapshot.targetAllocation];
    const gap = targetPct - currentPct;
    const gapIrr = (gap / 100) * totalValue;
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

  // Find overweight and underweight layers
  const overweight = gapAnalysis.filter((g) => g.gap < -1); // Need to sell
  const underweight = gapAnalysis.filter((g) => g.gap > 1); // Need to buy

  // Calculate total sellable amount from overweight layers
  let totalSellableAmount = 0;
  for (const gap of overweight) {
    const layerKey = gap.layer as Layer;
    const sellable = Math.min(Math.abs(gap.gapIrr), holdingsByLayer[layerKey].unfrozenValue);
    totalSellableAmount += sellable;
  }

  // Include cash if mode allows
  let availableCash = mode === 'HOLDINGS_ONLY' ? 0 : snapshot.cashIrr;

  // Generate SELL trades from overweight layers (unfrozen only)
  for (const gap of overweight) {
    const layerKey = gap.layer as Layer;
    const layerHoldings = holdingsByLayer[layerKey];
    const targetSellAmount = Math.abs(gap.gapIrr);
    let remainingToSell = targetSellAmount;

    // Sort unfrozen holdings by value (sell largest first)
    const sortedHoldings = [...layerHoldings.unfrozen].sort((a, b) => b.valueIrr - a.valueIrr);

    for (const holding of sortedHoldings) {
      if (remainingToSell <= MIN_TRADE_AMOUNT) break;

      const sellAmount = Math.min(holding.valueIrr, remainingToSell);
      if (sellAmount >= MIN_TRADE_AMOUNT) {
        trades.push({
          side: 'SELL',
          assetId: holding.assetId,
          amountIrr: Math.round(sellAmount),
          layer: gap.layer,
        });
        totalSellIrr += sellAmount;
        remainingToSell -= sellAmount;
      }
    }
  }

  // Calculate total available for buys
  const totalAvailableForBuys = totalSellIrr + availableCash;

  // Generate BUY trades for underweight layers
  // Distribute proportionally to the gap
  const totalGapIrr = underweight.reduce((sum, l) => sum + l.gapIrr, 0);

  for (const gap of underweight) {
    if (totalGapIrr <= 0) continue;

    const layerKey = gap.layer as Layer;
    const proportion = gap.gapIrr / totalGapIrr;
    const buyAmount = Math.min(gap.gapIrr, totalAvailableForBuys * proportion);

    if (buyAmount >= MIN_TRADE_AMOUNT) {
      // Choose asset to buy in this layer (prefer largest existing holding or default)
      const assetToBuy = selectAssetToBuy(layerKey, holdingsByLayer[layerKey], prices);

      trades.push({
        side: 'BUY',
        assetId: assetToBuy,
        amountIrr: Math.round(buyAmount),
        layer: gap.layer,
      });
      totalBuyIrr += buyAmount;
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

function selectAssetToBuy(
  layer: Layer,
  layerHoldings: LayerHoldings,
  prices: Map<AssetId, { priceIrr: number }>
): AssetId {
  // Default assets per layer
  const defaultAssets: Record<Layer, AssetId> = {
    FOUNDATION: 'USDT',
    GROWTH: 'BTC',
    UPSIDE: 'SOL',
  };

  // If user has existing holdings in this layer, prefer adding to largest
  const existingAssets = [...layerHoldings.frozen, ...layerHoldings.unfrozen];
  if (existingAssets.length > 0) {
    const sorted = existingAssets.sort((a, b) => b.valueIrr - a.valueIrr);
    return sorted[0].assetId;
  }

  return defaultAssets[layer];
}

function calculateAfterAllocation(
  snapshot: PortfolioSnapshot,
  trades: RebalanceTrade[],
  prices: Map<AssetId, { priceIrr: number }>
): { foundation: number; growth: number; upside: number } {
  // Start with current values
  const layerValues = {
    FOUNDATION: snapshot.cashIrr,
    GROWTH: 0,
    UPSIDE: 0,
  };

  // Add holdings values
  for (const holding of snapshot.holdings) {
    const price = prices.get(holding.assetId as AssetId);
    if (price) {
      layerValues[holding.layer as Layer] += holding.quantity * price.priceIrr;
    }
  }

  // Apply trades
  for (const trade of trades) {
    const spread = SPREAD_BY_LAYER[trade.layer as Layer];
    if (trade.side === 'SELL') {
      const netProceeds = trade.amountIrr * (1 - spread);
      layerValues[trade.layer as Layer] -= trade.amountIrr;
      // Proceeds go to Foundation (cash)
      layerValues.FOUNDATION += netProceeds;
    } else {
      const netAmount = trade.amountIrr * (1 - spread);
      layerValues[trade.layer as Layer] += netAmount;
      // Cash used from Foundation
      layerValues.FOUNDATION -= trade.amountIrr;
    }
  }

  const total = layerValues.FOUNDATION + layerValues.GROWTH + layerValues.UPSIDE;

  return {
    foundation: total > 0 ? (layerValues.FOUNDATION / total) * 100 : 0,
    growth: total > 0 ? (layerValues.GROWTH / total) * 100 : 0,
    upside: total > 0 ? (layerValues.UPSIDE / total) * 100 : 0,
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
