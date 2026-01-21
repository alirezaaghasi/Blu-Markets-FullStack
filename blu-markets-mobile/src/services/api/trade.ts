// Trade API Module
// src/services/api/trade.ts

import { apiClient } from './client';
import type { AssetId, TradePreview, TradeExecuteResponse } from './types';

export const trade = {
  preview: (assetId: AssetId, side: 'BUY' | 'SELL', amountIrr: number): Promise<TradePreview> =>
    apiClient.post('/trade/preview', { assetId, side, amountIrr }),

  execute: (assetId: AssetId, side: 'BUY' | 'SELL', amountIrr: number): Promise<TradeExecuteResponse> =>
    apiClient.post('/trade/execute', { assetId, side, amountIrr }),
};
