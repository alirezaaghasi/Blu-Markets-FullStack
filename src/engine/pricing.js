// @ts-check
/** @typedef {import('../types').AssetId} AssetId */
/** @typedef {import('../types').Layer} Layer */

import { ASSET_LAYER } from "../state/domain.js";
import { PREMIUM_RATES } from "../constants/index.js";

/**
 * Get the base premium rate for an asset based on its layer
 * @param {AssetId} assetId - Asset identifier
 * @returns {number} - Premium rate (0-1)
 */
export function baseRateForAsset(assetId) {
  const layer = ASSET_LAYER[assetId];
  return PREMIUM_RATES[layer] || PREMIUM_RATES.UPSIDE;
}

/**
 * Calculate protection premium in IRR
 * @param {{ assetId: AssetId, notionalIRR: number, months: number }} params
 * @returns {number} - Premium amount in IRR
 */
export function calcPremiumIRR({ assetId, notionalIRR, months }) {
  const rate = baseRateForAsset(assetId);
  return Math.max(0, Math.floor(notionalIRR * rate * months));
}

/**
 * Calculate liquidation threshold in IRR
 * @param {{ amountIRR: number, ltv: number }} params
 * @returns {number} - Liquidation threshold in IRR
 */
export function calcLiquidationIRR({ amountIRR, ltv }) {
  return Math.floor(amountIRR / ltv);
}
