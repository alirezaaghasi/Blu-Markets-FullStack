// Asset Configuration
// Based on PRD Section 18 - Asset Configuration

import { AssetConfig, AssetId, Layer } from '../types';

export const ASSETS: Record<AssetId, AssetConfig> = {
  // Foundation Layer
  USDT: {
    id: 'USDT',
    name: 'Tether USD',
    symbol: 'USDT',
    layer: 'FOUNDATION',
    volatility: 0.01,
    layerWeight: 0.40,
    liquidity: 1.00,
    protectionEligible: false, // Foundation assets not protection-eligible per PRD
    ltv: 0.90,
    coinGeckoId: 'tether',
  },
  PAXG: {
    id: 'PAXG',
    name: 'PAX Gold',
    symbol: 'PAXG',
    layer: 'FOUNDATION',
    volatility: 0.12,
    layerWeight: 0.30,
    liquidity: 0.85,
    protectionEligible: true, // Gold has liquid COMEX derivatives market
    ltv: 0.70,
    coinGeckoId: 'pax-gold',
  },
  IRR_FIXED_INCOME: {
    id: 'IRR_FIXED_INCOME',
    name: 'Fixed Income',
    symbol: 'IRR',
    layer: 'FOUNDATION',
    volatility: 0.05,
    layerWeight: 0.30,
    liquidity: 0.70,
    protectionEligible: false,
    ltv: 0,
  },

  // Growth Layer
  BTC: {
    id: 'BTC',
    name: 'Bitcoin',
    symbol: 'BTC',
    layer: 'GROWTH',
    volatility: 0.45,
    layerWeight: 0.25,
    liquidity: 1.00,
    protectionEligible: true,
    ltv: 0.50,
    coinGeckoId: 'bitcoin',
  },
  ETH: {
    id: 'ETH',
    name: 'Ethereum',
    symbol: 'ETH',
    layer: 'GROWTH',
    volatility: 0.55,
    layerWeight: 0.20,
    liquidity: 0.98,
    protectionEligible: true,
    ltv: 0.50,
    coinGeckoId: 'ethereum',
  },
  BNB: {
    id: 'BNB',
    name: 'BNB',
    symbol: 'BNB',
    layer: 'GROWTH',
    volatility: 0.50,
    layerWeight: 0.15,
    liquidity: 0.90,
    protectionEligible: false, // Not protection-eligible per PRD
    ltv: 0.50,
    coinGeckoId: 'binancecoin',
  },
  XRP: {
    id: 'XRP',
    name: 'XRP',
    symbol: 'XRP',
    layer: 'GROWTH',
    volatility: 0.60,
    layerWeight: 0.10,
    liquidity: 0.88,
    protectionEligible: false, // Not protection-eligible per PRD
    ltv: 0.45,
    coinGeckoId: 'ripple',
  },
  KAG: {
    id: 'KAG',
    name: 'Kinesis Silver',
    symbol: 'KAG',
    layer: 'GROWTH',
    volatility: 0.18,
    layerWeight: 0.15,
    liquidity: 0.75,
    protectionEligible: true,
    ltv: 0.60,
    coinGeckoId: 'kinesis-silver',
  },
  QQQ: {
    id: 'QQQ',
    name: 'Nasdaq ETF',
    symbol: 'QQQ',
    layer: 'GROWTH',
    volatility: 0.20,
    layerWeight: 0.15,
    liquidity: 0.95,
    protectionEligible: true,
    ltv: 0.60,
    // Fetched from Finnhub, not CoinGecko
  },

  // Upside Layer
  SOL: {
    id: 'SOL',
    name: 'Solana',
    symbol: 'SOL',
    layer: 'UPSIDE',
    volatility: 0.75,
    layerWeight: 0.20,
    liquidity: 0.92,
    protectionEligible: true,
    ltv: 0.30,
    coinGeckoId: 'solana',
  },
  TON: {
    id: 'TON',
    name: 'Toncoin',
    symbol: 'TON',
    layer: 'UPSIDE',
    volatility: 0.65,
    layerWeight: 0.18,
    liquidity: 0.70,
    protectionEligible: false,
    ltv: 0.30,
    coinGeckoId: 'the-open-network',
  },
  LINK: {
    id: 'LINK',
    name: 'Chainlink',
    symbol: 'LINK',
    layer: 'UPSIDE',
    volatility: 0.60,
    layerWeight: 0.18,
    liquidity: 0.85,
    protectionEligible: false, // Not protection-eligible per PRD
    ltv: 0.35,
    coinGeckoId: 'chainlink',
  },
  AVAX: {
    id: 'AVAX',
    name: 'Avalanche',
    symbol: 'AVAX',
    layer: 'UPSIDE',
    volatility: 0.70,
    layerWeight: 0.16,
    liquidity: 0.82,
    protectionEligible: false, // Not protection-eligible per PRD
    ltv: 0.30,
    coinGeckoId: 'avalanche-2',
  },
  MATIC: {
    id: 'MATIC',
    name: 'Polygon',
    symbol: 'MATIC',
    layer: 'UPSIDE',
    volatility: 0.65,
    layerWeight: 0.14,
    liquidity: 0.80,
    protectionEligible: false,
    ltv: 0.30,
    coinGeckoId: 'matic-network',
  },
  ARB: {
    id: 'ARB',
    name: 'Arbitrum',
    symbol: 'ARB',
    layer: 'UPSIDE',
    volatility: 0.70,
    layerWeight: 0.14,
    liquidity: 0.75,
    protectionEligible: false,
    ltv: 0.30,
    coinGeckoId: 'arbitrum',
  },
};

// Helper functions
export const getAssetsByLayer = (layer: Layer): AssetConfig[] => {
  return Object.values(ASSETS).filter((asset) => asset.layer === layer);
};

export const getProtectionEligibleAssets = (): AssetConfig[] => {
  return Object.values(ASSETS).filter((asset) => asset.protectionEligible);
};

export const getAssetConfig = (assetId: AssetId): AssetConfig => {
  return ASSETS[assetId];
};

// Layer colors for display
export const LAYER_COLORS: Record<Layer, string> = {
  FOUNDATION: '#3b82f6', // Blue
  GROWTH: '#a855f7',     // Purple
  UPSIDE: '#10b981',     // Emerald
};

// Layer display names
export const LAYER_NAMES: Record<Layer, string> = {
  FOUNDATION: 'Foundation',
  GROWTH: 'Growth',
  UPSIDE: 'Upside',
};

// Layer descriptions for detail views
export const LAYER_DESCRIPTIONS: Record<Layer, string> = {
  FOUNDATION: 'Stable assets for capital preservation',
  GROWTH: 'Established assets for steady growth',
  UPSIDE: 'High-potential assets for maximum returns',
};
