// Authentication API Module
// src/services/api/auth.ts

import { apiClient, setAuthTokens, clearAuthTokens } from './client';
import type { AuthResponse } from './types';
import { devLog, devError } from '../../utils/devLogger';

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
  sendOtp: async (phone: string): Promise<{ success: boolean }> => {
    // Using devLog ensures logs are completely stripped in production
    devLog('[Auth] Sending OTP to:', phone);
    try {
      const result = await apiClient.post('/auth/send-otp', { phone }) as unknown as { success: boolean };
      devLog('[Auth] OTP sent successfully');
      return result;
    } catch (error) {
      devError('[Auth] Send OTP error:', error);
      throw error;
    }
  },

  verifyOtp: async (phone: string, code: string): Promise<AuthResponse> => {
    // Using devLog ensures logs are completely stripped in production
    devLog('[Auth] Verifying OTP for:', phone);
    try {
      const response: BackendVerifyOtpResponse = await apiClient.post('/auth/verify-otp', { phone, code });
      devLog('[Auth] OTP verified, storing tokens...');
      // Store tokens after successful verification (unwrap from nested structure)
      await setAuthTokens(response.tokens.accessToken, response.tokens.refreshToken);
      devLog('[Auth] Tokens stored successfully');
      // Return flattened response for frontend consumption
      return {
        accessToken: response.tokens.accessToken,
        refreshToken: response.tokens.refreshToken,
        isNewUser: response.isNewUser,
        onboardingComplete: response.onboardingComplete,
      };
    } catch (error) {
      devError('[Auth] Verify OTP error:', error);
      throw error;
    }
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
