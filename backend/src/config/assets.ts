// Asset Configuration with Intra-Layer Weights
// Based on PRD Section 4.2 - Intra-Layer Weight Summary

import type { AssetId, Layer } from '../types/domain.js';

export interface AssetConfig {
  id: AssetId;
  name: string;
  layer: Layer;
  layerWeight: number;  // Target weight within layer (0.0 - 1.0)
  baseVolatility: number;
  liquidityScore: number;
  maxLTV: number;
}

// Asset layer weights per PRD
export const ASSETS_CONFIG: Record<AssetId, AssetConfig> = {
  // FOUNDATION Layer (40/30/30)
  USDT: {
    id: 'USDT',
    name: 'US Dollar',
    layer: 'FOUNDATION',
    layerWeight: 0.40,
    baseVolatility: 0.01,
    liquidityScore: 1.00,
    maxLTV: 90,
  },
  PAXG: {
    id: 'PAXG',
    name: 'Gold',
    layer: 'FOUNDATION',
    layerWeight: 0.30,
    baseVolatility: 0.12,
    liquidityScore: 0.85,
    maxLTV: 70,
  },
  IRR_FIXED_INCOME: {
    id: 'IRR_FIXED_INCOME',
    name: 'Fixed Income',
    layer: 'FOUNDATION',
    layerWeight: 0.30,
    baseVolatility: 0.05,
    liquidityScore: 0.60,
    maxLTV: 0,
  },

  // GROWTH Layer (25/20/15/10/15/15)
  BTC: {
    id: 'BTC',
    name: 'Bitcoin',
    layer: 'GROWTH',
    layerWeight: 0.25,
    baseVolatility: 0.45,
    liquidityScore: 0.98,
    maxLTV: 50,
  },
  ETH: {
    id: 'ETH',
    name: 'Ethereum',
    layer: 'GROWTH',
    layerWeight: 0.20,
    baseVolatility: 0.55,
    liquidityScore: 0.97,
    maxLTV: 50,
  },
  BNB: {
    id: 'BNB',
    name: 'Binance Coin',
    layer: 'GROWTH',
    layerWeight: 0.15,
    baseVolatility: 0.50,
    liquidityScore: 0.95,
    maxLTV: 50,
  },
  XRP: {
    id: 'XRP',
    name: 'Ripple',
    layer: 'GROWTH',
    layerWeight: 0.10,
    baseVolatility: 0.60,
    liquidityScore: 0.94,
    maxLTV: 45,
  },
  KAG: {
    id: 'KAG',
    name: 'Silver',
    layer: 'GROWTH',
    layerWeight: 0.15,
    baseVolatility: 0.18,
    liquidityScore: 0.75,
    maxLTV: 60,
  },
  QQQ: {
    id: 'QQQ',
    name: 'NASDAQ 100',
    layer: 'GROWTH',
    layerWeight: 0.15,
    baseVolatility: 0.20,
    liquidityScore: 0.90,
    maxLTV: 60,
  },

  // UPSIDE Layer (20/18/18/16/14/14)
  SOL: {
    id: 'SOL',
    name: 'Solana',
    layer: 'UPSIDE',
    layerWeight: 0.20,
    baseVolatility: 0.75,
    liquidityScore: 0.92,
    maxLTV: 30,
  },
  TON: {
    id: 'TON',
    name: 'TON Coin',
    layer: 'UPSIDE',
    layerWeight: 0.18,
    baseVolatility: 0.65,
    liquidityScore: 0.85,
    maxLTV: 30,
  },
  LINK: {
    id: 'LINK',
    name: 'Chainlink',
    layer: 'UPSIDE',
    layerWeight: 0.18,
    baseVolatility: 0.60,
    liquidityScore: 0.90,
    maxLTV: 35,
  },
  AVAX: {
    id: 'AVAX',
    name: 'Avalanche',
    layer: 'UPSIDE',
    layerWeight: 0.16,
    baseVolatility: 0.70,
    liquidityScore: 0.88,
    maxLTV: 30,
  },
  MATIC: {
    id: 'MATIC',
    name: 'Polygon',
    layer: 'UPSIDE',
    layerWeight: 0.14,
    baseVolatility: 0.65,
    liquidityScore: 0.88,
    maxLTV: 30,
  },
  ARB: {
    id: 'ARB',
    name: 'Arbitrum',
    layer: 'UPSIDE',
    layerWeight: 0.14,
    baseVolatility: 0.70,
    liquidityScore: 0.85,
    maxLTV: 30,
  },
};

// Get all assets in a layer
export function getLayerAssets(layer: Layer): AssetId[] {
  return Object.entries(ASSETS_CONFIG)
    .filter(([_, config]) => config.layer === layer)
    .map(([id]) => id as AssetId);
}

// Get layer weights for a layer (sums to 1.0)
export function getLayerWeights(layer: Layer): Record<AssetId, number> {
  const weights: Record<string, number> = {};
  for (const [id, config] of Object.entries(ASSETS_CONFIG)) {
    if (config.layer === layer) {
      weights[id] = config.layerWeight;
    }
  }
  return weights as Record<AssetId, number>;
}

// Get single asset's layer weight
export function getAssetLayerWeight(assetId: AssetId): number {
  return ASSETS_CONFIG[assetId]?.layerWeight ?? 0;
}
