// Currency Formatting Utilities
// Handles IRR/USD display with proper formatting
// Updated: 2026-01-29 - UX Spec Implementation (UX-003)
//
// DECIMAL PRECISION RULES (per UX spec):
// - IRR (fiat): No decimals, use abbreviations (e.g., "149.9M IRR")
// - USDT: Always 2 decimals (e.g., "103.14 USDT")
// - Crypto (BTC, ETH, etc.): Max 4 decimals (e.g., "0.0008 BTC")

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
 * Format crypto quantity with MAX 4 DECIMALS (per UX spec UX-003)
 *
 * Examples:
 *   0.00084123  → "0.0008" (4 decimals max)
 *   0.009277    → "0.0093" (4 decimals)
 *   7.5805      → "7.58" (2 decimals for values >= 1)
 *   0.172369    → "0.17" (2 decimals for values >= 0.1)
 *   125.789     → "125.8" (1 decimal for values >= 100)
 *
 * @param quantity - The crypto quantity to format
 * @param symbol - Optional symbol to append (e.g., "BTC")
 */
export const formatCrypto = (quantity: number, symbol?: string): string => {
  if (quantity === null || quantity === undefined || isNaN(quantity)) {
    return symbol ? `-- ${symbol}` : '--';
  }

  let formatted: string;
  const MAX_DECIMALS = 4; // UX spec: max 4 decimals for crypto

  if (quantity >= 100) {
    // Large numbers: 1 decimal place
    formatted = quantity.toFixed(1);
  } else if (quantity >= 1) {
    // Numbers 1-99: 2 decimal places
    formatted = quantity.toFixed(2);
  } else if (quantity === 0) {
    formatted = '0';
  } else {
    // Small numbers: use up to MAX_DECIMALS
    // Round to 4 decimal places max per UX spec
    formatted = quantity.toFixed(MAX_DECIMALS);
    // Remove trailing zeros but keep at least one decimal
    formatted = formatted.replace(/\.?0+$/, '') || '0';
    // Ensure we have proper decimal format
    if (!formatted.includes('.') && quantity < 1 && quantity > 0) {
      formatted = quantity.toFixed(MAX_DECIMALS).replace(/0+$/, '');
    }
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
 * Format USD amount with currency label (always 2 decimals per UX spec)
 */
export const formatUSD = (amount: number): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '--';
  }

  // UX spec: always 2 decimals for USD
  if (amount >= 1000) {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${amount.toFixed(2)}`;
};

/**
 * Format USDT amount (stablecoin) - ALWAYS 2 decimals per UX spec UX-003
 *
 * Examples:
 *   103.144960 → "103.14 USDT"
 *   1000.5     → "1,000.50 USDT"
 *
 * @param amount - The USDT amount to format
 * @param showSymbol - Whether to show "USDT" suffix (default: true)
 */
export const formatUSDT = (amount: number, showSymbol: boolean = true): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? '-- USDT' : '--';
  }

  const suffix = showSymbol ? ' USDT' : '';

  // UX spec UX-003: USDT always 2 decimals
  if (amount >= 1000) {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
  }
  return `${amount.toFixed(2)}${suffix}`;
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
