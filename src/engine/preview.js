import { computeSnapshot } from "./snapshot.js";
import { calcPremiumIRR, calcLiquidationIRR } from "./pricing.js";
import { ASSET_LAYER } from "../state/domain.js";
import { COLLATERAL_LTV_BY_LAYER, LAYERS, DEFAULT_PRICES, DEFAULT_FX_RATE, WEIGHTS } from "../constants/index.js";
import { irrToFixedIncomeUnits } from "./fixedIncome.js";
import { getAssetPriceUSD } from "../helpers.js";

/**
 * Calculate rebalance gap - determines if locked collateral prevents full rebalancing
 * and how much additional capital could close the gap.
 *
 * @param {Object} state - Current state
 * @param {Object} prices - Current asset prices
 * @param {number} fxRate - USD/IRR exchange rate
 * @returns {Object} Gap analysis with cash requirements
 */
export function calculateRebalanceGap(state, prices = DEFAULT_PRICES, fxRate = DEFAULT_FX_RATE) {
  const snap = computeSnapshot(state.holdings, state.cashIRR, prices, fxRate);
  const holdingsTotal = snap.holdingsIRR || 1;
  const assetIRRMap = snap.holdingsIRRByAsset || {};

  // Find frozen (locked) assets and their values
  const frozenByLayer = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  const unfrozenByLayer = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  let hasFrozenAssets = false;

  for (const h of state.holdings) {
    const layer = ASSET_LAYER[h.assetId];
    const holdingIRR = assetIRRMap[h.assetId] || 0;
    if (layer && holdingIRR > 0) {
      if (h.frozen) {
        frozenByLayer[layer] += holdingIRR;
        hasFrozenAssets = true;
      } else {
        unfrozenByLayer[layer] += holdingIRR;
      }
    }
  }

  // Current layer values
  const currentIRR = { ...snap.layerIRR };

  // Consolidated single-pass calculation of targets, movables, and deficits
  const targetIRR = {};
  const movableFromLayer = {};
  const deficitByLayer = {};
  let totalMovable = 0;
  let totalDeficit = 0;

  for (const layer of LAYERS) {
    // Target values for current holdings total
    targetIRR[layer] = (state.targetLayerPct[layer] / 100) * holdingsTotal;

    // Calculate surplus and movable amount (can only sell unfrozen portion)
    const surplus = Math.max(0, currentIRR[layer] - targetIRR[layer]);
    const movable = Math.min(surplus, unfrozenByLayer[layer]);
    movableFromLayer[layer] = movable;
    totalMovable += movable;

    // Calculate deficit
    const deficit = Math.max(0, targetIRR[layer] - currentIRR[layer]);
    deficitByLayer[layer] = deficit;
    totalDeficit += deficit;
  }

  // Simulate what HOLDINGS_ONLY rebalance can achieve
  // Constraint: Cannot sell frozen assets
  const achievableIRR = { ...currentIRR };

  // Amount that can actually be rebalanced
  const actuallyMovable = Math.min(totalMovable, totalDeficit);

  // Apply the moves to get achievable allocation
  if (actuallyMovable > 0 && totalMovable > 0 && totalDeficit > 0) {
    // Subtract from overweight (proportionally)
    for (const layer of LAYERS) {
      if (movableFromLayer[layer] > 0) {
        const proportion = movableFromLayer[layer] / totalMovable;
        achievableIRR[layer] -= actuallyMovable * proportion;
      }
    }
    // Add to underweight (proportionally)
    for (const layer of LAYERS) {
      if (deficitByLayer[layer] > 0) {
        const proportion = deficitByLayer[layer] / totalDeficit;
        achievableIRR[layer] += actuallyMovable * proportion;
      }
    }
  }

  // Convert achievable to percentages
  const achievablePct = {};
  for (const layer of LAYERS) {
    achievablePct[layer] = Math.round((achievableIRR[layer] / holdingsTotal) * 100);
  }

  // Calculate remaining gap after HOLDINGS_ONLY rebalance
  let remainingGapPct = 0;
  const gapByLayer = {};
  for (const layer of LAYERS) {
    const gap = Math.abs(achievablePct[layer] - state.targetLayerPct[layer]);
    gapByLayer[layer] = gap;
    remainingGapPct += gap;
  }

  // Calculate how much cash would achieve perfect balance
  // Key insight: Cash is deployed to UNDERWEIGHT layers, which dilutes OVERWEIGHT layers.
  //
  // For an overweight layer with value V that can't be reduced (frozen/sold out):
  // After deploying cash D to other layers, total becomes (holdingsTotal + D)
  // For this layer to hit target T%: V / (holdingsTotal + D) = T%
  // Solving: D = V/T% - holdingsTotal
  //
  // The constraining factor is the layer needing the most dilution.

  let cashNeededForPerfectBalance = 0;

  // Only calculate for layers that are STILL OVERWEIGHT after HOLDINGS_ONLY
  for (const layer of LAYERS) {
    const layerValue = achievableIRR[layer];
    const targetPct = state.targetLayerPct[layer] / 100;
    const targetValue = targetPct * holdingsTotal;

    // Only if this layer is overweight after HOLDINGS_ONLY
    if (layerValue > targetValue + 1) { // +1 to avoid floating point noise
      // To make this layer exactly targetPct, we need total portfolio of:
      const requiredTotal = layerValue / targetPct;
      const additionalNeeded = requiredTotal - holdingsTotal;
      if (additionalNeeded > cashNeededForPerfectBalance) {
        cashNeededForPerfectBalance = additionalNeeded;
      }
    }
  }

  // Round up to avoid floating point issues
  cashNeededForPerfectBalance = Math.ceil(Math.max(0, cashNeededForPerfectBalance));

  // Check if current cash is sufficient
  const currentCash = state.cashIRR;
  const cashSufficient = currentCash >= cashNeededForPerfectBalance;
  const cashShortfall = Math.max(0, cashNeededForPerfectBalance - currentCash);

  // Determine if using available cash would help
  // Simulate proper cash deployment to underweight layers
  let cashWouldHelp = false;
  let partialCashBenefit = 0;

  if (currentCash > 0 && remainingGapPct > 0) {
    // Calculate deficits in underweight layers
    const deficits = {};
    let totalDeficit = 0;
    for (const layer of LAYERS) {
      const targetValue = (state.targetLayerPct[layer] / 100) * (holdingsTotal + currentCash);
      const deficit = Math.max(0, targetValue - achievableIRR[layer]);
      deficits[layer] = deficit;
      totalDeficit += deficit;
    }

    // Simulate deploying cash proportionally to underweight layers
    const newLayerValues = { ...achievableIRR };
    if (totalDeficit > 0) {
      const cashToDeploy = Math.min(currentCash, totalDeficit);
      for (const layer of LAYERS) {
        if (deficits[layer] > 0) {
          const portion = (deficits[layer] / totalDeficit) * cashToDeploy;
          newLayerValues[layer] += portion;
        }
      }
    }

    // Calculate new gap after cash deployment
    const newTotal = holdingsTotal + Math.min(currentCash, totalDeficit);
    let newGapPct = 0;
    for (const layer of LAYERS) {
      const newLayerPct = (newLayerValues[layer] / newTotal) * 100;
      newGapPct += Math.abs(newLayerPct - state.targetLayerPct[layer]);
    }

    if (newGapPct < remainingGapPct) {
      cashWouldHelp = true;
      partialCashBenefit = remainingGapPct - newGapPct;
    }
  }

  // Determine if perfect balance is achievable
  // - With HOLDINGS_ONLY: remainingGapPct < 1
  // - With cash: cashSufficient (has enough cash to deploy)
  const canAchieveWithHoldingsOnly = remainingGapPct < 1;
  const canAchieveWithCash = cashSufficient || cashNeededForPerfectBalance === 0;

  return {
    // Current state
    hasFrozenAssets,
    frozenByLayer,
    currentPct: snap.layerPct,

    // After HOLDINGS_ONLY rebalance
    achievablePct,
    remainingGapPct: Math.round(remainingGapPct),
    gapByLayer,

    // Perfect balance requirements
    canAchievePerfectBalance: canAchieveWithHoldingsOnly,
    canAchieveWithCash,
    cashNeededForPerfectBalance,

    // Current cash analysis
    currentCash,
    cashSufficient,
    cashShortfall: Math.ceil(cashShortfall),

    // Partial cash usage
    cashWouldHelp,
    partialCashBenefit: Math.round(partialCashBenefit),

    // For UI display
    targetPct: state.targetLayerPct,
  };
}

