// Prices API Module
// src/services/api/prices.ts

import { apiClient } from './client';
import type { PricesResponse } from './types';

export const prices = {
  getAll: async (): Promise<PricesResponse> => {
    // Backend returns: { prices: PriceItem[], fxRate: {...}, status: string }
    const data = await apiClient.get('/prices') as unknown as PricesResponse;
    return data;
  },
};
