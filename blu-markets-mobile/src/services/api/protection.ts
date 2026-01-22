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
    // Backend returns: { assetId, layer, holdingValueIrr, monthlyRate, alreadyProtected }
    // Frontend expects: { assetId, holdingQuantity, holdingValueIrr, premiumRatePerMonth, estimatedPremiumIrr }
    const data = await apiClient.get('/protection/eligible') as unknown as ApiResponse<any[]>;
    const assets = (Array.isArray(data) ? data : data?.assets || []).map((item: any) => ({
      assetId: item.assetId as AssetId,
      holdingQuantity: item.holdingQuantity ?? 0,
      holdingValueIrr: item.holdingValueIrr ?? 0,
      premiumRatePerMonth: item.premiumRatePerMonth ?? item.monthlyRate ?? 0,
      estimatedPremiumIrr: item.estimatedPremiumIrr ?? (item.holdingValueIrr * (item.monthlyRate || 0) / 100) ?? 0,
      // Extra fields from backend
      layer: item.layer,
      alreadyProtected: item.alreadyProtected ?? false,
    }));
    return { assets };
  },

  // Purchase protection for an asset with specified notional value
  purchase: (assetId: AssetId, notionalIrr: number, durationMonths: number): Promise<Protection> =>
    apiClient.post('/protection', { assetId, notionalIrr, durationMonths }) as unknown as Promise<Protection>,

  cancel: (protectionId: string): Promise<{ success: boolean }> =>
    apiClient.delete(`/protection/${protectionId}`) as unknown as Promise<{ success: boolean }>,
};
