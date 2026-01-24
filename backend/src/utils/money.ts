/**
 * Safe Money Arithmetic Utilities
 *
 * Uses Decimal.js to avoid floating-point precision errors in monetary calculations.
 * All money/quantity calculations should use these functions instead of native JS arithmetic.
 *
 * @module utils/money
 */

import { Decimal } from 'decimal.js';

// Configure for financial calculations
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_EVEN  // Banker's rounding
});

/**
 * Convert any numeric input to Decimal
 */
export function toDecimal(value: number | string | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined) {
    return new Decimal(0);
  }
  return new Decimal(value);
}

/**
 * Multiply values safely
 */
export function multiply(...values: (number | string | Decimal)[]): Decimal {
  return values.reduce(
    (acc: Decimal, val) => acc.mul(toDecimal(val)),
    new Decimal(1)
  );
}

/**
 * Add values safely
 */
export function add(...values: (number | string | Decimal)[]): Decimal {
  return values.reduce(
    (acc: Decimal, val) => acc.plus(toDecimal(val)),
    new Decimal(0)
  );
}

/**
 * Subtract values safely (a - b - c - ...)
 */
export function subtract(first: number | string | Decimal, ...rest: (number | string | Decimal)[]): Decimal {
  return rest.reduce(
    (acc: Decimal, val) => acc.minus(toDecimal(val)),
    toDecimal(first)
  );
}

/**
 * Divide safely with precision
 */
export function divide(numerator: number | string | Decimal, denominator: number | string | Decimal): Decimal {
  const denom = toDecimal(denominator);
  if (denom.isZero()) {
    throw new Error('Division by zero');
  }
  return toDecimal(numerator).div(denom);
}

/**
 * Calculate percentage: value * (percent / 100)
 */
export function percentage(value: number | string | Decimal, percent: number | string | Decimal): Decimal {
  return toDecimal(value).mul(toDecimal(percent)).div(100);
}

/**
 * Round to IRR (whole numbers for Iranian Rial)
 */
export function roundIrr(value: Decimal): Decimal {
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

/**
 * Round to USD (2 decimal places)
 */
export function roundUsd(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Round crypto quantity (8 decimal places)
 */
export function roundCrypto(value: Decimal): Decimal {
  return value.toDecimalPlaces(8, Decimal.ROUND_DOWN);
}

/**
 * Round percentage (4 decimal places for rates like 0.0075)
 */
export function roundPct(value: Decimal): Decimal {
  return value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

/**
 * Convert Decimal to number for Prisma/JSON
 * Use only at the boundary (saving to DB or returning to client)
 */
export function toNumber(value: Decimal): number {
  return value.toNumber();
}

/**
 * Compare values: returns -1, 0, or 1
 */
export function compare(a: number | string | Decimal, b: number | string | Decimal): number {
  return toDecimal(a).comparedTo(toDecimal(b));
}

/**
 * Check if value is greater than threshold
 */
export function isGreaterThan(value: number | string | Decimal, threshold: number | string | Decimal): boolean {
  return toDecimal(value).greaterThan(toDecimal(threshold));
}

/**
 * Check if value is greater than or equal to threshold
 */
export function isGreaterThanOrEqual(value: number | string | Decimal, threshold: number | string | Decimal): boolean {
  return toDecimal(value).greaterThanOrEqualTo(toDecimal(threshold));
}

/**
 * Check if value is less than threshold
 */
export function isLessThan(value: number | string | Decimal, threshold: number | string | Decimal): boolean {
  return toDecimal(value).lessThan(toDecimal(threshold));
}

/**
 * Check if value is less than or equal to threshold
 */
export function isLessThanOrEqual(value: number | string | Decimal, threshold: number | string | Decimal): boolean {
  return toDecimal(value).lessThanOrEqualTo(toDecimal(threshold));
}

/**
 * Get minimum of values
 */
export function min(...values: (number | string | Decimal)[]): Decimal {
  return Decimal.min(...values.map(v => toDecimal(v)));
}

/**
 * Get maximum of values
 */
export function max(...values: (number | string | Decimal)[]): Decimal {
  return Decimal.max(...values.map(v => toDecimal(v)));
}

/**
 * Calculate LTV: (loanAmount / collateralValue)
 * Returns as decimal (e.g., 0.70 for 70%)
 */
export function calculateLtv(loanAmount: number | string | Decimal, collateralValue: number | string | Decimal): Decimal {
  const collateral = toDecimal(collateralValue);
  if (collateral.isZero()) {
    return new Decimal(0);
  }
  return divide(loanAmount, collateralValue);
}

/**
 * Calculate max loan from collateral and LTV ratio
 */
export function calculateMaxLoan(collateralValue: number | string | Decimal, ltvRatio: number | string | Decimal): Decimal {
  return multiply(collateralValue, ltvRatio);
}

/**
 * Calculate simple interest: principal * rate * (months / 12)
 * For monthly periods
 */
export function calculateSimpleInterestMonthly(
  principal: number | string | Decimal,
  annualRate: number | string | Decimal,
  months: number
): Decimal {
  return multiply(principal, annualRate, months).div(12);
}

/**
 * Calculate simple interest: principal * rate * (days / 365)
 * For daily periods
 */
export function calculateSimpleInterestDaily(
  principal: number | string | Decimal,
  annualRate: number | string | Decimal,
  days: number
): Decimal {
  return multiply(principal, annualRate, days).div(365);
}

/**
 * Apply spread to price: price * (1 + spread)
 * For buy orders (add spread)
 */
export function applyBuySpread(price: number | string | Decimal, spread: number | string | Decimal): Decimal {
  return toDecimal(price).mul(toDecimal(1).plus(toDecimal(spread)));
}

/**
 * Apply spread to price: price * (1 - spread)
 * For sell orders (subtract spread)
 */
export function applySellSpread(price: number | string | Decimal, spread: number | string | Decimal): Decimal {
  return toDecimal(price).mul(toDecimal(1).minus(toDecimal(spread)));
}

/**
 * Calculate quantity from amount and price
 * quantity = amount / price
 */
export function calculateQuantity(amount: number | string | Decimal, price: number | string | Decimal): Decimal {
  return divide(amount, price);
}

/**
 * Calculate total value: quantity * price
 */
export function calculateValue(quantity: number | string | Decimal, price: number | string | Decimal): Decimal {
  return multiply(quantity, price);
}

/**
 * Distribute amount across allocations ensuring sum equals total
 * Returns array of allocated amounts with remainder added to first allocation
 */
export function distributeAmount(
  total: number | string | Decimal,
  percentages: (number | string | Decimal)[]
): Decimal[] {
  const totalDecimal = toDecimal(total);
  const allocations = percentages.map(pct =>
    roundIrr(multiply(totalDecimal, pct))
  );

  const allocated = allocations.reduce((sum, val) => sum.plus(val), new Decimal(0));
  const remainder = totalDecimal.minus(allocated);

  // Add remainder to first (largest) allocation
  if (!remainder.isZero() && allocations.length > 0) {
    allocations[0] = allocations[0].plus(remainder);
  }

  return allocations;
}

/**
 * Check if two decimal values are equal within tolerance
 * Useful for comparing calculated values that might have tiny differences
 */
export function isEqual(
  a: number | string | Decimal,
  b: number | string | Decimal,
  tolerance: number | string | Decimal = 0
): boolean {
  const diff = toDecimal(a).minus(toDecimal(b)).abs();
  return diff.lessThanOrEqualTo(toDecimal(tolerance));
}

// Re-export Decimal class for advanced usage
export { Decimal };
