/**
 * Feature Flags Configuration
 *
 * Centralized control for enabling/disabling features.
 * Use environment variables (EXPO_PUBLIC_*) for runtime configuration,
 * or hardcode values for build-time configuration.
 *
 * Usage:
 * ```typescript
 * import { FEATURES } from '../config/features';
 *
 * if (FEATURES.PRICE_POLLING) {
 *   usePricePolling();
 * }
 * ```
 */

/**
 * Parse environment variable as boolean
 * Defaults to false if not set or invalid
 */
const parseEnvBool = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
};

/**
 * Feature flags for the application
 *
 * These control which features are enabled at runtime.
 * Set via environment variables (EXPO_PUBLIC_*) in .env files
 * or app.config.js/app.json for Expo builds.
 */
export const FEATURES = {
  /**
   * Enable WebSocket-based real-time price updates
   * When disabled, falls back to REST polling
   */
  PRICE_WEBSOCKET: parseEnvBool(process.env.EXPO_PUBLIC_ENABLE_PRICE_WEBSOCKET, true),

  /**
   * Enable REST-based price polling as fallback
   * Used when WebSocket is unavailable or disabled
   */
  PRICE_POLLING: parseEnvBool(process.env.EXPO_PUBLIC_ENABLE_PRICE_POLLING, true),

  /**
   * Enable local state persistence to AsyncStorage
   * Allows app to restore state on cold start
   */
  PERSISTENCE: parseEnvBool(process.env.EXPO_PUBLIC_ENABLE_PERSISTENCE, false),

  /**
   * Enable biometric authentication (Face ID, Touch ID)
   * Requires device support
   */
  BIOMETRIC_AUTH: parseEnvBool(process.env.EXPO_PUBLIC_ENABLE_BIOMETRIC, true),

  /**
   * Enable demo mode toggle in development
   * Should always be false in production
   */
  DEMO_MODE: __DEV__ && parseEnvBool(process.env.EXPO_PUBLIC_ENABLE_DEMO, true),

  /**
   * Enable verbose logging in development
   * Uses devLogger utility
   */
  VERBOSE_LOGGING: __DEV__,

  /**
   * Enable analytics/telemetry
   */
  ANALYTICS: parseEnvBool(process.env.EXPO_PUBLIC_ENABLE_ANALYTICS, false),
} as const;

/**
 * Type for feature flag keys
 */
export type FeatureFlag = keyof typeof FEATURES;

/**
 * Check if a feature is enabled
 */
export const isFeatureEnabled = (feature: FeatureFlag): boolean => {
  return FEATURES[feature];
};
