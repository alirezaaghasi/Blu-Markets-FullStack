// Currency Formatting Utilities
// Handles IRR/USD display with proper formatting
// Updated: 2026-01-29 - UI Enhancement Tasks 1, 24, 25

// Assets that should only show IRR (no USD equivalent)
const IRR_ONLY_ASSETS = ['IRR_FIXED_INCOME'];

/**
 * Format decimal value for display
 * - Values >= 100: no decimal (e.g., "877")
 * - Values < 100: one decimal if needed (e.g., "2.2", "36.6")
 */
function formatDecimal(value: number): string {
  if (value >= 100) return Math.round(value).toString();
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
}

/**
 * Format IRR amount with smart abbreviation
 *
 * Examples:
 *   2,200,000,000 → "2.2B IRR"
 *   877,030,665   → "877M IRR"
 *   36,599,130    → "36.6M IRR"
 *   500,000       → "500K IRR"
 *   850           → "850 IRR"
 *
 * @param amount - The IRR amount to format
 * @param options - Optional settings
 * @param options.showUnit - Whether to show "IRR" suffix (default: true)
 */
export const formatIRR = (
  amount: number,
  options?: { showUnit?: boolean } | boolean // Support legacy boolean parameter
): string => {
  // Handle null/undefined/NaN
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '--';
  }

  // Handle legacy boolean parameter for backwards compatibility
  const showUnit = typeof options === 'boolean'
    ? true  // Legacy: abbreviate parameter, always show unit
    : (options?.showUnit ?? true);

  const suffix = showUnit ? ' IRR' : '';
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 1_000_000_000) {
    const value = absAmount / 1_000_000_000;
    return `${sign}${formatDecimal(value)}B${suffix}`;
  }
  if (absAmount >= 1_000_000) {
    const value = absAmount / 1_000_000;
    return `${sign}${formatDecimal(value)}M${suffix}`;
  }
  if (absAmount >= 1_000) {
    const value = absAmount / 1_000;
    return `${sign}${formatDecimal(value)}K${suffix}`;
  }
  return `${sign}${Math.round(absAmount)}${suffix}`;
};

/**
 * Format a number with commas (legacy function for backwards compatibility)
 */
export const formatNumber = (num: number, abbreviate: boolean = false): string => {
  if (num === null || num === undefined || isNaN(num)) {
    return '--';
  }

  if (abbreviate) {
    return formatIRR(num, { showUnit: false });
  }

  return num.toLocaleString('en-US');
};

/**
 * Format crypto quantity with max 2 significant digits
 *
 * Examples:
 *   0.009277    → "0.0093"
 *   0.00038503  → "0.0004"
 *   7.5805      → "7.58"
 *   0.172369    → "0.17"
 *   125.789     → "125.8"
 *
 * @param quantity - The crypto quantity to format
 * @param symbol - Optional symbol to append (e.g., "BTC")
 */
export const formatCrypto = (quantity: number, symbol?: string): string => {
  if (quantity === null || quantity === undefined || isNaN(quantity)) {
    return symbol ? `-- ${symbol}` : '--';
  }

  let formatted: string;

  if (quantity >= 100) {
    // Large numbers: 1 decimal place
    formatted = quantity.toFixed(1);
  } else if (quantity >= 1) {
    // Numbers 1-99: 2 decimal places
    formatted = quantity.toFixed(2);
  } else if (quantity === 0) {
    formatted = '0';
  } else {
    // Small numbers: count leading zeros after decimal, then add 2 significant digits
    const str = quantity.toString();
    const match = str.match(/^0\.(0*)/);
    const leadingZeros = match ? match[1].length : 0;
    formatted = quantity.toFixed(leadingZeros + 2);
  }

  return symbol ? `${formatted} ${symbol}` : formatted;
};

// Legacy alias for backwards compatibility
export const formatCryptoQuantity = formatCrypto;

/**
 * Format percentage - no decimals by default
 *
 * Examples:
 *   11.2  → "11%"
 *   45.7  → "46%"
 *   100.0 → "100%"
 *
 * @param value - The percentage value
 * @param decimals - Optional decimal places (default: 0)
 */
export const formatPercent = (value: number, decimals: number = 0): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '--%';
  }
  if (decimals === 0) {
    return `${Math.round(value)}%`;
  }
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format date for display
 *
 * Examples:
 *   "2026-03-01" → "Mar 1" (without year)
 *   "2026-03-01" → "Mar 1, 2026" (with year)
 *
 * @param isoDate - ISO date string
 * @param includeYear - Whether to include the year (default: false)
 */
export const formatDate = (isoDate: string, includeYear: boolean = false): string => {
  if (!isoDate) return '--';

  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '--';

  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (includeYear) options.year = 'numeric';

  return date.toLocaleDateString('en-US', options);
};

/**
 * Get friendly asset name from asset ID
 *
 * Examples:
 *   'PAXG' → 'Gold'
 *   'BTC'  → 'Bitcoin'
 *   'KAG'  → 'Silver'
 */
export const getAssetName = (assetId: string): string => {
  const names: Record<string, string> = {
    'PAXG': 'Gold',
    'KAG': 'Silver',
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'USDT': 'US Dollar',
    'SOL': 'Solana',
    'MATIC': 'Polygon',
    'BNB': 'Binance Coin',
    'XRP': 'Ripple',
    'TON': 'TON Coin',
    'LINK': 'Chainlink',
    'AVAX': 'Avalanche',
    'ARB': 'Arbitrum',
    'QQQ': 'NASDAQ 100',
    'IRR_FIXED_INCOME': 'Fixed Income',
  };
  return names[assetId] || assetId;
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
 * Returns { irr: "1.2B IRR", usd: "$1,990" }
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
  const irr = formatIRR(amountIrr);

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
