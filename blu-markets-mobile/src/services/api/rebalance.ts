// Rebalance API Module
// src/services/api/rebalance.ts

import { apiClient } from './client';
import type { RebalancePreview, PortfolioStatus } from './types';

export const rebalance = {
  getStatus: (): Promise<{
    needsRebalance: boolean;
    lastRebalanceAt: string | null;
    canRebalance: boolean;
    reason?: string;
  }> =>
    apiClient.get('/rebalance/status'),

  preview: (): Promise<RebalancePreview> =>
    apiClient.get('/rebalance/preview'),

  execute: (): Promise<{
    success: boolean;
    tradesExecuted: number;
    newStatus: PortfolioStatus;
  }> =>
    apiClient.post('/rebalance/execute'),
};
