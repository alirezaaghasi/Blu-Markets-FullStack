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
 * - If mode includes cash: deploy cash into underweight layers.
 * - Never sells frozen collateral.
 * - Leaves residual drift if constrained.
 */
export function previewRebalance(state, { mode }) {
  const next = cloneState(state);
  const snap = computeSnapshot(next);
  const holdingsTotal = snap.holdingsIRR || 1;

  // Target values based on holdings only (cash excluded from layer calc)
  const targetIRR = {
    FOUNDATION: (state.targetLayerPct.FOUNDATION / 100) * holdingsTotal,
    GROWTH: (state.targetLayerPct.GROWTH / 100) * holdingsTotal,
    UPSIDE: (state.targetLayerPct.UPSIDE / 100) * holdingsTotal,
  };

  const curIRR = { ...snap.layerIRR };

  if (mode === "HOLDINGS_PLUS_CASH" && next.cashIRR > 0) {
    // Recalculate target based on total after deploying cash
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
        for (const h of assets) h.valueIRR += per;
      }

      next.cashIRR -= spend;
    }
  }

  // No sell-based rebalancing in prototype; residual drift is expected and must be surfaced by boundary/status.
  return next;
}
