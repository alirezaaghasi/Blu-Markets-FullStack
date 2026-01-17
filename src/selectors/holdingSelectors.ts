import type { Holding, Layer, AssetId } from '../types';
import type { HoldingValue } from '../engine/snapshot';
import { ASSET_LAYER } from '../state/domain';

/**
 * Create a Map of holdings by assetId for O(1) lookups
 */
export function selectHoldingsById(holdings: Holding[]): Map<AssetId, Holding> {
  const map = new Map<AssetId, Holding>();
  for (const h of holdings) {
    map.set(h.assetId, h);
  }
  return map;
}

export interface HoldingWithValue {
  holding: Holding;
  holdingValue: HoldingValue | undefined;
}

export interface HoldingsByLayerResult {
  holdings: Record<Layer, HoldingWithValue[]>;
  totals: Record<Layer, number>;
}

/**
 * Group holdings by layer with computed values
 */
export function selectHoldingsByLayer(
  holdings: Holding[],
  holdingValues: HoldingValue[]
): HoldingsByLayerResult {
  const result: Record<Layer, HoldingWithValue[]> = { FOUNDATION: [], GROWTH: [], UPSIDE: [] };
  const totals: Record<Layer, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };

  // Build map of holdingValues by assetId for O(1) lookup
  const holdingValueMap = new Map<AssetId, HoldingValue>();
  for (const hv of holdingValues || []) {
    holdingValueMap.set(hv.assetId, hv);
  }

  // Group holdings with their computed values
  for (const h of holdings) {
    const layer = ASSET_LAYER[h.assetId] as Layer | undefined;
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
 */
export function selectAvailableCollateral(
  holdings: Holding[],
  valueMap: Map<AssetId, number>
): Holding[] {
  return holdings.filter(h => !h.frozen && (valueMap.get(h.assetId) || 0) > 0);
}

/**
 * Get holdings with positive quantity
 */
export function selectNonEmptyHoldings(holdings: Holding[]): Holding[] {
  return holdings.filter(h => h.quantity > 0);
}
