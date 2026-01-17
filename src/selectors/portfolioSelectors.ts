import type { Layer, TargetLayerPct, PortfolioStatus } from '../types';
import { LAYERS } from '../constants/index';

export interface DriftResult {
  totalDrift: number;
  isOff: boolean;
  isAttention: boolean;
  driftByLayer: Record<Layer, number>;
}

/**
 * Calculate portfolio drift from target allocation
 */
export function selectDrift(
  layerPct: Record<Layer, number>,
  targetPct: TargetLayerPct,
  status?: PortfolioStatus
): DriftResult {
  const driftByLayer: Record<Layer, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
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
 */
export function selectIsLayerOnTarget(
  currentPct: number,
  targetPct: number,
  threshold: number = 3
): boolean {
  return Math.abs(currentPct - targetPct) < threshold;
}

export interface PortfolioMetrics {
  totalValue: number;
  holdingsValue: number;
  cashValue: number;
  holdingsPercent: number;
  cashPercent: number;
}

/**
 * Calculate portfolio value metrics
 */
export function selectPortfolioMetrics(holdingsIRR: number, cashIRR: number): PortfolioMetrics {
  const totalValue = holdingsIRR + cashIRR;
  return {
    totalValue,
    holdingsValue: holdingsIRR,
    cashValue: cashIRR,
    holdingsPercent: totalValue > 0 ? (holdingsIRR / totalValue) * 100 : 0,
    cashPercent: totalValue > 0 ? (cashIRR / totalValue) * 100 : 0,
  };
}
