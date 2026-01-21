// Authentication API Module
// src/services/api/auth.ts

import { apiClient, setAuthTokens, clearAuthTokens } from './client';
import type { AuthResponse } from './types';

export const auth = {
  sendOtp: (phone: string): Promise<{ success: boolean }> =>
    apiClient.post('/auth/send-otp', { phone }),

  verifyOtp: async (phone: string, code: string): Promise<AuthResponse> => {
    const response: AuthResponse = await apiClient.post('/auth/verify-otp', { phone, code });
    // Store tokens after successful verification
    await setAuthTokens(response.accessToken, response.refreshToken);
    return response;
  },

  refresh: (): Promise<AuthResponse> =>
    apiClient.post('/auth/refresh'),

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      await clearAuthTokens();
    }
  },
};
