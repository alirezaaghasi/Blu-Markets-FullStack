import { computeSnapshot } from "./snapshot.js";
import { calcPremiumIRR, calcLiquidationIRR } from "./pricing.js";
import { ASSET_LAYER } from "../state/domain.js";
import { COLLATERAL_LTV_BY_LAYER } from "../constants/index.js";

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

export function previewTrade(state, { side, assetId, amountIRR }) {
  const next = cloneState(state);
  const h = next.holdings.find((x) => x.assetId === assetId);
  if (!h) return next;

  if (side === "BUY") {
    next.cashIRR -= amountIRR;
    h.valueIRR += amountIRR;
  } else {
    h.valueIRR -= amountIRR;
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
 */
export function previewRebalance(state, { mode }) {
  const next = cloneState(state);
  const snap = computeSnapshot(next.holdings, next.cashIRR);
  const holdingsTotal = snap.holdingsIRR || 1;

  // Build holdings lookup by layer once - O(n) instead of O(n*m) repeated filters
  const holdingsByLayer = { FOUNDATION: [], GROWTH: [], UPSIDE: [] };
  const sellableByLayer = { FOUNDATION: [], GROWTH: [], UPSIDE: [] };
  let hasLockedCollateral = false;

  for (const h of next.holdings) {
    const layer = ASSET_LAYER[h.assetId];
    if (layer && holdingsByLayer[layer]) {
      holdingsByLayer[layer].push(h);
      if (!h.frozen && h.valueIRR > 0) {
        sellableByLayer[layer].push(h);
      } else if (h.frozen && h.valueIRR > 0) {
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

    for (const layer of ['FOUNDATION', 'GROWTH', 'UPSIDE']) {
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

        // Distribute sell proportionally across assets in layer
        const layerTotal = assets.reduce((sum, h) => sum + h.valueIRR, 0);
        for (const h of assets) {
          const proportion = h.valueIRR / layerTotal;
          const sellAmount = Math.min(toSell * proportion, h.valueIRR);
          if (sellAmount > 0) {
            h.valueIRR -= sellAmount;
            meta.trades.push({
              layer,
              assetId: h.assetId,
              amountIRR: -sellAmount,
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
        const per = layerBuy / assets.length;
        for (const h of assets) {
          h.valueIRR += per;
          meta.trades.push({
            layer,
            assetId: h.assetId,
            amountIRR: per,
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

        const per = portion / assets.length;
        for (const h of assets) {
          h.valueIRR += per;
          meta.trades.push({
            layer,
            assetId: h.assetId,
            amountIRR: per,
            side: 'BUY',
          });
        }
      }

      meta.cashDeployed = spend;
      next.cashIRR -= spend;
    }
  }

  // After rebalance, compute residual drift from target
  const afterSnap = computeSnapshot(next.holdings, next.cashIRR);
  const driftFromTarget = ['FOUNDATION', 'GROWTH', 'UPSIDE'].reduce((sum, layer) => {
    const target = state.targetLayerPct[layer];
    const actual = afterSnap.layerPct[layer];
    return sum + Math.abs(target - actual);
  }, 0);

  meta.residualDrift = driftFromTarget;

  // Attach meta to state for boundary classification
  next._rebalanceMeta = meta;

  return next;
}
