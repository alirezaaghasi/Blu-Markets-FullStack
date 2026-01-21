// Portfolio API Module
// src/services/api/portfolio.ts

import { apiClient } from './client';
import type { PortfolioResponse, AssetId, Holding } from './types';

export const portfolio = {
  get: (): Promise<PortfolioResponse> =>
    apiClient.get('/portfolio'),

  addFunds: (amountIrr: number): Promise<PortfolioResponse> =>
    apiClient.post('/portfolio/add-funds', { amountIrr }),

  getAsset: (assetId: AssetId): Promise<{
    holding: Holding;
    currentPriceUsd: number;
    valueIrr: number;
    changePercent24h: number;
  }> =>
    apiClient.get(`/portfolio/asset/${assetId}`),
};
