import { computeSnapshot } from "./snapshot.js";
import { calcPremiumIRR, calcLiquidationIRR } from "./pricing.js";
import { ASSET_LAYER } from "../state/domain.js";
import { COLLATERAL_LTV_BY_LAYER, LAYERS, DEFAULT_PRICES, DEFAULT_FX_RATE } from "../constants/index.js";
import { irrToFixedIncomeUnits } from "./fixedIncome.js";

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
 * v9.9: Updates quantity instead of valueIRR for quantity-based holdings
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
    const priceUSD = prices[assetId] || DEFAULT_PRICES[assetId] || 1;
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

export function previewProtect(state, { assetId, months }) {
  const next = cloneState(state);
  const h = next.holdings.find((x) => x.assetId === assetId);
  if (!h) return next;

  const premiumIRR = calcPremiumIRR({ assetId, notionalIRR: h.valueIRR, months });
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
 * Deterministic rebalance for prototype:
 * - HOLDINGS_ONLY mode: Sell from overweight layers, buy into underweight layers. Cash untouched.
 * - HOLDINGS_PLUS_CASH mode: Also deploy cash into underweight layers.
 * - Never sells frozen collateral.
 * - Leaves residual drift if constrained.
 * Returns state with _rebalanceMeta for constraint messaging.
 * v9.9: Updated to use quantity-based holdings with prices
 *
 * @param {Object} state - Current state
 * @param {Object} params - Rebalance parameters
 * @param {string} params.mode - 'HOLDINGS_ONLY' or 'HOLDINGS_PLUS_CASH'
 * @param {Object} params.prices - Current asset prices in USD (optional)
 * @param {number} params.fxRate - USD/IRR exchange rate (optional)
 */
export function previewRebalance(state, { mode, prices = DEFAULT_PRICES, fxRate = DEFAULT_FX_RATE }) {
  const next = cloneState(state);
  const snap = computeSnapshot(next.holdings, next.cashIRR, prices, fxRate);
  const holdingsTotal = snap.holdingsIRR || 1;

  // Build lookup map for asset IRR values from snapshot
  const assetIRRMap = snap.holdingsIRRByAsset || {};

  // Build holdings lookup by layer once - O(n) instead of O(n*m) repeated filters
  const holdingsByLayer = { FOUNDATION: [], GROWTH: [], UPSIDE: [] };
  const sellableByLayer = { FOUNDATION: [], GROWTH: [], UPSIDE: [] };
  let hasLockedCollateral = false;

  for (const h of next.holdings) {
    const layer = ASSET_LAYER[h.assetId];
    const holdingIRR = assetIRRMap[h.assetId] || 0;
    if (layer && holdingsByLayer[layer]) {
      // Attach computed IRR value to holding for use in calculations
      h._computedIRR = holdingIRR;
      holdingsByLayer[layer].push(h);
      if (!h.frozen && holdingIRR > 0) {
        sellableByLayer[layer].push(h);
      } else if (h.frozen && holdingIRR > 0) {
        hasLockedCollateral = true;
      }
    }
  }

  // Track constraints for messaging
  const meta = {
    hasLockedCollateral,
    insufficientCash: false,
    residualDrift: 0,
    trades: [],
    cashDeployed: 0,
  };

  // Target values based on holdings only (cash excluded from layer calc)
  const targetIRR = {
    FOUNDATION: (state.targetLayerPct.FOUNDATION / 100) * holdingsTotal,
    GROWTH: (state.targetLayerPct.GROWTH / 100) * holdingsTotal,
    UPSIDE: (state.targetLayerPct.UPSIDE / 100) * holdingsTotal,
  };

  const curIRR = { ...snap.layerIRR };

  // HOLDINGS_ONLY: Rebalance by selling overweight and buying underweight (no cash used)
  if (mode === "HOLDINGS_ONLY") {
    // Calculate surpluses (overweight) and deficits (underweight)
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

    // Amount to move is the minimum of total surplus and total deficit
    const amountToMove = Math.min(totalSurplus, totalDeficit);

    if (amountToMove > 0) {
      // First: SELL from overweight layers (excluding frozen collateral)
      let remainingToSell = amountToMove;
      const sellByLayer = {};

      for (const layer of Object.keys(surpluses)) {
        // Proportion of this layer's surplus relative to total surplus
        const layerSell = Math.min(surpluses[layer], (surpluses[layer] / totalSurplus) * amountToMove);
        sellByLayer[layer] = layerSell;
      }

      // Execute sells
      for (const layer of Object.keys(sellByLayer)) {
        let toSell = sellByLayer[layer];
        if (toSell <= 0) continue;

        // Use precomputed sellable assets (not frozen)
        const assets = sellableByLayer[layer];

        if (!assets.length) {
          // All assets in this layer are frozen - constraint already tracked
          continue;
        }

        // Distribute sell proportionally across assets in layer using computed IRR values
        const layerTotal = assets.reduce((sum, h) => sum + (h._computedIRR || 0), 0);
        for (const h of assets) {
          const holdingIRR = h._computedIRR || 0;
          const proportion = holdingIRR / layerTotal;
          const sellAmountIRR = Math.min(toSell * proportion, holdingIRR);
          if (sellAmountIRR > 0) {
            // v9.9: Convert IRR to quantity change
            if (h.assetId === 'IRR_FIXED_INCOME') {
              h.quantity -= irrToFixedIncomeUnits(sellAmountIRR);
            } else {
              const priceUSD = prices[h.assetId] || DEFAULT_PRICES[h.assetId] || 1;
              h.quantity -= sellAmountIRR / (priceUSD * fxRate);
            }
            h.quantity = Math.max(0, h.quantity);
            meta.trades.push({
              layer,
              assetId: h.assetId,
              amountIRR: -sellAmountIRR,
              side: 'SELL',
            });
          }
        }
      }

      // Second: BUY into underweight layers
      let remainingToBuy = amountToMove;

      for (const layer of Object.keys(deficits)) {
        // Proportion of this layer's deficit relative to total deficit
        const layerBuy = (deficits[layer] / totalDeficit) * amountToMove;
        if (layerBuy <= 0) continue;

        const assets = holdingsByLayer[layer];
        if (!assets.length) continue;

        // Distribute buy evenly across assets in layer
        const perAssetIRR = layerBuy / assets.length;
        for (const h of assets) {
          // v9.9: Convert IRR to quantity change
          if (h.assetId === 'IRR_FIXED_INCOME') {
            h.quantity += irrToFixedIncomeUnits(perAssetIRR);
          } else {
            const priceUSD = prices[h.assetId] || DEFAULT_PRICES[h.assetId] || 1;
            h.quantity += perAssetIRR / (priceUSD * fxRate);
          }
          meta.trades.push({
            layer,
            assetId: h.assetId,
            amountIRR: perAssetIRR,
            side: 'BUY',
          });
        }
      }
    }
  }

  // HOLDINGS_PLUS_CASH: Deploy cash into underweight layers (legacy behavior)
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

      if (next.cashIRR < totalDef) {
        meta.insufficientCash = true;
      }

      const spendByLayer = {
        FOUNDATION: spend * (deficits.FOUNDATION / totalDef),
        GROWTH: spend * (deficits.GROWTH / totalDef),
        UPSIDE: spend * (deficits.UPSIDE / totalDef),
      };

      for (const layer of Object.keys(spendByLayer)) {
        const portion = spendByLayer[layer];
        if (portion <= 0) continue;

        const assets = holdingsByLayer[layer];
        if (!assets.length) continue;

        const perAssetIRR = portion / assets.length;
        for (const h of assets) {
          // v9.9: Convert IRR to quantity change
          if (h.assetId === 'IRR_FIXED_INCOME') {
            h.quantity += irrToFixedIncomeUnits(perAssetIRR);
          } else {
            const priceUSD = prices[h.assetId] || DEFAULT_PRICES[h.assetId] || 1;
            h.quantity += perAssetIRR / (priceUSD * fxRate);
          }
          meta.trades.push({
            layer,
            assetId: h.assetId,
            amountIRR: perAssetIRR,
            side: 'BUY',
          });
        }
      }

      meta.cashDeployed = spend;
      next.cashIRR -= spend;
    }
  }

  // After rebalance, compute residual drift from target
  const afterSnap = computeSnapshot(next.holdings, next.cashIRR, prices, fxRate);
  const driftFromTarget = LAYERS.reduce((sum, layer) => {
    const target = state.targetLayerPct[layer];
    const actual = afterSnap.layerPct[layer];
    return sum + Math.abs(target - actual);
  }, 0);

  meta.residualDrift = driftFromTarget;

  // Attach meta to state for boundary classification
  next._rebalanceMeta = meta;

  return next;
}
