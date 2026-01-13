import { ASSET_LAYER } from "../state/domain.js";

export function baseRateForAsset(assetId) {
  const layer = ASSET_LAYER[assetId];
  if (layer === "FOUNDATION") return 0.004;
  if (layer === "GROWTH") return 0.008;
  return 0.012;
}

export function calcPremiumIRR({ assetId, notionalIRR, months }) {
  const rate = baseRateForAsset(assetId);
  return Math.max(0, Math.floor(notionalIRR * rate * months));
}

export function calcLiquidationIRR({ amountIRR, ltv }) {
  return Math.floor(amountIRR / ltv);
}
