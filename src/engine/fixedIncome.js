/**
 * IRR Fixed Income Calculations
 *
 * Model: Fixed unit price + accrued interest
 * - Unit price: 500,000 IRR
 * - Annual rate: 30%
 * - Interest type: Simple interest (matches Iranian bank practice)
 */

export const FIXED_INCOME_UNIT_PRICE = 500_000;  // IRR per unit
export const FIXED_INCOME_ANNUAL_RATE = 0.30;    // 30% annual

/**
 * Calculate fixed income value breakdown
 *
 * @param {number} quantity - Number of units held
 * @param {string} purchasedAt - ISO timestamp of purchase
 * @returns {Object} { principal, accrued, total, daysHeld, dailyRate }
 */
export function calculateFixedIncomeValue(quantity, purchasedAt) {
  const principal = quantity * FIXED_INCOME_UNIT_PRICE;

  if (!purchasedAt) {
    return {
      principal,
      accrued: 0,
      total: principal,
      daysHeld: 0,
      dailyRate: 0,
    };
  }

  const now = Date.now();
  const purchased = new Date(purchasedAt).getTime();
  const daysHeld = Math.max(0, (now - purchased) / (1000 * 60 * 60 * 24));

  // Simple interest: P × r × (days/365)
  const accrued = Math.round(principal * FIXED_INCOME_ANNUAL_RATE * (daysHeld / 365));

  // Daily rate for display
  const dailyRate = principal * FIXED_INCOME_ANNUAL_RATE / 365;

  return {
    principal,
    accrued,
    total: principal + accrued,
    daysHeld: Math.floor(daysHeld),
    dailyRate: Math.round(dailyRate),
  };
}

/**
 * Convert IRR amount to fixed income units
 * Used when buying fixed income
 *
 * @param {number} amountIRR - Amount in IRR to invest
 * @returns {number} Number of units (can be fractional)
 */
export function irrToFixedIncomeUnits(amountIRR) {
  return amountIRR / FIXED_INCOME_UNIT_PRICE;
}

/**
 * Convert fixed income units to IRR (principal only)
 * Used for display and calculations
 *
 * @param {number} units - Number of units
 * @returns {number} Principal value in IRR
 */
export function fixedIncomeUnitsToIRR(units) {
  return units * FIXED_INCOME_UNIT_PRICE;
}
