import { ASSET_LAYER } from "../state/domain.js";
import { PREMIUM_RATES } from "../constants/index.js";

export function baseRateForAsset(assetId) {
  const layer = ASSET_LAYER[assetId];
  return PREMIUM_RATES[layer] || PREMIUM_RATES.UPSIDE;
}

export function calcPremiumIRR({ assetId, notionalIRR, months }) {
  const rate = baseRateForAsset(assetId);
  return Math.max(0, Math.floor(notionalIRR * rate * months));
}

export function calcLiquidationIRR({ amountIRR, ltv }) {
  return Math.floor(amountIRR / ltv);
}
