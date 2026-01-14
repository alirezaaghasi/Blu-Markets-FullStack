import { computeSnapshot } from "./snapshot.js";
import { calcPremiumIRR, calcLiquidationIRR } from "./pricing.js";
import { ASSET_LAYER } from "../state/domain.js";

export function cloneState(state) {
  return {
    ...state,
    holdings: state.holdings.map((h) => ({ ...h })),
    protections: state.protections.map((p) => ({ ...p })),
    loan: state.loan ? { ...state.loan } : null,
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

export function previewBorrow(state, { assetId, amountIRR, ltv }) {
  const next = cloneState(state);
  const h = next.holdings.find((x) => x.assetId === assetId);
  if (!h) return next;

  h.frozen = true;
  next.cashIRR += amountIRR;

  const liquidationIRR = calcLiquidationIRR({ amountIRR, ltv });
  const todayISO = new Date().toISOString().slice(0, 10);
  next.loan = { amountIRR, collateralAssetId: assetId, ltv, liquidationIRR, startISO: todayISO };

  return next;
}

export function previewRepay(state, { amountIRR }) {
  const next = cloneState(state);
  if (!next.loan) return next;

  const repay = Math.min(amountIRR, next.cashIRR, next.loan.amountIRR);
  next.cashIRR -= repay;
  next.loan.amountIRR -= repay;

  if (next.loan.amountIRR <= 0) {
    const collateral = next.holdings.find((x) => x.assetId === next.loan.collateralAssetId);
    if (collateral) collateral.frozen = false;
    next.loan = null;
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
  const snap = computeSnapshot(next);
  const holdingsTotal = snap.holdingsIRR || 1;

  // Track constraints for messaging
  const meta = {
    hasLockedCollateral: state.holdings.some(h => h.frozen && h.valueIRR > 0),
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

        // Get sellable assets (not frozen)
        const assets = next.holdings.filter(
          (h) => ASSET_LAYER[h.assetId] === layer && !h.frozen && h.valueIRR > 0
        );

        if (!assets.length) {
          // All assets in this layer are frozen - constraint
          meta.hasLockedCollateral = true;
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

        const assets = next.holdings.filter((h) => ASSET_LAYER[h.assetId] === layer);
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

        const assets = next.holdings.filter((h) => ASSET_LAYER[h.assetId] === layer);
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
  const afterSnap = computeSnapshot(next);
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
