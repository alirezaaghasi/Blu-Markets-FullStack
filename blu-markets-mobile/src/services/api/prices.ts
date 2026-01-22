// Prices API Module
// src/services/api/prices.ts

import { apiClient } from './client';
import type { PricesResponse } from './types';

// Backend response type (prices as array)
interface BackendPricesResponse {
  prices: Array<{
    assetId: string;
    priceUsd: number;
    priceIrr: number;
    change24hPct?: number;
    source: string;
    fetchedAt: string;
  }>;
  fxRate: {
    usdIrr: number;
    source: string;
    fetchedAt: string;
  };
  status: string;
}

export const prices = {
  getAll: async (): Promise<PricesResponse> => {
    const data = await apiClient.get('/prices') as unknown as BackendPricesResponse;

    // Transform array of prices to Record<string, number> (assetId -> priceUsd)
    const pricesMap: Record<string, number> = {};
    if (Array.isArray(data?.prices)) {
      for (const p of data.prices) {
        pricesMap[p.assetId] = p.priceUsd;
      }
    }

    return {
      prices: pricesMap,
      fxRate: data?.fxRate?.usdIrr ?? 0,
      timestamp: data?.fxRate?.fetchedAt ?? new Date().toISOString(),
    };
  },
};
