import { ASSET_LAYER } from "../state/domain.js";
import { calculateFixedIncomeValue } from "./fixedIncome.js";
import { DEFAULT_PRICES, DEFAULT_FX_RATE } from "../constants/index.js";

/**
 * Compute holding value in IRR
 * Supports both quantity-based (v10+) and legacy valueIRR holdings
 *
 * @param {Object} holding - Holding object
 * @param {Object} prices - Current prices in USD
 * @param {number} fxRate - USD/IRR exchange rate
 * @returns {Object} { valueIRR, priceUSD, breakdown }
 */
function computeHoldingValue(holding, prices, fxRate) {
  // Legacy support: if valueIRR exists and quantity doesn't, use valueIRR directly
  if (holding.valueIRR !== undefined && holding.quantity === undefined) {
    return { valueIRR: holding.valueIRR, priceUSD: null, breakdown: null };
  }

  // Quantity-based calculation (v10+)
  const quantity = holding.quantity || 0;

  if (holding.assetId === 'IRR_FIXED_INCOME') {
    // Special handling for fixed income - price is unit price in IRR
    const breakdown = calculateFixedIncomeValue(quantity, holding.purchasedAt);
    return { valueIRR: breakdown.total, priceUSD: null, breakdown };
  }

  // Standard: quantity × priceUSD × fxRate
  const priceUSD = prices[holding.assetId] || DEFAULT_PRICES[holding.assetId] || 0;
  const valueIRR = Math.round(quantity * priceUSD * fxRate);

  return { valueIRR, priceUSD, breakdown: null };
}

/**
 * Compute portfolio snapshot from holdings and cash.
 * Supports live prices for quantity-based holdings.
 *
 * @param {Array} holdings - Array of { assetId, quantity, frozen, purchasedAt? }
 * @param {number} cashIRR - Cash balance in IRR
 * @param {Object} prices - Current asset prices in USD (optional)
 * @param {number} fxRate - USD/IRR exchange rate (optional)
 */
export function computeSnapshot(holdings, cashIRR, prices = DEFAULT_PRICES, fxRate = DEFAULT_FX_RATE) {
  const holdingsIRRByAsset = {};
  const holdingValues = [];
  let holdingsTotal = 0;
  const layerIRR = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };

  // Single loop: compute values, build asset map, totals, and layer allocations
  for (const h of holdings) {
    const { valueIRR, priceUSD, breakdown } = computeHoldingValue(h, prices, fxRate);
    const layer = ASSET_LAYER[h.assetId];

    holdingsIRRByAsset[h.assetId] = valueIRR;
    holdingsTotal += valueIRR;
    layerIRR[layer] += valueIRR;

    holdingValues.push({
      assetId: h.assetId,
      quantity: h.quantity,
      valueIRR,
      priceUSD,
      breakdown,
      layer,
      frozen: h.frozen,
    });
  }

  // Total includes cash (for display), but layer calc excludes cash
  const totalIRR = holdingsTotal + cashIRR;

  // Layer percentages based on holdings total (not total with cash)
  const layerPct = {
    FOUNDATION: holdingsTotal ? (layerIRR.FOUNDATION / holdingsTotal) * 100 : 0,
    GROWTH: holdingsTotal ? (layerIRR.GROWTH / holdingsTotal) * 100 : 0,
    UPSIDE: holdingsTotal ? (layerIRR.UPSIDE / holdingsTotal) * 100 : 0,
  };

  return {
    totalIRR,                    // Holdings + Cash (total portfolio value)
    holdingsIRR: holdingsTotal,  // Holdings only
    cashIRR,                     // Cash separate
    holdingsIRRByAsset,
    holdingValues,               // Computed values with breakdowns
    layerPct,                    // Based on holdings only
    layerIRR,                    // Based on holdings only
  };
}
