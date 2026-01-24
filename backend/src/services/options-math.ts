/**
 * Options Math Library
 * Black-Scholes pricing and Greeks calculations for protection feature
 *
 * @module services/options-math
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Risk-free interest rate (annual) */
export const RISK_FREE_RATE = 0.045;

/** Days per year for time conversion */
export const DAYS_PER_YEAR = 365;

/** Precision for percentage calculations (8 decimal places) */
const PCT_PRECISION = 8;

/** Precision for monetary calculations (2 decimal places) */
const MONEY_PRECISION = 2;

/**
 * Round to specified decimal places to avoid floating-point precision issues
 * MEDIUM-3 FIX: Added to prevent floating-point accumulation errors
 */
function roundToDecimal(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ============================================================================
// STATISTICAL FUNCTIONS
// ============================================================================

/**
 * Standard normal cumulative distribution function (CDF)
 * Uses Abramowitz and Stegun approximation (error < 7.5e-8)
 */
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Standard normal probability density function (PDF)
 */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ============================================================================
// BLACK-SCHOLES CORE
// ============================================================================

/**
 * Calculate d1 and d2 for Black-Scholes formula
 *
 * @param spot - Current spot price
 * @param strike - Strike price
 * @param timeYears - Time to expiry in years
 * @param vol - Implied volatility (annualized, e.g., 0.55 for 55%)
 * @param rate - Risk-free rate (annualized)
 */
export function calculateD1D2(
  spot: number,
  strike: number,
  timeYears: number,
  vol: number,
  rate: number = RISK_FREE_RATE
): { d1: number; d2: number } {
  if (timeYears <= 0 || vol <= 0 || spot <= 0 || strike <= 0) {
    return { d1: 0, d2: 0 };
  }

  const sqrtT = Math.sqrt(timeYears);
  const d1 = (Math.log(spot / strike) + (rate + 0.5 * vol * vol) * timeYears) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;

  return { d1, d2 };
}

/**
 * Black-Scholes Put Option Price
 *
 * P = K × e^(-rT) × N(-d₂) - S × N(-d₁)
 *
 * @param spot - Current spot price
 * @param strike - Strike price
 * @param timeYears - Time to expiry in years
 * @param vol - Implied volatility (annualized)
 * @param rate - Risk-free rate (annualized)
 * @returns Put option price
 */
export function blackScholesPut(
  spot: number,
  strike: number,
  timeYears: number,
  vol: number,
  rate: number = RISK_FREE_RATE
): number {
  if (timeYears <= 0) {
    // At expiry, return intrinsic value
    return Math.max(0, strike - spot);
  }

  const { d1, d2 } = calculateD1D2(spot, strike, timeYears, vol, rate);
  const discountFactor = Math.exp(-rate * timeYears);

  const putPrice = strike * discountFactor * normalCDF(-d2) - spot * normalCDF(-d1);

  // MEDIUM-3 FIX: Round to avoid floating-point precision issues
  return roundToDecimal(Math.max(0, putPrice), PCT_PRECISION);
}

/**
 * Black-Scholes Call Option Price
 *
 * C = S × N(d₁) - K × e^(-rT) × N(d₂)
 *
 * @param spot - Current spot price
 * @param strike - Strike price
 * @param timeYears - Time to expiry in years
 * @param vol - Implied volatility (annualized)
 * @param rate - Risk-free rate (annualized)
 * @returns Call option price
 */
export function blackScholesCall(
  spot: number,
  strike: number,
  timeYears: number,
  vol: number,
  rate: number = RISK_FREE_RATE
): number {
  if (timeYears <= 0) {
    // At expiry, return intrinsic value
    return Math.max(0, spot - strike);
  }

  const { d1, d2 } = calculateD1D2(spot, strike, timeYears, vol, rate);
  const discountFactor = Math.exp(-rate * timeYears);

  const callPrice = spot * normalCDF(d1) - strike * discountFactor * normalCDF(d2);

  return Math.max(0, callPrice);
}

// ============================================================================
// GREEKS
// ============================================================================

export interface PutGreeks {
  delta: number; // Rate of change of option price w.r.t. spot price
  gamma: number; // Rate of change of delta w.r.t. spot price
  vega: number; // Rate of change of option price w.r.t. volatility (per 1% vol change)
  theta: number; // Rate of change of option price w.r.t. time (per day)
  rho: number; // Rate of change of option price w.r.t. interest rate (per 1% rate change)
}

/**
 * Calculate all Greeks for a put option
 *
 * @param spot - Current spot price
 * @param strike - Strike price
 * @param timeYears - Time to expiry in years
 * @param vol - Implied volatility (annualized)
 * @param rate - Risk-free rate (annualized)
 * @returns Object containing all Greeks
 */
export function calculatePutGreeks(
  spot: number,
  strike: number,
  timeYears: number,
  vol: number,
  rate: number = RISK_FREE_RATE
): PutGreeks {
  if (timeYears <= 0 || vol <= 0 || spot <= 0 || strike <= 0) {
    return { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 };
  }

  const { d1, d2 } = calculateD1D2(spot, strike, timeYears, vol, rate);
  const sqrtT = Math.sqrt(timeYears);
  const discountFactor = Math.exp(-rate * timeYears);
  const pdf_d1 = normalPDF(d1);

  // Delta: ∂P/∂S = N(d1) - 1
  const delta = normalCDF(d1) - 1;

  // Gamma: ∂²P/∂S² = φ(d1) / (S × σ × √T)
  const gamma = pdf_d1 / (spot * vol * sqrtT);

  // Vega: ∂P/∂σ = S × φ(d1) × √T
  // Scaled to per 1% (0.01) volatility change
  const vega = (spot * pdf_d1 * sqrtT) / 100;

  // Theta: ∂P/∂t for a put
  // θ = -[S × φ(d1) × σ / (2√T)] + r × K × e^(-rT) × N(-d2)
  // Scaled to per day
  const theta =
    (-(spot * pdf_d1 * vol) / (2 * sqrtT) + rate * strike * discountFactor * normalCDF(-d2)) /
    DAYS_PER_YEAR;

  // Rho: ∂P/∂r = -K × T × e^(-rT) × N(-d2)
  // Scaled to per 1% (0.01) rate change
  const rho = (-strike * timeYears * discountFactor * normalCDF(-d2)) / 100;

  return { delta, gamma, vega, theta, rho };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert duration in days to years
 */
export function daysToYears(days: number): number {
  return days / DAYS_PER_YEAR;
}

/**
 * Calculate moneyness (spot/strike ratio)
 */
export function calculateMoneyness(spot: number, strike: number): number {
  if (strike <= 0) {
    throw new Error('Strike must be positive');
  }
  return spot / strike;
}

/**
 * Calculate intrinsic value of a put option
 */
export function putIntrinsicValue(spot: number, strike: number): number {
  return Math.max(0, strike - spot);
}

/**
 * Calculate time value of a put option
 */
export function putTimeValue(
  spot: number,
  strike: number,
  timeYears: number,
  vol: number,
  rate: number = RISK_FREE_RATE
): number {
  const totalValue = blackScholesPut(spot, strike, timeYears, vol, rate);
  const intrinsic = putIntrinsicValue(spot, strike);
  return totalValue - intrinsic;
}

/**
 * Check if put option is in the money (ITM)
 */
export function isPutITM(spot: number, strike: number): boolean {
  return spot < strike;
}

/**
 * Check if put option is at the money (ATM)
 * Uses 1% tolerance
 */
export function isPutATM(spot: number, strike: number, tolerance: number = 0.01): boolean {
  return Math.abs(spot - strike) / strike <= tolerance;
}

/**
 * Check if put option is out of the money (OTM)
 */
export function isPutOTM(spot: number, strike: number): boolean {
  return spot > strike;
}

// ============================================================================
// PREMIUM CALCULATION WITH SPREADS
// ============================================================================

export interface PremiumBreakdown {
  fairValue: number; // Black-Scholes theoretical value
  fairValuePct: number; // As percentage of notional
  executionSpread: number; // Bid-ask spread cost
  executionSpreadPct: number;
  profitMargin: number; // Platform profit
  profitMarginPct: number;
  totalPremium: number; // Final premium charged
  totalPremiumPct: number;
}

/**
 * Calculate full premium with spreads and margins
 *
 * @param spot - Current spot price (USD)
 * @param strike - Strike price (USD)
 * @param timeYears - Time to expiry in years
 * @param vol - Implied volatility
 * @param notionalUsd - Notional amount in USD
 * @param executionSpreadPct - Execution spread (e.g., 0.004 for 0.4%)
 * @param profitMarginPct - Profit margin (e.g., 0.002 for 0.2%)
 * @param rate - Risk-free rate
 */
export function calculatePremiumWithSpreads(
  spot: number,
  strike: number,
  timeYears: number,
  vol: number,
  notionalUsd: number,
  executionSpreadPct: number,
  profitMarginPct: number,
  rate: number = RISK_FREE_RATE
): PremiumBreakdown {
  // Fair value as percentage of spot (which equals notional for ATM)
  const fairValuePct = blackScholesPut(1, strike / spot, timeYears, vol, rate);
  const fairValue = roundToDecimal(fairValuePct * notionalUsd, MONEY_PRECISION);

  const executionSpread = roundToDecimal(notionalUsd * executionSpreadPct, MONEY_PRECISION);
  const profitMargin = roundToDecimal(notionalUsd * profitMarginPct, MONEY_PRECISION);

  const totalPremium = roundToDecimal(fairValue + executionSpread + profitMargin, MONEY_PRECISION);
  const totalPremiumPct = roundToDecimal(totalPremium / notionalUsd, PCT_PRECISION);

  return {
    fairValue,
    fairValuePct,
    executionSpread,
    executionSpreadPct,
    profitMargin,
    profitMarginPct,
    totalPremium,
    totalPremiumPct,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate input parameters for Black-Scholes calculation
 */
export function validateBSInputs(
  spot: number,
  strike: number,
  timeYears: number,
  vol: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (spot <= 0) errors.push('Spot price must be positive');
  if (strike <= 0) errors.push('Strike price must be positive');
  if (timeYears < 0) errors.push('Time to expiry cannot be negative');
  if (vol <= 0) errors.push('Volatility must be positive');
  if (vol > 5) errors.push('Volatility seems unreasonably high (>500%)');

  return { valid: errors.length === 0, errors };
}
