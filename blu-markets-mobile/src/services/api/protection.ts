// Protection API Module
// src/services/api/protection.ts

import { apiClient } from './client';
import type { ProtectionsResponse, EligibleAssetsResponse, Protection, AssetId } from './types';

export const protection = {
  getActive: (): Promise<ProtectionsResponse> =>
    apiClient.get('/protection'),

  getEligible: (): Promise<EligibleAssetsResponse> =>
    apiClient.get('/protection/eligible'),

  purchase: (assetId: AssetId, durationMonths: number): Promise<Protection> =>
    apiClient.post('/protection', { assetId, durationMonths }),

  cancel: (protectionId: string): Promise<{ success: boolean }> =>
    apiClient.delete(`/protection/${protectionId}`),
};
