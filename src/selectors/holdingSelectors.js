// @ts-check
/** @typedef {import('../types').Holding} Holding */
/** @typedef {import('../types').Layer} Layer */
/** @typedef {import('../types').AssetId} AssetId */

import { ASSET_LAYER } from '../state/domain';

/**
 * Create a Map of holdings by assetId for O(1) lookups
 * @param {Holding[]} holdings
 * @returns {Map<AssetId, Holding>}
 */
export function selectHoldingsById(holdings) {
  const map = new Map();
  for (const h of holdings) {
    map.set(h.assetId, h);
  }
  return map;
}

/**
 * @typedef {Object} HoldingsByLayerResult
 * @property {Record<Layer, Array<{ holding: Holding, holdingValue: any }>>} holdings - Holdings grouped by layer
 * @property {Record<Layer, number>} totals - Total value per layer
 */

/**
 * Group holdings by layer with computed values
 * @param {Holding[]} holdings
 * @param {any[]} holdingValues - Computed holding values from snapshot
 * @returns {HoldingsByLayerResult}
 */
export function selectHoldingsByLayer(holdings, holdingValues) {
  /** @type {Record<Layer, Array<{ holding: Holding, holdingValue: any }>>} */
  const result = { FOUNDATION: [], GROWTH: [], UPSIDE: [] };
  /** @type {Record<Layer, number>} */
  const totals = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };

  // Build map of holdingValues by assetId for O(1) lookup
  const holdingValueMap = new Map();
  for (const hv of holdingValues || []) {
    holdingValueMap.set(hv.assetId, hv);
  }

  // Group holdings with their computed values
  for (const h of holdings) {
    const layer = ASSET_LAYER[h.assetId];
    if (layer && result[layer]) {
      const holdingValue = holdingValueMap.get(h.assetId);
      result[layer].push({ holding: h, holdingValue });
      totals[layer] += holdingValue?.valueIRR || 0;
    }
  }

  return { holdings: result, totals };
}

/**
 * Get holdings that are not frozen and have value
 * @param {Holding[]} holdings
 * @param {Map<AssetId, number>} valueMap - Map of assetId to valueIRR
 * @returns {Holding[]}
 */
export function selectAvailableCollateral(holdings, valueMap) {
  return holdings.filter(h => !h.frozen && (valueMap.get(h.assetId) || 0) > 0);
}

/**
 * Get holdings with positive quantity
 * @param {Holding[]} holdings
 * @returns {Holding[]}
 */
export function selectNonEmptyHoldings(holdings) {
  return holdings.filter(h => h.quantity > 0);
}
