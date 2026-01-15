// Utility functions for Blu Markets v10
// Optimization: Cached Intl.NumberFormat instances to avoid repeated allocations

import { THRESHOLDS, RISK_ALLOCATIONS, DEFAULT_PRICES, DEFAULT_FX_RATE } from './constants/index.js';
import { calculateFixedIncomeValue } from './engine/fixedIncome.js';

// Cached formatters - created once at module load
const irrFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const usdFormatterWhole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const usdFormatter2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdFormatter4 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function formatIRR(n) {
  return irrFormatter.format(Math.round(Number(n) || 0)) + ' IRR';
}

export function formatIRRShort(n) {
  const num = Number(n) || 0;
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

// v10: Format USD price (using cached formatters)
export function formatUSD(n) {
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
export function formatQuantity(qty, assetId) {
  const num = Number(qty) || 0;
  // More decimals for crypto with small quantities
  if (assetId === 'BTC' && num < 1) return num.toFixed(6);
  if (['ETH', 'SOL', 'TON'].includes(assetId) && num < 10) return num.toFixed(4);
  if (num < 1) return num.toFixed(4);
  if (num < 100) return num.toFixed(2);
  return num.toFixed(0);
}

// Cached time formatters
const timeFormatter24h = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
const timestampFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const timeFormatter12h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

export function formatTime(ts) {
  return timeFormatter24h.format(new Date(ts));
}

export function formatTimestamp(ts) {
  return timestampFormatter.format(new Date(ts));
}

export function formatTimeOnly(ts) {
  return timeFormatter12h.format(new Date(ts));
}

export function uid() {
  return `${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

export function nowISO() {
  return new Date().toISOString();
}

// Hoisted to module scope to avoid per-call allocation
// Decision 10: Renamed "Iranian Bonds" to "Fixed Income Fund (IRR)"
const ASSET_DISPLAY_NAMES = {
  'IRR_FIXED_INCOME': 'Fixed Income Fund (IRR)',
  'USDT': 'Tether (USDT)',
  'GOLD': 'Gold',
  'BTC': 'Bitcoin (BTC)',
  'ETH': 'Ethereum (ETH)',
  'QQQ': 'Nasdaq 100 (QQQ)',
  'SOL': 'Solana (SOL)',
  'TON': 'Toncoin (TON)',
};

export function getAssetDisplayName(assetId) {
  return ASSET_DISPLAY_NAMES[assetId] || assetId;
}

/**
 * Compute holding value in IRR from quantity (v10)
 * Centralized helper used by validate.js and OnboardingControls.jsx
 * @param {Object} holding - Holding with quantity
 * @param {Object} prices - Current prices in USD
 * @param {number} fxRate - USD/IRR exchange rate
 */
export function getHoldingValueIRR(holding, prices = DEFAULT_PRICES, fxRate = DEFAULT_FX_RATE) {
  if (!holding) return 0;
  if (!holding.quantity || holding.quantity <= 0) return 0;
  if (holding.assetId === 'IRR_FIXED_INCOME') {
    const breakdown = calculateFixedIncomeValue(holding.quantity, holding.purchasedAt);
    return breakdown.total;
  }
  const priceUSD = prices[holding.assetId] || DEFAULT_PRICES[holding.assetId] || 0;
  return Math.round(holding.quantity * priceUSD * fxRate);
}
