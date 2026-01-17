// Domain definitions - v10 with 15-asset universe and HRAM balancing
// Holdings store quantities, values computed from live prices
//
// NOTE: Asset configuration has been consolidated into src/registry/assetRegistry.js
// This file re-exports for backwards compatibility. New code should import from the registry.

// Re-export from registry for backwards compatibility
export {
  ASSETS,
  ASSET_LAYER,
  LAYER_ASSETS,
  ASSET_META,
} from '../registry/assetRegistry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER RANGES
// ═══════════════════════════════════════════════════════════════════════════════

// Layer health ranges for portfolio status
export const LAYER_RANGES = {
  FOUNDATION: { min: 40, max: 70, hardMin: 30 },
  GROWTH: { min: 20, max: 45 },
  UPSIDE: { min: 0, max: 20, hardMax: 25 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROFILE MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════════

export const USER_PROFILE_STRATEGIES = {
  ANXIOUS_NOVICE: 'CONSERVATIVE',
  STEADY_BUILDER: 'BALANCED',
  AGGRESSIVE_ACCUMULATOR: 'MOMENTUM_TILT',
  WEALTH_PRESERVER: 'MAX_DIVERSIFICATION',
  SPECULATOR: 'AGGRESSIVE',
};

export const USER_PROFILE_ALLOCATIONS = {
  ANXIOUS_NOVICE:         { FOUNDATION: 80, GROWTH: 18, UPSIDE: 2 },
  STEADY_BUILDER:         { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 },
  AGGRESSIVE_ACCUMULATOR: { FOUNDATION: 20, GROWTH: 30, UPSIDE: 50 },
  WEALTH_PRESERVER:       { FOUNDATION: 60, GROWTH: 35, UPSIDE: 5 },
  SPECULATOR:             { FOUNDATION: 10, GROWTH: 20, UPSIDE: 70 },
};
