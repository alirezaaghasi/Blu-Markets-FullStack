import type { TargetLayerPct, PortfolioStatus } from '../types';
import { LAYER_RANGES } from '../state/domain';

// Tolerance for drift from target before showing warning (5% of holdings)
const DRIFT_TOLERANCE = 5;

export type StatusIssue =
  | 'FOUNDATION_BELOW_TARGET'
  | 'FOUNDATION_ABOVE_TARGET'
  | 'GROWTH_BELOW_TARGET'
  | 'GROWTH_ABOVE_TARGET'
  | 'UPSIDE_BELOW_TARGET'
  | 'UPSIDE_ABOVE_TARGET'
  | 'FOUNDATION_BELOW_HARD_FLOOR'
  | 'UPSIDE_ABOVE_HARD_CAP';

export interface PortfolioStatusResult {
  status: PortfolioStatus;
  issues: StatusIssue[];
}

interface LayerPct {
  FOUNDATION: number;
  GROWTH: number;
  UPSIDE: number;
}

/**
 * Compute portfolio status by comparing current allocation to target.
 *
 * Status levels:
 * - BALANCED: Within tolerance of target allocation
 * - SLIGHTLY_OFF: Drifted more than tolerance from target
 * - ATTENTION_REQUIRED: Breached hard safety limits (Foundation < 30% or Upside > 25%)
 */
export function computePortfolioStatus(
  layerPct: LayerPct,
  targetLayerPct: TargetLayerPct | null = null
): PortfolioStatusResult {
  const issues: StatusIssue[] = [];

  // Use target if provided, otherwise use midpoint of acceptable range
  const target: LayerPct = targetLayerPct || {
    FOUNDATION: (LAYER_RANGES.FOUNDATION.min + LAYER_RANGES.FOUNDATION.max) / 2,
    GROWTH: (LAYER_RANGES.GROWTH.min + LAYER_RANGES.GROWTH.max) / 2,
    UPSIDE: (LAYER_RANGES.UPSIDE.min + LAYER_RANGES.UPSIDE.max) / 2,
  };

  // Check drift from target for each layer
  const foundationDrift = Math.abs(layerPct.FOUNDATION - target.FOUNDATION);
  const growthDrift = Math.abs(layerPct.GROWTH - target.GROWTH);
  const upsideDrift = Math.abs(layerPct.UPSIDE - target.UPSIDE);

  if (foundationDrift > DRIFT_TOLERANCE) {
    issues.push(layerPct.FOUNDATION < target.FOUNDATION ? 'FOUNDATION_BELOW_TARGET' : 'FOUNDATION_ABOVE_TARGET');
  }
  if (growthDrift > DRIFT_TOLERANCE) {
    issues.push(layerPct.GROWTH < target.GROWTH ? 'GROWTH_BELOW_TARGET' : 'GROWTH_ABOVE_TARGET');
  }
  if (upsideDrift > DRIFT_TOLERANCE) {
    issues.push(layerPct.UPSIDE < target.UPSIDE ? 'UPSIDE_BELOW_TARGET' : 'UPSIDE_ABOVE_TARGET');
  }

  // Hard safety limits (absolute bounds regardless of target)
  const hardIssues: StatusIssue[] = [];
  if (layerPct.FOUNDATION < LAYER_RANGES.FOUNDATION.hardMin) {
    hardIssues.push('FOUNDATION_BELOW_HARD_FLOOR');
  }
  if (layerPct.UPSIDE > LAYER_RANGES.UPSIDE.hardMax) {
    hardIssues.push('UPSIDE_ABOVE_HARD_CAP');
  }

  if (hardIssues.length) return { status: 'ATTENTION_REQUIRED', issues: [...issues, ...hardIssues] };
  if (issues.length) return { status: 'SLIGHTLY_OFF', issues };
  return { status: 'BALANCED', issues: [] };
}
