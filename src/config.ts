// ============================================================================
// APPLICATION CONFIGURATION - Environment and runtime config with validation
// ============================================================================
// This file provides typed access to environment variables and validates
// critical configuration at startup. Import { config } for runtime values.
// ============================================================================

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

interface EnvConfig {
  // API endpoints
  COINGECKO_API_URL: string;
  FINNHUB_API_KEY: string | null;

  // Fallback values
  FALLBACK_USD_IRR: number;

  // Feature flags
  ENABLE_PRICE_POLLING: boolean;
  ENABLE_STRESS_MODE: boolean;

  // Development
  IS_DEV: boolean;
}

function getEnvString(key: string, fallback: string): string {
  const value = import.meta.env[`VITE_${key}`];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function getEnvNumber(key: string, fallback: number): number {
  const value = import.meta.env[`VITE_${key}`];
  if (typeof value === 'string' && value.length > 0) {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

function getEnvBoolean(key: string, fallback: boolean): boolean {
  const value = import.meta.env[`VITE_${key}`];
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return fallback;
}

const env: EnvConfig = {
  COINGECKO_API_URL: getEnvString('COINGECKO_API_URL', 'https://api.coingecko.com/api/v3'),
  FINNHUB_API_KEY: getEnvString('FINNHUB_API_KEY', '') || null,
  FALLBACK_USD_IRR: getEnvNumber('FALLBACK_USD_IRR', 1456000),
  ENABLE_PRICE_POLLING: getEnvBoolean('ENABLE_PRICE_POLLING', true),
  ENABLE_STRESS_MODE: getEnvBoolean('ENABLE_STRESS_MODE', false),
  IS_DEV: import.meta.env.DEV === true,
};

// ============================================================================
// RUNTIME CONFIGURATION
// ============================================================================

interface PricePollingConfig {
  /** Base polling interval in milliseconds */
  BASE_INTERVAL_MS: number;
  /** Maximum backoff interval in milliseconds */
  MAX_BACKOFF_MS: number;
  /** Heartbeat interval for stale price detection */
  HEARTBEAT_MS: number;
  /** Multiplier applied on each failed request */
  BACKOFF_MULTIPLIER: number;
}

interface LoanConfig {
  /** Maximum total loans as percentage of AUM (0.0 - 1.0) */
  MAX_TOTAL_LOAN_PCT: number;
  /** LTV limits by layer */
  LTV_BY_LAYER: {
    FOUNDATION: number;
    GROWTH: number;
    UPSIDE: number;
  };
}

interface ProtectionConfig {
  /** Minimum protection duration in months */
  MIN_MONTHS: number;
  /** Maximum protection duration in months */
  MAX_MONTHS: number;
  /** Premium rates by layer (monthly) */
  PREMIUM_RATES: {
    FOUNDATION: number;
    GROWTH: number;
    UPSIDE: number;
  };
}

interface TradingConfig {
  /** Minimum trade amount in IRR */
  MIN_AMOUNT_IRR: number;
  /** Spread by layer for disclosure */
  SPREAD_BY_LAYER: {
    FOUNDATION: number;
    GROWTH: number;
    UPSIDE: number;
  };
}

interface RebalanceConfig {
  /** Drift threshold for normal rebalance (0.0 - 1.0) */
  DRIFT_THRESHOLD: number;
  /** Drift threshold for emergency rebalance (0.0 - 1.0) */
  EMERGENCY_DRIFT_THRESHOLD: number;
  /** Minimum days between normal rebalances */
  MIN_REBALANCE_INTERVAL_DAYS: number;
  /** Minimum trade value to execute in IRR */
  MIN_TRADE_VALUE_IRR: number;
}

interface AppConfig {
  env: EnvConfig;
  pricePolling: PricePollingConfig;
  loans: LoanConfig;
  protection: ProtectionConfig;
  trading: TradingConfig;
  rebalance: RebalanceConfig;
}

// ============================================================================
// CONFIGURATION OBJECT
// ============================================================================

export const config: AppConfig = {
  env,

  pricePolling: {
    BASE_INTERVAL_MS: 30_000,      // 30 seconds
    MAX_BACKOFF_MS: 300_000,       // 5 minutes
    HEARTBEAT_MS: 5_000,           // 5 seconds
    BACKOFF_MULTIPLIER: 1.5,
  },

  loans: {
    MAX_TOTAL_LOAN_PCT: 0.25,      // 25% of AUM
    LTV_BY_LAYER: {
      FOUNDATION: 0.70,            // 70% - stable assets
      GROWTH: 0.50,                // 50% - moderate volatility
      UPSIDE: 0.30,                // 30% - high volatility
    },
  },

  protection: {
    MIN_MONTHS: 1,
    MAX_MONTHS: 6,
    PREMIUM_RATES: {
      FOUNDATION: 0.004,
      GROWTH: 0.008,
      UPSIDE: 0.012,
    },
  },

  trading: {
    MIN_AMOUNT_IRR: 1_000_000,
    SPREAD_BY_LAYER: {
      FOUNDATION: 0.0015,          // 0.15%
      GROWTH: 0.003,               // 0.30%
      UPSIDE: 0.006,               // 0.60%
    },
  },

  rebalance: {
    DRIFT_THRESHOLD: 0.05,         // 5%
    EMERGENCY_DRIFT_THRESHOLD: 0.10, // 10%
    MIN_REBALANCE_INTERVAL_DAYS: 1,
    MIN_TRADE_VALUE_IRR: 100_000,
  },
};

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationError {
  path: string;
  message: string;
}

function validateConfig(): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate loan limits
  if (config.loans.MAX_TOTAL_LOAN_PCT <= 0 || config.loans.MAX_TOTAL_LOAN_PCT > 1) {
    errors.push({
      path: 'loans.MAX_TOTAL_LOAN_PCT',
      message: `Must be between 0 and 1, got ${config.loans.MAX_TOTAL_LOAN_PCT}`,
    });
  }

  // Validate LTV values
  for (const [layer, ltv] of Object.entries(config.loans.LTV_BY_LAYER)) {
    if (ltv <= 0 || ltv > 1) {
      errors.push({
        path: `loans.LTV_BY_LAYER.${layer}`,
        message: `LTV must be between 0 and 1, got ${ltv}`,
      });
    }
  }

  // Validate protection duration
  if (config.protection.MIN_MONTHS < 1) {
    errors.push({
      path: 'protection.MIN_MONTHS',
      message: `Must be at least 1, got ${config.protection.MIN_MONTHS}`,
    });
  }
  if (config.protection.MAX_MONTHS < config.protection.MIN_MONTHS) {
    errors.push({
      path: 'protection.MAX_MONTHS',
      message: `Must be >= MIN_MONTHS (${config.protection.MIN_MONTHS}), got ${config.protection.MAX_MONTHS}`,
    });
  }

  // Validate polling intervals
  if (config.pricePolling.BASE_INTERVAL_MS < 1000) {
    errors.push({
      path: 'pricePolling.BASE_INTERVAL_MS',
      message: `Must be at least 1000ms, got ${config.pricePolling.BASE_INTERVAL_MS}`,
    });
  }

  // Validate rebalance thresholds
  if (config.rebalance.DRIFT_THRESHOLD >= config.rebalance.EMERGENCY_DRIFT_THRESHOLD) {
    errors.push({
      path: 'rebalance.DRIFT_THRESHOLD',
      message: `Must be less than EMERGENCY_DRIFT_THRESHOLD (${config.rebalance.EMERGENCY_DRIFT_THRESHOLD})`,
    });
  }

  // Validate FX rate
  if (config.env.FALLBACK_USD_IRR < 100000) {
    errors.push({
      path: 'env.FALLBACK_USD_IRR',
      message: `Suspiciously low FX rate: ${config.env.FALLBACK_USD_IRR}`,
    });
  }

  return errors;
}

// Run validation in development mode
if (config.env.IS_DEV) {
  const errors = validateConfig();
  if (errors.length > 0) {
    console.warn('[Config] Validation errors:');
    errors.forEach(e => console.warn(`  - ${e.path}: ${e.message}`));
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { AppConfig, EnvConfig };
export { validateConfig };
