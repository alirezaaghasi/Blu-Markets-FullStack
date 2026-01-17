// @ts-check
/** @typedef {import('../types').Holding} Holding */
/** @typedef {import('../types').PortfolioSnapshot} PortfolioSnapshot */
/** @typedef {import('../types').Layer} Layer */
/** @typedef {import('../types').AssetId} AssetId */

import { ASSET_LAYER } from "../state/domain.js";
import { calculateFixedIncomeValue } from "./fixedIncome.js";
import { DEFAULT_PRICES, DEFAULT_FX_RATE } from "../constants/index.js";

/**
 * @typedef {Object} HoldingValueResult
 * @property {number} valueIRR - Value in IRR
 * @property {number|null} priceUSD - Price in USD (null for internal assets)
 * @property {Object|null} breakdown - Breakdown details for fixed income
 */

/**
 * Compute holding value in IRR
 * Supports both quantity-based (v10+) and legacy valueIRR holdings
 *
 * @param {Holding} holding - Holding object
 * @param {Record<string, number>} prices - Current prices in USD
 * @param {number} fxRate - USD/IRR exchange rate
 * @returns {HoldingValueResult}
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
 * @typedef {Object} HoldingValue
 * @property {AssetId} assetId - Asset identifier
 * @property {number} quantity - Quantity held
 * @property {number} valueIRR - Value in IRR
 * @property {number|null} priceUSD - Price in USD
 * @property {Object|null} breakdown - Fixed income breakdown
 * @property {Layer} layer - Asset layer
 * @property {boolean} frozen - Whether holding is frozen
 */

/**
 * @typedef {Object} ComputedSnapshot
 * @property {number} totalIRR - Total portfolio value (holdings + cash)
 * @property {number} holdingsIRR - Holdings value only
 * @property {number} cashIRR - Cash balance
 * @property {Record<AssetId, number>} holdingsIRRByAsset - Value per asset
 * @property {HoldingValue[]} holdingValues - Computed holding values
 * @property {Record<Layer, number>} layerPct - Layer percentages
 * @property {Record<Layer, number>} layerIRR - Layer values in IRR
 */

/**
 * Compute portfolio snapshot from holdings and cash.
 * Supports live prices for quantity-based holdings.
 *
 * Performance notes:
 * - This function is memoized in App.jsx via useMemo (recomputes only when
 *   holdings/cash/prices/fxRate change)
 * - Caller should gate calls (e.g., skip during onboarding with empty holdings)
 * - Single O(n) loop where n = holdings count (typically 6-15 assets)
 * - For current portfolio sizes, full recomputation is ~0.1ms which is negligible
 *
 * Incremental update consideration:
 * - If portfolio grows to 50+ assets or polling frequency increases to <5s,
 *   consider caching per-holding values with price-keyed invalidation
 * - Current approach is optimal for the expected use case (15 assets, 30s polls)
 *
 * @param {Holding[]} holdings - Array of holdings
 * @param {number} cashIRR - Cash balance in IRR
 * @param {Record<string, number>} [prices] - Current asset prices in USD
 * @param {number} [fxRate] - USD/IRR exchange rate
 * @returns {ComputedSnapshot}
 */
export function computeSnapshot(holdings, cashIRR, prices = DEFAULT_PRICES, fxRate = DEFAULT_FX_RATE) {
  // Early return for empty holdings (no computation needed)
  if (!holdings || holdings.length === 0) {
    return {
      totalIRR: cashIRR,
      holdingsIRR: 0,
      cashIRR,
      holdingsIRRByAsset: {},
      holdingValues: [],
      layerPct: { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
      layerIRR: { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
    };
  }

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
