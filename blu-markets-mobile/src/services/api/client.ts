// HTTP Client with Authentication
// Modular API Structure - src/services/api/client.ts
// SECURITY: Uses expo-secure-store for encrypted token storage on native platforms

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../../config/api';
import { tokenStorage } from '../../utils/secureStorage';
import { refreshAccessToken, isTokenRefreshing, getRefreshPromise } from '../../utils/authRefresh';

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true', // Required for localtunnel
  },
});

// Queue for requests waiting on token refresh
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

// Response interceptor - handle 401, refresh token using shared utility
apiClient.interceptors.response.use(
  // Success: unwrap data from response
  (response) => response.data,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Check if refresh is already in progress (shared state with RTK Query)
      if (isTokenRefreshing()) {
        // Wait for the existing refresh to complete
        const existingPromise = getRefreshPromise();
        if (existingPromise) {
          return existingPromise.then((newToken) => {
            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return apiClient(originalRequest);
            }
            return Promise.reject(new Error('Token refresh failed'));
          });
        }
      }

      originalRequest._retry = true;

      try {
        // Use shared refresh utility (same as RTK Query)
        const newToken = await refreshAccessToken();

        if (newToken) {
          // Update original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          processQueue(null, newToken);
          return apiClient(originalRequest);
        }

        // Refresh failed
        processQueue(new Error('Token refresh failed'), null);
        return Promise.reject(new Error('Token refresh failed'));
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        return Promise.reject(refreshError);
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