export function cloneState(state) {
  return {
    ...state,
    holdings: state.holdings.map((h) => ({ ...h })),
    protections: state.protections.map((p) => ({ ...p })),
    loans: (state.loans || []).map((l) => ({ ...l })),
    ledger: state.ledger.slice(),
    pendingAction: null,
  };
}

export function previewAddFunds(state, { amountIRR }) {
  const next = cloneState(state);
  next.cashIRR += amountIRR;
  return next;
}

/**
 * Preview a trade action (BUY or SELL)
 * v10: Updates quantity instead of valueIRR for quantity-based holdings
 *
 * @param {Object} state - Current state
 * @param {Object} params - Trade parameters
 * @param {string} params.side - 'BUY' or 'SELL'
 * @param {string} params.assetId - Asset to trade
 * @param {number} params.amountIRR - Trade amount in IRR
 * @param {Object} params.prices - Current asset prices in USD (optional)
 * @param {number} params.fxRate - USD/IRR exchange rate (optional)
 */
export function previewTrade(state, { side, assetId, amountIRR, prices = DEFAULT_PRICES, fxRate = DEFAULT_FX_RATE }) {
  const next = cloneState(state);
  const h = next.holdings.find((x) => x.assetId === assetId);
  if (!h) return next;

  // Convert amountIRR to quantity change
  let quantityChange;
  if (assetId === 'IRR_FIXED_INCOME') {
    // Fixed income: use unit-based conversion
    quantityChange = irrToFixedIncomeUnits(amountIRR);
  } else {
    // Regular assets: quantity = amountIRR / (priceUSD × fxRate)
    const priceUSD = getAssetPriceUSD(assetId, prices) || 1;
    quantityChange = amountIRR / (priceUSD * fxRate);
  }

  if (side === "BUY") {
    next.cashIRR -= amountIRR;
    h.quantity += quantityChange;
  } else {
    // SELL: reduce quantity and add cash
    h.quantity = Math.max(0, h.quantity - quantityChange);
    next.cashIRR += amountIRR;
  }
  return next;
}

