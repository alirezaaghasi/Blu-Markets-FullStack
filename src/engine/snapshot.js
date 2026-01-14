import { ASSET_LAYER } from "../state/domain.js";

export function computeSnapshot(state) {
  const holdingsIRRByAsset = {};
  let holdingsTotal = 0;
  const layerIRR = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };

  // Single loop: build asset map, totals, and layer allocations
  for (const h of state.holdings) {
    holdingsIRRByAsset[h.assetId] = h.valueIRR;
    holdingsTotal += h.valueIRR;
    layerIRR[ASSET_LAYER[h.assetId]] += h.valueIRR;
  }

  // Total includes cash (for display), but layer calc excludes cash
  const totalIRR = holdingsTotal + state.cashIRR;

  // Layer percentages based on holdings total (not total with cash)
  const layerPct = {
    FOUNDATION: holdingsTotal ? (layerIRR.FOUNDATION / holdingsTotal) * 100 : 0,
    GROWTH: holdingsTotal ? (layerIRR.GROWTH / holdingsTotal) * 100 : 0,
    UPSIDE: holdingsTotal ? (layerIRR.UPSIDE / holdingsTotal) * 100 : 0,
  };

  return {
    totalIRR,                    // Holdings + Cash (total portfolio value)
    holdingsIRR: holdingsTotal,  // Holdings only
    cashIRR: state.cashIRR,      // Cash separate
    holdingsIRRByAsset,
    layerPct,                    // Based on holdings only
    layerIRR,                    // Based on holdings only
  };
}
