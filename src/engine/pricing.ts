import type { AssetId, Layer } from '../types';
import { ASSET_LAYER } from '../state/domain';
import { PREMIUM_RATES } from '../constants/index';

interface CalcPremiumParams {
  assetId: AssetId;
  notionalIRR: number;
  months: number;
}

interface CalcLiquidationParams {
  amountIRR: number;
  ltv: number;
}

/**
 * Get the base premium rate for an asset based on its layer
 */
export function baseRateForAsset(assetId: AssetId): number {
  const layer = ASSET_LAYER[assetId] as Layer;
  return PREMIUM_RATES[layer] || PREMIUM_RATES.UPSIDE;
}

/**
 * Calculate protection premium in IRR
 */
export function calcPremiumIRR({ assetId, notionalIRR, months }: CalcPremiumParams): number {
  const rate = baseRateForAsset(assetId);
  return Math.max(0, Math.floor(notionalIRR * rate * months));
}

/**
 * Calculate liquidation threshold in IRR
 */
export function calcLiquidationIRR({ amountIRR, ltv }: CalcLiquidationParams): number {
  return Math.floor(amountIRR / ltv);
}
