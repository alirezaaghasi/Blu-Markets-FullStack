// Currency Formatting Utilities
// Handles IRR/USD display with proper formatting

// Assets that should only show IRR (no USD equivalent)
const IRR_ONLY_ASSETS = ['IRR_FIXED_INCOME'];

/**
 * Format a number with commas and optional abbreviation
 * Examples: 1,234,567 or 1.2M or 1.5B
 */
export const formatNumber = (num: number, abbreviate: boolean = false): string => {
  if (num === null || num === undefined || isNaN(num)) {
    return '--';
  }

  if (abbreviate) {
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(1)}B`;
    }
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    }
  }

  return num.toLocaleString('en-US');
};

/**
 * Format IRR amount with currency label
 */
export const formatIRR = (amount: number, abbreviate: boolean = false): string => {
  return `${formatNumber(amount, abbreviate)} IRR`;
};

/**
 * Format USD amount with currency label
 */
export const formatUSD = (amount: number): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '--';
  }

  // For small amounts, show more decimals
  if (amount < 1) {
    return `$${amount.toFixed(4)}`;
  }
  if (amount < 100) {
    return `$${amount.toFixed(2)}`;
  }

  return `$${formatNumber(amount)}`;
};

/**
 * Check if an asset should show USD equivalent
 */
export const shouldShowUsdEquivalent = (assetId: string): boolean => {
  return !IRR_ONLY_ASSETS.includes(assetId);
};

/**
 * Convert IRR to USD using the current FX rate
 */
export const irrToUsd = (amountIrr: number, fxRate: number): number => {
  if (!fxRate || fxRate === 0 || isNaN(fxRate)) {
    return 0;
  }
  return amountIrr / fxRate;
};

/**
 * Format both IRR and USD values
 * Returns { irr: "1,234,567 IRR", usd: "$1,990" }
 *
 * BACKEND-DERIVED VALUES: Prefer backendUsd when available to avoid
 * client-side FX conversion divergence from backend calculations.
 */
export const formatDualCurrency = (
  amountIrr: number,
  fxRate: number,
  assetId?: string,
  abbreviate: boolean = false,
  backendUsd?: number  // BACKEND-DERIVED: Use when backend provides USD value
): { irr: string; usd: string | null } => {
  const irr = formatIRR(amountIrr, abbreviate);

  // Don't show USD for IRR-only assets
  if (assetId && !shouldShowUsdEquivalent(assetId)) {
    return { irr, usd: null };
  }

  // BACKEND-DERIVED: Prefer backend-provided USD value when available
  // Only fall back to client-side conversion if backend didn't provide it
  const usdAmount = backendUsd !== undefined && backendUsd > 0
    ? backendUsd
    : irrToUsd(amountIrr, fxRate);
  const usd = usdAmount > 0 ? formatUSD(usdAmount) : null;

  return { irr, usd };
};

/**
 * Format percentage with % suffix
 * @param value - The percentage value (e.g., 50 for 50%)
 * @param decimals - Number of decimal places (default: 1)
 */
export const formatPercent = (value: number, decimals: number = 1): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '--%';
  }
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format crypto quantity with appropriate decimal places
 */
export const formatCryptoQuantity = (quantity: number, symbol: string): string => {
  if (quantity === null || quantity === undefined || isNaN(quantity)) {
    return '--';
  }

  // Different decimal places based on typical values
  if (symbol === 'BTC') {
    return quantity.toFixed(6);
  }
  if (symbol === 'ETH') {
    return quantity.toFixed(5);
  }
  if (['USDT', 'USDC', 'DAI'].includes(symbol)) {
    return quantity.toFixed(2);
  }

  // Default: up to 4 decimal places, removing trailing zeros
  return parseFloat(quantity.toFixed(4)).toString();
};
