// Utility functions for Blu Markets v10
// Optimization: Cached Intl.NumberFormat instances to avoid repeated allocations

import type { Holding } from './types';
import { DEFAULT_PRICES, DEFAULT_FX_RATE } from './constants/index';
import { calculateFixedIncomeValue } from './engine/fixedIncome';

// Cached formatters - created once at module load
const irrFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const usdFormatterWhole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const usdFormatter2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdFormatter4 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function formatIRR(n: number | string): string {
  return irrFormatter.format(Math.round(Number(n) || 0)) + ' IRR';
}

export function formatIRRShort(n: number | string): string {
  const num = Number(n) || 0;
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

// v10: Format USD price (using cached formatters)
export function formatUSD(n: number | string): string {
  const num = Number(n) || 0;
  if (num >= 1000) {
    return '$' + usdFormatterWhole.format(num);
  }
  if (num >= 1) {
    return '$' + usdFormatter2.format(num);
  }
  return '$' + usdFormatter4.format(num);
}

// v10: Format quantity with appropriate decimals
export function formatQuantity(qty: number | string, assetId: string): string {
  const num = Number(qty) || 0;
  // More decimals for crypto with small quantities
  if (assetId === 'BTC' && num < 1) return num.toFixed(6);
  if (['ETH', 'BNB', 'SOL', 'AVAX'].includes(assetId) && num < 10) return num.toFixed(4);
  if (['XRP', 'TON', 'LINK', 'MATIC', 'ARB'].includes(assetId) && num < 100) return num.toFixed(2);
  if (['PAXG', 'KAG'].includes(assetId)) return num.toFixed(4); // Precious metals
  if (num < 1) return num.toFixed(4);
  if (num < 100) return num.toFixed(2);
  return num.toFixed(0);
}

// Cached time formatters
const timeFormatter24h = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
const timeFormatter12h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
const dateLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function formatTime(ts: number | string | Date): string {
  return timeFormatter24h.format(new Date(ts));
}

export function formatTimeOnly(ts: number | string | Date): string {
  return timeFormatter12h.format(new Date(ts));
}

/**
 * Compute date label for ledger entries at creation time (pre-computed for O(1) grouping)
 * Returns "Today", "Yesterday", or formatted date like "Jan 17"
 * Note: "Today"/"Yesterday" become stale after midnight, but acceptable for historical entries
 */
export function computeDateLabel(tsISO: string): string {
  const entryDate = new Date(tsISO).toDateString();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (entryDate === today) return 'Today';
  if (entryDate === yesterday) return 'Yesterday';
  return dateLabelFormatter.format(new Date(tsISO));
}

/**
 * Generate a unique identifier using crypto.randomUUID() with fallback
 * for environments where it's unavailable.
 */
export function uid(): string {
  // Prefer crypto.randomUUID() for stronger uniqueness guarantees
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older environments: combine random hex with timestamp
  return `${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

// Hoisted to module scope to avoid per-call allocation
// 15-asset universe display names
const ASSET_DISPLAY_NAMES: Record<string, string> = {
  // Foundation
  'USDT': 'US Dollar',
  'PAXG': 'Gold',
  'IRR_FIXED_INCOME': 'Fixed Income Fund (IRR)',
  // Growth
  'BTC': 'BITCOIN',
  'ETH': 'ETHEREUM',
  'BNB': 'BINANCE COIN',
  'XRP': 'RIPPLE',
  'KAG': 'SILVER',
  'QQQ': 'NASDAQ 100',
  // Upside
  'SOL': 'SOLANA',
  'TON': 'TON COIN',
  'LINK': 'CHAINLINK',
  'AVAX': 'AVALANCHE',
  'MATIC': 'POLYGON',
  'ARB': 'ARBITRUM',
  // Legacy (for backward compatibility)
  'GOLD': 'Gold',
};

export function getAssetDisplayName(assetId: string): string {
  return ASSET_DISPLAY_NAMES[assetId] || assetId;
}

/**
 * Get asset price in USD with fallback to defaults
 * Centralized helper to eliminate repeated fallback pattern across codebase
 */
export function getAssetPriceUSD(assetId: string, prices: Record<string, number> = DEFAULT_PRICES): number {
  return prices[assetId] ?? DEFAULT_PRICES[assetId] ?? 0;
}

/**
 * Compute holding value in IRR from quantity (v10)
 * Centralized helper used by validate.js and OnboardingControls.jsx
 */
export function getHoldingValueIRR(
  holding: Holding | null | undefined,
  prices: Record<string, number> = DEFAULT_PRICES,
  fxRate: number = DEFAULT_FX_RATE
): number {
  if (!holding) return 0;
  if (!holding.quantity || holding.quantity <= 0) return 0;
  if (holding.assetId === 'IRR_FIXED_INCOME') {
    const breakdown = calculateFixedIncomeValue(holding.quantity, holding.purchasedAt);
    return breakdown.total;
  }
  const priceUSD = getAssetPriceUSD(holding.assetId, prices);
  return Math.round(holding.quantity * priceUSD * fxRate);
}

/**
 * Format a number with thousand separators for display in inputs
 * e.g., 1000000 -> "1,000,000"
 */
export function formatNumberInput(n: number | string): string {
  const num = Number(n) || 0;
  if (num === 0) return '';
  return irrFormatter.format(Math.round(num));
}

/**
 * Parse a formatted number string back to a number
 * e.g., "1,000,000" -> 1000000
 */
export function parseFormattedNumber(str: string): number {
  if (!str) return 0;
  // Remove all non-digit characters except minus sign
  const cleaned = str.replace(/[^\d-]/g, '');
  return Number(cleaned) || 0;
}
