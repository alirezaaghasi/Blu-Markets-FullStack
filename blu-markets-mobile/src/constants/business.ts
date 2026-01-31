// Business Logic Constants
// Based on PRD Section 25 - Configuration Constants

import { Layer, TargetLayerPct } from '../types';

// Currency & Pricing
export const DEFAULT_FX_RATE = 1_456_000; // IRR per USD
export const FIXED_INCOME_UNIT_PRICE = 500_000; // IRR per unit (500K IRR per PRD Section 25)
export const FIXED_INCOME_ANNUAL_RATE = 0.30; // 30% annual

// Trading
export const MIN_TRADE_AMOUNT = 1_000_000; // IRR - must match backend minimum (1M)
export const MIN_REBALANCE_TRADE = 1_000_000; // IRR - must match backend minimum

// Spread by Layer
export const SPREAD_BY_LAYER: Record<Layer, number> = {
  FOUNDATION: 0.0015, // 0.15%
  GROWTH: 0.0030,     // 0.30%
  UPSIDE: 0.0060,     // 0.60%
};

// Layer Constraints (per PRD Rebalancing Rules)
export const LAYER_CONSTRAINTS: Record<Layer, {
  minTarget: number;
  maxTarget: number;
  hardMin?: number;
  hardMax?: number;
  driftTolerance: number;
}> = {
  FOUNDATION: {
    minTarget: 0.30,
    maxTarget: 0.85,
    hardMin: 0.30,
    driftTolerance: 0.05,
  },
  GROWTH: {
    minTarget: 0.12,
    maxTarget: 0.45,
    driftTolerance: 0.05,
  },
  UPSIDE: {
    minTarget: 0.03,
    maxTarget: 0.30,
    hardMax: 0.25,
    driftTolerance: 0.05,
  },
};

// Portfolio Drift
export const DRIFT_TOLERANCE = 0.05; // 5%
export const EMERGENCY_DRIFT = 0.10; // 10% bypasses time requirement
export const MIN_REBALANCE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

// Loans - Per PRD Section 25: 30% APR, 3/6 month terms, 6 installments
export const LOAN_DAILY_INTEREST_RATE = 0.30 / 365; // ~0.082% daily for 30% APR
export const LOAN_ANNUAL_INTEREST_RATE = 0.30; // 30% annual per business rules
export const MAX_PORTFOLIO_LOAN_PCT = 0.25; // 25%
export const LOAN_INSTALLMENT_COUNT = 6;
export const LOAN_DURATION_OPTIONS = [90, 180] as const; // 3 and 6 months per PRD
export const LOAN_MIN_DURATION_DAYS = 90;
export const LOAN_MAX_DURATION_DAYS = 180;
export const LOAN_DEFAULT_DURATION_DAYS = 90;
// Human-readable labels for loan durations
export const LOAN_DURATION_LABELS: Record<number, string> = {
  90: '3 Months',
  180: '6 Months',
};
// Minimum loan amount
export const LOAN_MIN_AMOUNT = 1_000_000; // 1M IRR per PRD

// LTV by Layer (fallback if asset-specific not available)
export const LTV_BY_LAYER: Record<Layer, number> = {
  FOUNDATION: 0.70,
  GROWTH: 0.50,
  UPSIDE: 0.30, // Matches asset-level LTVs in assets.ts
};

// Protection - Duration options (in days, displayed as months)
export const PROTECTION_DURATION_PRESETS = [30, 90, 180] as const; // 1, 3, 6 months
export const PROTECTION_MIN_DURATION_DAYS = 30;
export const PROTECTION_MAX_DURATION_DAYS = 180;
export const PROTECTION_DEFAULT_DURATION_DAYS = 90; // Default to 3 months

// Helper to display duration as months
export const PROTECTION_DURATION_LABELS: Record<number, string> = {
  30: '1 Month',
  90: '3 Months',
  180: '6 Months',
};

// Protection - Coverage percentage
export const PROTECTION_MIN_COVERAGE_PCT = 0.1;  // 10%
export const PROTECTION_MAX_COVERAGE_PCT = 1.0;  // 100%
export const PROTECTION_DEFAULT_COVERAGE_PCT = 1.0; // 100%

// Protection - Eligible assets (per PRD Section 18)
// NOTE: KAG (Silver) is NOT protection-eligible per business rules
export const PROTECTION_ELIGIBLE_ASSETS = [
  'PAXG',                          // FOUNDATION
  'BTC', 'ETH', 'BNB', 'XRP', 'QQQ',  // GROWTH
  'SOL', 'LINK', 'AVAX',           // UPSIDE
] as const;

// Protection - Quote validity
export const PROTECTION_QUOTE_VALIDITY_SECONDS = 300; // 5 minutes

// Protection - Premium tolerance for price changes (must match backend PREMIUM_TOLERANCE)
export const PROTECTION_PREMIUM_TOLERANCE = 0.05; // 5%

// Protection - Minimum notional value (must match backend MIN_NOTIONAL_IRR)
export const PROTECTION_MIN_NOTIONAL_IRR = 1_000_000; // 1M IRR

// Legacy: PREMIUM_BY_LAYER not used (now calculated via Black-Scholes)
export const PROTECTION_PREMIUM_BY_LAYER: Record<Layer, number> = {
  FOUNDATION: 0.004, // 0.4% per month (deprecated, kept for reference)
  GROWTH: 0.008,     // 0.8% per month
  UPSIDE: 0.012,     // 1.2% per month
};

