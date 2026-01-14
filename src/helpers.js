// Utility functions for Blu Markets v9.7

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

export function getAssetDisplayName(assetId) {
  const ASSET_DISPLAY_NAMES = {
    'IRR_FIXED_INCOME': 'Fixed Income (IRR)',
    'USDT': 'USDT',
    'GOLD': 'Gold',
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'QQQ': 'QQQ',
    'SOL': 'Solana',
    'TON': 'Toncoin',
  };
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
