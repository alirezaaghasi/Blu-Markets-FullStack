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
 * Liquidation happens when collateral value drops below the outstanding debt (loan + interest)
 * At loan creation, this equals the loan amount
 */
export function calcLiquidationIRR({ amountIRR }: CalcLiquidationParams): number {
  return Math.floor(amountIRR);
}
