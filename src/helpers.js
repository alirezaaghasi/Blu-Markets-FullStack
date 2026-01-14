// Utility functions for Blu Markets v9.9

export function formatIRR(n) {
  return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' IRR';
}

export function formatIRRShort(n) {
  const num = Number(n) || 0;
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

// v9.9: Format USD price
export function formatUSD(n) {
  const num = Number(n) || 0;
  if (num >= 1000) {
    return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  if (num >= 1) {
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
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

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatTimestamp(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatTimeOnly(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
  if (risk <= 5) return { FOUNDATION: 65, GROWTH: 30, UPSIDE: 5 };
  if (risk <= 10) return { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 };
  return { FOUNDATION: 40, GROWTH: 40, UPSIDE: 20 };
}
