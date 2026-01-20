// Trade Validation Utilities
// Based on PRD Section 21 - Trading Rules

import { AssetId, Layer, Boundary, TargetLayerPct, Holding, TradePreview, ValidationResult } from '../types';
import { ASSETS, LAYER_COLORS } from '../constants/assets';
import { MIN_TRADE_AMOUNT, SPREAD_BY_LAYER, LAYER_CONSTRAINTS, DRIFT_TOLERANCE } from '../constants/business';

// Validate buy trade
export const validateBuyTrade = (
  amountIRR: number,
  cashIRR: number,
  assetId: AssetId
): ValidationResult => {
  const errors: string[] = [];

  if (amountIRR <= 0) {
    errors.push('Amount must be greater than zero');
  }

  if (amountIRR < MIN_TRADE_AMOUNT) {
    errors.push(`Minimum trade amount is ${MIN_TRADE_AMOUNT.toLocaleString()} IRR`);
  }

  if (cashIRR < amountIRR) {
    errors.push('Insufficient cash balance');
  }

  if (!ASSETS[assetId]) {
    errors.push('Invalid asset');
  }

  return {
    ok: errors.length === 0,
    errors,
    meta: {
      required: amountIRR,
      available: cashIRR,
    },
  };
};

// Validate sell trade
export const validateSellTrade = (
  amountIRR: number,
  holding: Holding | undefined,
  holdingValueIRR: number
): ValidationResult => {
  const errors: string[] = [];

  if (amountIRR <= 0) {
    errors.push('Amount must be greater than zero');
  }

  if (amountIRR < MIN_TRADE_AMOUNT) {
    errors.push(`Minimum trade amount is ${MIN_TRADE_AMOUNT.toLocaleString()} IRR`);
  }

  if (!holding) {
    errors.push('You do not hold this asset');
  } else if (holding.frozen) {
    errors.push('This asset is locked as loan collateral');
  }

  if (holdingValueIRR < amountIRR) {
    errors.push('Insufficient holding value');
  }

  return {
    ok: errors.length === 0,
    errors,
    meta: {
      required: amountIRR,
      available: holdingValueIRR,
    },
  };
};

// Calculate spread for trade
export const calculateSpread = (assetId: AssetId): number => {
  const asset = ASSETS[assetId];
  return SPREAD_BY_LAYER[asset.layer];
};

// Calculate net amount after spread
export const calculateNetAmount = (
  amountIRR: number,
  side: 'BUY' | 'SELL',
  assetId: AssetId
): number => {
  const spread = calculateSpread(assetId);
  if (side === 'BUY') {
    // User pays spread on buys
    return amountIRR * (1 - spread);
  } else {
    // User receives less on sells
    return amountIRR * (1 - spread);
  }
};