/**
 * Preview a protect action
 * v10: Computes notionalIRR from quantity × price × fxRate
 */
export function previewProtect(state, { assetId, months, prices = DEFAULT_PRICES, fxRate = DEFAULT_FX_RATE }) {
  const next = cloneState(state);
  const h = next.holdings.find((x) => x.assetId === assetId);
  if (!h) return next;

  // v10: Compute notional from quantity
  const snap = computeSnapshot([h], 0, prices, fxRate);
  const notionalIRR = snap.holdingsIRRByAsset[assetId] || 0;

  const premiumIRR = calcPremiumIRR({ assetId, notionalIRR, months });
  next.cashIRR = Math.max(0, next.cashIRR - premiumIRR);
  return next;
}

export function previewBorrow(state, { assetId, amountIRR }) {
  const next = cloneState(state);
  const h = next.holdings.find((x) => x.assetId === assetId);
  if (!h) return next;

  // LTV is determined by asset's layer (volatility-based)
  const layer = ASSET_LAYER[assetId];
  const ltv = COLLATERAL_LTV_BY_LAYER[layer] || 0.3;

  h.frozen = true;
  next.cashIRR += amountIRR;

  const liquidationIRR = calcLiquidationIRR({ amountIRR, ltv });
  const todayISO = new Date().toISOString().slice(0, 10);
  const loanId = `loan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Add to loans array (supports multiple loans)
  next.loans = [
    ...next.loans,
    { id: loanId, amountIRR, collateralAssetId: assetId, ltv, liquidationIRR, startISO: todayISO },
  ];

  return next;
}

export function previewRepay(state, { loanId, amountIRR }) {
  const next = cloneState(state);
  const loanIndex = next.loans.findIndex((l) => l.id === loanId);
  if (loanIndex === -1) return next;

  const loan = next.loans[loanIndex];
  const repay = Math.min(amountIRR, next.cashIRR, loan.amountIRR);
  next.cashIRR -= repay;
  loan.amountIRR -= repay;

  if (loan.amountIRR <= 0) {
    // Unfreeze collateral when loan is fully repaid
    const collateral = next.holdings.find((x) => x.assetId === loan.collateralAssetId);
    if (collateral) collateral.frozen = false;
    // Remove the loan from the array
    next.loans = next.loans.filter((l) => l.id !== loanId);
  }
  return next;
}

/**
 * Helper: Execute sells from overweight layers
 * @private
 */
function executeSells(surpluses, totalSurplus, amountToMove, sellableByLayer, prices, fxRate, meta) {
  const sellByLayer = {};
  for (const layer of Object.keys(surpluses)) {
    sellByLayer[layer] = Math.min(surpluses[layer], (surpluses[layer] / totalSurplus) * amountToMove);
  }

  for (const layer of Object.keys(sellByLayer)) {
    const toSell = sellByLayer[layer];
    if (toSell <= 0) continue;

    const assets = sellableByLayer[layer];
    if (!assets.length) continue;

    const layerTotal = assets.reduce((sum, h) => sum + (h._computedIRR || 0), 0);
    for (const h of assets) {
      const holdingIRR = h._computedIRR || 0;
      const proportion = holdingIRR / layerTotal;
      const sellAmountIRR = Math.min(toSell * proportion, holdingIRR);
      if (sellAmountIRR > 0) {
        if (h.assetId === 'IRR_FIXED_INCOME') {
          h.quantity -= irrToFixedIncomeUnits(sellAmountIRR);
        } else {
          const priceUSD = getAssetPriceUSD(h.assetId, prices) || 1;
          h.quantity -= sellAmountIRR / (priceUSD * fxRate);
        }
        h.quantity = Math.max(0, h.quantity);
        meta.trades.push({ layer, assetId: h.assetId, amountIRR: -sellAmountIRR, side: 'SELL' });
      }
    }
  }
}

/**
 * Helper: Execute buys into underweight layers using weighted distribution
 * @private
 */
function executeBuys(deficits, totalDeficit, amountToAllocate, holdingsByLayer, prices, fxRate, meta) {
  for (const layer of Object.keys(deficits)) {
    const layerBuy = (deficits[layer] / totalDeficit) * amountToAllocate;
    if (layerBuy <= 0) continue;

    const assets = holdingsByLayer[layer];
    if (!assets.length) continue;

    const layerWeights = WEIGHTS[layer] || {};
    const weightedAssets = assets.filter(h => layerWeights[h.assetId]);

    if (weightedAssets.length > 0) {
      const totalWeight = weightedAssets.reduce((sum, h) => sum + (layerWeights[h.assetId] || 0), 0);
      for (const h of weightedAssets) {
        const assetWeight = layerWeights[h.assetId] || 0;
        const assetPortionIRR = layerBuy * (assetWeight / totalWeight);
        if (assetPortionIRR > 0) {
          if (h.assetId === 'IRR_FIXED_INCOME') {
            h.quantity += irrToFixedIncomeUnits(assetPortionIRR);
          } else {
            const priceUSD = getAssetPriceUSD(h.assetId, prices) || 1;
            h.quantity += assetPortionIRR / (priceUSD * fxRate);
          }
          meta.trades.push({ layer, assetId: h.assetId, amountIRR: assetPortionIRR, side: 'BUY' });
        }
      }
    } else {
      const perAssetIRR = layerBuy / assets.length;
      for (const h of assets) {
        if (h.assetId === 'IRR_FIXED_INCOME') {
          h.quantity += irrToFixedIncomeUnits(perAssetIRR);
        } else {
          const priceUSD = getAssetPriceUSD(h.assetId, prices) || 1;
          h.quantity += perAssetIRR / (priceUSD * fxRate);
        }
        meta.trades.push({ layer, assetId: h.assetId, amountIRR: perAssetIRR, side: 'BUY' });
      }
    }
  }
}

/**
 * Helper: Calculate surpluses and deficits from current vs target layer values
 * @private
 */
function calculateSurplusesAndDeficits(curIRR, targetIRR) {
  const surpluses = {};
  const deficits = {};

  for (const layer of LAYERS) {
    const diff = curIRR[layer] - targetIRR[layer];
    if (diff > 0) {
      surpluses[layer] = diff;
    } else if (diff < 0) {
      deficits[layer] = Math.abs(diff);
    }
  }

  const totalSurplus = Object.values(surpluses).reduce((a, b) => a + b, 0);
  const totalDeficit = Object.values(deficits).reduce((a, b) => a + b, 0);

  return { surpluses, deficits, totalSurplus, totalDeficit };
}

/**
 * Helper: Execute holdings-only rebalancing (sell overweight, buy underweight)
 * @private
 */
function executeHoldingsOnlyRebalance(curIRR, targetIRR, sellableByLayer, holdingsByLayer, prices, fxRate, meta) {
  const { surpluses, deficits, totalSurplus, totalDeficit } = calculateSurplusesAndDeficits(curIRR, targetIRR);
  const amountToMove = Math.min(totalSurplus, totalDeficit);

  if (amountToMove > 0) {
    executeSells(surpluses, totalSurplus, amountToMove, sellableByLayer, prices, fxRate, meta);
    executeBuys(deficits, totalDeficit, amountToMove, holdingsByLayer, prices, fxRate, meta);
  }
}

/**
 * Deterministic rebalance for prototype:
 * - HOLDINGS_ONLY mode: Sell from overweight layers, buy into underweight layers. Cash untouched.
 * - HOLDINGS_PLUS_CASH mode: Also deploy cash into underweight layers (legacy).
 * - SMART mode: First do HOLDINGS_ONLY, then use specified cash amount to fill remaining gaps.
 * - Never sells frozen collateral.
 * - Leaves residual drift if constrained.
 * Returns state with _rebalanceMeta for constraint messaging.
 *
 * @param {Object} state - Current state
 * @param {Object} params - Rebalance parameters
 * @param {string} params.mode - 'HOLDINGS_ONLY', 'HOLDINGS_PLUS_CASH', or 'SMART'
 * @param {number} params.useCashAmount - For SMART mode: specific amount of cash to deploy (optional)
 * @param {Object} params.prices - Current asset prices in USD (optional)
 * @param {number} params.fxRate - USD/IRR exchange rate (optional)
 */
export function previewRebalance(state, { mode, useCashAmount = 0, prices = DEFAULT_PRICES, fxRate = DEFAULT_FX_RATE }) {
  const next = cloneState(state);
  const snap = computeSnapshot(next.holdings, next.cashIRR, prices, fxRate);
  const holdingsTotal = snap.holdingsIRR || 1;

  // Build lookup maps for O(1) access
  const assetIRRMap = snap.holdingsIRRByAsset || {};
  const holdingsByLayer = { FOUNDATION: [], GROWTH: [], UPSIDE: [] };
  const sellableByLayer = { FOUNDATION: [], GROWTH: [], UPSIDE: [] };
  let hasLockedCollateral = false;

  for (const h of next.holdings) {
    const layer = ASSET_LAYER[h.assetId];
    const holdingIRR = assetIRRMap[h.assetId] || 0;
    if (layer && holdingsByLayer[layer]) {
      h._computedIRR = holdingIRR;
      holdingsByLayer[layer].push(h);
      if (!h.frozen && holdingIRR > 0) {
        sellableByLayer[layer].push(h);
      } else if (h.frozen && holdingIRR > 0) {
        hasLockedCollateral = true;
      }
    }
  }

  const meta = {
    hasLockedCollateral,
    insufficientCash: false,
    residualDrift: 0,
    trades: [],
    cashDeployed: 0,
  };

  const targetIRR = {
    FOUNDATION: (state.targetLayerPct.FOUNDATION / 100) * holdingsTotal,
    GROWTH: (state.targetLayerPct.GROWTH / 100) * holdingsTotal,
    UPSIDE: (state.targetLayerPct.UPSIDE / 100) * holdingsTotal,
  };
  const curIRR = { ...snap.layerIRR };

  // HOLDINGS_ONLY: Rebalance by selling overweight and buying underweight
  if (mode === "HOLDINGS_ONLY" || mode === "SMART") {
    executeHoldingsOnlyRebalance(curIRR, targetIRR, sellableByLayer, holdingsByLayer, prices, fxRate, meta);
  }

  // SMART mode: Also deploy specified cash to fill remaining gaps
  if (mode === "SMART" && useCashAmount > 0 && next.cashIRR >= useCashAmount) {
    const midSnap = computeSnapshot(next.holdings, next.cashIRR, prices, fxRate);
    const newTotal = midSnap.holdingsIRR + useCashAmount;
    const newTargetIRR = {
      FOUNDATION: (state.targetLayerPct.FOUNDATION / 100) * newTotal,
      GROWTH: (state.targetLayerPct.GROWTH / 100) * newTotal,
      UPSIDE: (state.targetLayerPct.UPSIDE / 100) * newTotal,
    };

    const cashDeficits = {};
    let totalCashDeficit = 0;
    for (const layer of LAYERS) {
      const deficit = Math.max(0, newTargetIRR[layer] - midSnap.layerIRR[layer]);
      cashDeficits[layer] = deficit;
      totalCashDeficit += deficit;
    }

    if (totalCashDeficit > 0) {
      const actualSpend = Math.min(useCashAmount, totalCashDeficit, next.cashIRR);
      executeBuys(cashDeficits, totalCashDeficit, actualSpend, holdingsByLayer, prices, fxRate, meta);
      meta.cashDeployed = actualSpend;
      next.cashIRR -= actualSpend;
    }
  }

  // HOLDINGS_PLUS_CASH: Deploy cash into underweight layers (legacy)
  if (mode === "HOLDINGS_PLUS_CASH" && next.cashIRR > 0) {
    const newTotal = holdingsTotal + next.cashIRR;
    const newTargetIRR = {
      FOUNDATION: (state.targetLayerPct.FOUNDATION / 100) * newTotal,
      GROWTH: (state.targetLayerPct.GROWTH / 100) * newTotal,
      UPSIDE: (state.targetLayerPct.UPSIDE / 100) * newTotal,
    };

    const deficits = {
      FOUNDATION: Math.max(0, newTargetIRR.FOUNDATION - curIRR.FOUNDATION),
      GROWTH: Math.max(0, newTargetIRR.GROWTH - curIRR.GROWTH),
      UPSIDE: Math.max(0, newTargetIRR.UPSIDE - curIRR.UPSIDE),
    };

    const totalDef = deficits.FOUNDATION + deficits.GROWTH + deficits.UPSIDE;
    if (totalDef > 0) {
      const spend = Math.min(next.cashIRR, totalDef);
      if (next.cashIRR < totalDef) meta.insufficientCash = true;

      executeBuys(deficits, totalDef, spend, holdingsByLayer, prices, fxRate, meta);
      meta.cashDeployed = spend;
      next.cashIRR -= spend;
    }
  }

  // Calculate residual drift from target
  const afterSnap = computeSnapshot(next.holdings, next.cashIRR, prices, fxRate);
  meta.residualDrift = LAYERS.reduce((sum, layer) => {
    return sum + Math.abs(state.targetLayerPct[layer] - afterSnap.layerPct[layer]);
  }, 0);

  next._rebalanceMeta = meta;
  return next;
}
