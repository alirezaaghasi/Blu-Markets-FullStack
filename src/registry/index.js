// @ts-check
/**
 * Asset Registry - Public API
 *
 * Re-exports all registry data for backwards compatibility.
 * New code should import directly from './assetRegistry'
 */

export {
  // Primary configuration
  ASSETS_CONFIG,
  getAssetConfig,
  getAssetDisplayName,
  getCoinGeckoIds,
  isProtectionEligible,
  getAssetLayer,

  // Derived data (backwards compatible)
  ASSETS,
  ASSET_LAYER,
  LAYER_ASSETS,
  DEFAULT_PRICES,
  WEIGHTS,
  PROTECTION_ELIGIBLE_ASSETS,

  // Legacy (deprecated)
  ASSET_META,
} from './assetRegistry';
