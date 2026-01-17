// Utility functions for Blu Markets v10
// Optimization: Cached Intl.NumberFormat instances to avoid repeated allocations

import type { AssetId, Holding } from './types';
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
const timestampFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const timeFormatter12h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

export function formatTime(ts: number | string | Date): string {
  return timeFormatter24h.format(new Date(ts));
}

export function formatTimestamp(ts: number | string | Date): string {
  return timestampFormatter.format(new Date(ts));
}

export function formatTimeOnly(ts: number | string | Date): string {
  return timeFormatter12h.format(new Date(ts));
}

export function uid(): string {
  return `${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

// Hoisted to module scope to avoid per-call allocation
// 15-asset universe display names
const ASSET_DISPLAY_NAMES: Record<string, string> = {
  // Foundation
  'USDT': 'Tether (USDT)',
  'PAXG': 'Paxos Gold (PAXG)',
  'IRR_FIXED_INCOME': 'Fixed Income Fund (IRR)',
  // Growth
  'BTC': 'Bitcoin (BTC)',
  'ETH': 'Ethereum (ETH)',
  'BNB': 'BNB',
  'XRP': 'XRP',
  'KAG': 'Kinesis Silver (KAG)',
  'QQQ': 'Nasdaq 100 (QQQ)',
  // Upside
  'SOL': 'Solana (SOL)',
  'TON': 'Toncoin (TON)',
  'LINK': 'Chainlink (LINK)',
  'AVAX': 'Avalanche (AVAX)',
  'MATIC': 'Polygon (MATIC)',
  'ARB': 'Arbitrum (ARB)',
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
 * Build a holdings lookup map for O(1) access by assetId
 * Use this instead of repeated .find() calls in hot paths
 */
export function buildHoldingsMap(holdings: Holding[]): Record<AssetId, Holding> {
  const map: Record<string, Holding> = {};
  for (const h of holdings) {
    map[h.assetId] = h;
  }
  return map as Record<AssetId, Holding>;
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
