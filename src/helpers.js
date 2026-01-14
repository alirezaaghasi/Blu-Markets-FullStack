// Utility functions for Blu Markets v9.9
// Optimization: Cached Intl.NumberFormat instances to avoid repeated allocations

import { THRESHOLDS, RISK_ALLOCATIONS } from './constants/index.js';

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

// v9.9: Format USD price (using cached formatters)
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

// v9.9: Format quantity with appropriate decimals
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
// Issue 4: Full asset names with tickers
const ASSET_DISPLAY_NAMES = {
  'IRR_FIXED_INCOME': 'Iranian Bonds',
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

export function computeTargetLayersFromAnswers(questionnaire, answers) {
  let risk = 0;
  for (const q of questionnaire.questions) {
    const opt = q.options.find(o => o.id === answers[q.id]);
    risk += (opt?.risk ?? 0);
  }
  // Use centralized thresholds and allocations from constants
  if (risk <= THRESHOLDS.RISK_LOW_THRESHOLD) return { ...RISK_ALLOCATIONS.LOW };
  if (risk <= THRESHOLDS.RISK_MED_THRESHOLD) return { ...RISK_ALLOCATIONS.MEDIUM };
  return { ...RISK_ALLOCATIONS.HIGH };
}
