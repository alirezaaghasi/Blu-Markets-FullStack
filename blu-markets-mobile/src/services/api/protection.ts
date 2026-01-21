// Protection API Module
// src/services/api/protection.ts

import { apiClient } from './client';
import type { ProtectionsResponse, EligibleAssetsResponse, Protection, AssetId } from './types';

// Type for raw API responses (interceptor unwraps .data)
type ApiResponse<T> = T;

export const protection = {
  getActive: async (): Promise<ProtectionsResponse> => {
    const data = await apiClient.get('/protection') as unknown as ApiResponse<{ protections?: Protection[] }>;
    return { protections: data?.protections || [] };
  },

  getEligible: async (): Promise<EligibleAssetsResponse> => {
    const data = await apiClient.get('/protection/eligible') as unknown as ApiResponse<EligibleAssetsResponse>;
    return { assets: data?.assets || [] };
  },

  // The hook calls with (assetId, durationMonths) - backend calculates notional from holdings
  purchase: (assetId: AssetId, durationMonths: number): Promise<Protection> =>
    apiClient.post('/protection', { assetId, durationMonths }) as unknown as Promise<Protection>,

  cancel: (protectionId: string): Promise<{ success: boolean }> =>
    apiClient.delete(`/protection/${protectionId}`) as unknown as Promise<{ success: boolean }>,
};
