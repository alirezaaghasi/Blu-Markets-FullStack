// HTTP Client with Authentication
// Based on BACKEND_INTEGRATION_V2.md Phase 1.3
// SECURITY: Uses expo-secure-store for encrypted token storage on native platforms

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../../config/api';
import { tokenStorage } from '../../utils/secureStorage';

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - add auth token from secure storage
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await tokenStorage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401, refresh token
apiClient.interceptors.response.use(
  // Success: unwrap data from response
  (response) => response.data,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();

        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Call refresh endpoint directly (not through apiClient to avoid interceptor loop)
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // Store new tokens in secure storage
        await tokenStorage.setTokens(accessToken, newRefreshToken);

        // Update original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        processQueue(null, accessToken);

        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear tokens from secure storage and reject
        processQueue(refreshError as Error, null);
        await tokenStorage.clearTokens();

        // The app should handle this by redirecting to login
        // This is typically done via a global error handler or navigation ref
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // For other errors, reject with the error response data if available
    if (error.response?.data) {
      return Promise.reject(error.response.data);
    }

    return Promise.reject(error);
  }
);

// Helper to clear auth tokens (for logout) - uses secure storage
export const clearAuthTokens = async (): Promise<void> => {
  await tokenStorage.clearTokens();
};

// Helper to set auth tokens (after login) - uses secure storage
export const setAuthTokens = async (
  accessToken: string,
  refreshToken: string
): Promise<void> => {
  await tokenStorage.setTokens(accessToken, refreshToken);
};

// Helper to check if user is authenticated - uses secure storage
export const isAuthenticated = async (): Promise<boolean> => {
  return tokenStorage.hasTokens();
};