// Activity Log
export const MAX_ACTION_LOG_SIZE = 50;

// Price Polling (fallback when WebSocket unavailable)
export const PRICE_POLLING_INTERVAL_MS = 30_000; // 30 seconds
export const PRICE_MAX_BACKOFF_MS = 300_000; // 5 minutes
export const PRICE_BACKOFF_MULTIPLIER = 1.5;
export const PRICE_HEARTBEAT_MS = 5_000; // 5 seconds

// API Configuration is now centralized in config/api.ts
// Use CONFIGURED_API_URL from there for WebSocket derivation

// WebSocket Configuration
const getWebSocketUrl = () => {
  if (!__DEV__) return 'wss://api.blumarkets.ir/api/v1/prices/stream';

  // Use EXPO_PUBLIC_API_URL environment variable directly to avoid circular imports
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  // Derive WebSocket URL from API_BASE_URL for proper Codespaces support
  // API_BASE_URL like: https://xxx-3000.app.github.dev/api/v1
  // Becomes: wss://xxx-3000.app.github.dev/api/v1/prices/stream
  if (apiUrl.includes('github.dev') || apiUrl.includes('codespaces') || apiUrl.includes('exp.direct')) {
    const wsUrl = apiUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    return `${wsUrl}/prices/stream`;
  }

  // Local development fallback
  return 'ws://localhost:3000/api/v1/prices/stream';
};

export const WEBSOCKET_URL = getWebSocketUrl();
export const WEBSOCKET_RECONNECT_INTERVAL_MS = 3_000; // 3 seconds
// DISABLED: WebSocket doesn't work reliably through Codespaces port forwarding
// The app will use REST polling instead (30-second intervals)
export const WEBSOCKET_ENABLED = false;

// Demo Mode Configuration
// Token used to identify demo mode in DEVELOPMENT ONLY
// SECURITY: Demo mode is completely disabled in production builds
// The __DEV__ check ensures this cannot be bypassed
export const DEMO_MODE_ENABLED = __DEV__ && (process.env.EXPO_PUBLIC_ENABLE_DEMO !== 'false');
export const DEMO_TOKEN = DEMO_MODE_ENABLED ? 'demo-token-dev-only' : '';

// Risk Profile Allocations by Score (per PRD Section 17)
export const RISK_PROFILE_ALLOCATIONS: Record<number, TargetLayerPct> = {
  1: { FOUNDATION: 0.85, GROWTH: 0.12, UPSIDE: 0.03 },
  2: { FOUNDATION: 0.80, GROWTH: 0.15, UPSIDE: 0.05 },
  3: { FOUNDATION: 0.75, GROWTH: 0.18, UPSIDE: 0.07 },
  4: { FOUNDATION: 0.70, GROWTH: 0.22, UPSIDE: 0.08 },
  5: { FOUNDATION: 0.55, GROWTH: 0.35, UPSIDE: 0.10 },
  6: { FOUNDATION: 0.50, GROWTH: 0.35, UPSIDE: 0.15 },
  7: { FOUNDATION: 0.45, GROWTH: 0.37, UPSIDE: 0.18 },
  8: { FOUNDATION: 0.40, GROWTH: 0.38, UPSIDE: 0.22 },
  9: { FOUNDATION: 0.35, GROWTH: 0.40, UPSIDE: 0.25 },
  10: { FOUNDATION: 0.30, GROWTH: 0.40, UPSIDE: 0.30 },
};

// Risk Profile Names
export const RISK_PROFILE_NAMES: Record<number, { en: string; fa: string }> = {
  1: { en: 'Capital Preservation', fa: 'حفظ سرمایه' },
  2: { en: 'Capital Preservation', fa: 'حفظ سرمایه' },
  3: { en: 'Conservative', fa: 'محتاط' },
  4: { en: 'Conservative', fa: 'محتاط' },
  5: { en: 'Balanced', fa: 'متعادل' },
  6: { en: 'Balanced', fa: 'متعادل' },
  7: { en: 'Growth', fa: 'رشدگرا' },
  8: { en: 'Growth', fa: 'رشدگرا' },
  9: { en: 'Aggressive', fa: 'جسور' },
  10: { en: 'Aggressive', fa: 'جسور' },
};

// Boundary Classification Messages
export const BOUNDARY_MESSAGES: Record<string, string> = {
  SAFE: '',
  DRIFT: 'This moves you slightly away from your target. You can rebalance later.',
  STRUCTURAL: 'This is a bigger move from your target. Please review before confirming.',
  STRESS: 'This is a significant change. Please confirm you understand the impact.',
};

// Loan Health Thresholds
export const LOAN_HEALTH_THRESHOLDS = {
  CRITICAL: 0.90,  // 90% LTV - Red
  WARNING: 0.80,   // 80% LTV - Orange
  CAUTION: 0.75,   // 75% LTV - Yellow
  HEALTHY: 0.75,   // Below 75% - Green
};

// Investment Constraints
export const MIN_INVESTMENT_AMOUNT = 1_000_000; // IRR (1M minimum per PRD Section 13.2)

// Phone Validation
export const IRAN_PHONE_PREFIX = '+989';
export const IRAN_PHONE_LENGTH = 13;
