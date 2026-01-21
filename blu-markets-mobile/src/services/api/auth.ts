// Authentication API Module
// src/services/api/auth.ts

import { apiClient, setAuthTokens, clearAuthTokens } from './client';
import type { AuthResponse } from './types';

// Backend response format (tokens are nested)
interface BackendVerifyOtpResponse {
  success: boolean;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  isNewUser: boolean;
  onboardingComplete: boolean;
}

export const auth = {
  sendOtp: (phone: string): Promise<{ success: boolean }> =>
    apiClient.post('/auth/send-otp', { phone }),

  verifyOtp: async (phone: string, code: string): Promise<AuthResponse> => {
    const response: BackendVerifyOtpResponse = await apiClient.post('/auth/verify-otp', { phone, code });
    // Store tokens after successful verification (unwrap from nested structure)
    await setAuthTokens(response.tokens.accessToken, response.tokens.refreshToken);
    // Return flattened response for frontend consumption
    return {
      accessToken: response.tokens.accessToken,
      refreshToken: response.tokens.refreshToken,
      isNewUser: response.isNewUser,
      onboardingComplete: response.onboardingComplete,
    };
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
