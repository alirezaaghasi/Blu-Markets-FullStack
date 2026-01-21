// Trade API Module
// src/services/api/trade.ts

import { apiClient } from './client';
import type { AssetId, TradePreview, TradeExecuteResponse } from './types';

export const trade = {
  preview: (assetId: AssetId, action: 'BUY' | 'SELL', amountIrr: number): Promise<TradePreview> =>
    apiClient.post('/trade/preview', { assetId, action, amountIrr }),

  execute: (assetId: AssetId, action: 'BUY' | 'SELL', amountIrr: number): Promise<TradeExecuteResponse> =>
    apiClient.post('/trade/execute', { assetId, action, amountIrr }),
};