// Calculate layer percentages from holdings
export const calculateLayerPercentages = (
  holdings: Holding[],
  holdingValues: Map<string, number>,
  cashIRR: number
): TargetLayerPct => {
  const layerValues: Record<Layer, number> = {
    FOUNDATION: 0,
    GROWTH: 0,
    UPSIDE: 0,
  };

  let totalHoldingsValue = 0;
  holdings.forEach((h) => {
    const value = holdingValues.get(h.assetId) || 0;
    layerValues[h.layer] += value;
    totalHoldingsValue += value;
  });

  // Cash is considered part of Foundation
  layerValues.FOUNDATION += cashIRR;
  const totalValue = totalHoldingsValue + cashIRR;

  if (totalValue === 0) {
    return { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  }

  return {
    FOUNDATION: layerValues.FOUNDATION / totalValue,
    GROWTH: layerValues.GROWTH / totalValue,
    UPSIDE: layerValues.UPSIDE / totalValue,
  };
};

// Classify boundary based on allocation drift
export const classifyBoundary = (
  before: TargetLayerPct,
  after: TargetLayerPct,
  target: TargetLayerPct
): Boundary => {
  const beforeDrift = calculateTotalDrift(before, target);
  const afterDrift = calculateTotalDrift(after, target);

  // Check if this trade makes things worse
  const driftIncrease = afterDrift - beforeDrift;

  // Check foundation hard minimum
  const foundationHardMin = LAYER_CONSTRAINTS.FOUNDATION.hardMin || 0.30;
  if (after.FOUNDATION < foundationHardMin) {
    return 'STRESS';
  }

  // Check upside hard maximum
  const upsideHardMax = LAYER_CONSTRAINTS.UPSIDE.hardMax || 0.25;
  if (after.UPSIDE > upsideHardMax) {
    return 'STRESS';
  }

  // If drift increases significantly
  if (driftIncrease > 0.10) {
    return 'STRESS';
  }

  if (driftIncrease > 0.05) {
    return 'STRUCTURAL';
  }

  if (driftIncrease > 0) {
    return 'DRIFT';
  }

  return 'SAFE';
};

// Calculate total drift from target
export const calculateTotalDrift = (
  current: TargetLayerPct,
  target: TargetLayerPct
): number => {
  return (
    Math.abs(current.FOUNDATION - target.FOUNDATION) +
    Math.abs(current.GROWTH - target.GROWTH) +
    Math.abs(current.UPSIDE - target.UPSIDE)
  ) / 2; // Divide by 2 since drift is counted twice
};

// Generate friction copy based on boundary
export const getFrictionCopy = (boundary: Boundary, side: 'BUY' | 'SELL'): string[] => {
  const copy: string[] = [];

  if (boundary === 'DRIFT') {
    copy.push('This trade moves you slightly away from your target allocation.');
    copy.push('You can rebalance later to correct this drift.');
  }

  if (boundary === 'STRUCTURAL') {
    copy.push('This is a significant move away from your target allocation.');
    copy.push('Please review carefully before confirming.');
  }

  if (boundary === 'STRESS') {
    copy.push('Warning: This trade creates a major imbalance in your portfolio.');
    copy.push('Your portfolio may become exposed to higher risk.');
    if (side === 'SELL') {
      copy.push('Consider whether you truly need to sell this amount.');
    }
  }

  return copy;
};

// Check if trade moves toward target
export const movesTowardTarget = (
  before: TargetLayerPct,
  after: TargetLayerPct,
  target: TargetLayerPct
): boolean => {
  const beforeDrift = calculateTotalDrift(before, target);
  const afterDrift = calculateTotalDrift(after, target);
  return afterDrift < beforeDrift;
};

// Generate trade preview
export const generateTradePreview = (
  side: 'BUY' | 'SELL',
  assetId: AssetId,
  amountIRR: number,
  priceUSD: number,
  fxRate: number,
  currentAllocation: TargetLayerPct,
  targetAllocation: TargetLayerPct,
  holdings: Holding[],
  holdingValues: Map<string, number>,
  cashIRR: number
): TradePreview => {
  const asset = ASSETS[assetId];
  const spread = calculateSpread(assetId);

  // Calculate quantity
  const priceIRR = priceUSD * fxRate;
  const netAmount = calculateNetAmount(amountIRR, side, assetId);
  const quantity = netAmount / priceIRR;

  // Calculate after allocation
  const afterHoldingValues = new Map(holdingValues);
  let afterCashIRR = cashIRR;

  if (side === 'BUY') {
    afterCashIRR -= amountIRR;
    const currentValue = afterHoldingValues.get(assetId) || 0;
    afterHoldingValues.set(assetId, currentValue + netAmount);
  } else {
    afterCashIRR += netAmount;
    const currentValue = afterHoldingValues.get(assetId) || 0;
    afterHoldingValues.set(assetId, Math.max(0, currentValue - amountIRR));
  }

  // Calculate new layer percentages including cash
  const layerValues: Record<Layer, number> = {
    FOUNDATION: afterCashIRR, // Cash counts as foundation
    GROWTH: 0,
    UPSIDE: 0,
  };

  afterHoldingValues.forEach((value, id) => {
    const assetConfig = ASSETS[id as AssetId];
    if (assetConfig) {
      layerValues[assetConfig.layer] += value;
    }
  });

  const totalValue = layerValues.FOUNDATION + layerValues.GROWTH + layerValues.UPSIDE;

  const afterAllocation: TargetLayerPct = totalValue > 0
    ? {
        FOUNDATION: layerValues.FOUNDATION / totalValue,
        GROWTH: layerValues.GROWTH / totalValue,
        UPSIDE: layerValues.UPSIDE / totalValue,
      }
    : { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };

  const boundary = classifyBoundary(currentAllocation, afterAllocation, targetAllocation);
  const frictionCopy = getFrictionCopy(boundary, side);

  return {
    side,
    assetId,
    amountIRR,
    quantity,
    priceUSD,
    spread,
    before: currentAllocation,
    after: afterAllocation,
    target: targetAllocation,
    boundary,
    frictionCopy,
    movesTowardTarget: movesTowardTarget(currentAllocation, afterAllocation, targetAllocation),
  };
};
