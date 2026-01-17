// @ts-check
/** @typedef {import('../types').Layer} Layer */
/** @typedef {import('../types').TargetLayerPct} TargetLayerPct */
/** @typedef {import('../types').PortfolioStatus} PortfolioStatus */

import { LAYERS } from '../constants/index';

/**
 * @typedef {Object} DriftResult
 * @property {number} totalDrift - Total absolute drift across all layers
 * @property {boolean} isOff - Whether portfolio is off target (drift > 1%)
 * @property {boolean} isAttention - Whether portfolio needs attention
 * @property {Record<Layer, number>} driftByLayer - Drift per layer
 */

/**
 * Calculate portfolio drift from target allocation
 * @param {Record<Layer, number>} layerPct - Current layer percentages
 * @param {TargetLayerPct} targetPct - Target layer percentages
 * @param {PortfolioStatus} [status] - Current portfolio status
 * @returns {DriftResult}
 */
export function selectDrift(layerPct, targetPct, status) {
  /** @type {Record<Layer, number>} */
  const driftByLayer = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  let totalDrift = 0;

  for (const layer of LAYERS) {
    const drift = Math.abs(layerPct[layer] - targetPct[layer]);
    driftByLayer[layer] = drift;
    totalDrift += drift;
  }

  return {
    totalDrift,
    isOff: totalDrift > 1,
    isAttention: status === 'ATTENTION_REQUIRED' && totalDrift > 1,
    driftByLayer,
  };
}

/**
 * Check if a layer is on target (within threshold)
 * @param {number} currentPct - Current layer percentage
 * @param {number} targetPct - Target layer percentage
 * @param {number} [threshold=3] - Threshold percentage
 * @returns {boolean}
 */
export function selectIsLayerOnTarget(currentPct, targetPct, threshold = 3) {
  return Math.abs(currentPct - targetPct) < threshold;
}

/**
 * @typedef {Object} PortfolioMetrics
 * @property {number} totalValue - Total portfolio value
 * @property {number} holdingsValue - Value of holdings
 * @property {number} cashValue - Cash balance
 * @property {number} holdingsPercent - Percentage in holdings
 * @property {number} cashPercent - Percentage in cash
 */

/**
 * Calculate portfolio value metrics
 * @param {number} holdingsIRR - Holdings value
 * @param {number} cashIRR - Cash balance
 * @returns {PortfolioMetrics}
 */
export function selectPortfolioMetrics(holdingsIRR, cashIRR) {
  const totalValue = holdingsIRR + cashIRR;
  return {
    totalValue,
    holdingsValue: holdingsIRR,
    cashValue: cashIRR,
    holdingsPercent: totalValue > 0 ? (holdingsIRR / totalValue) * 100 : 0,
    cashPercent: totalValue > 0 ? (cashIRR / totalValue) * 100 : 0,
  };
}
