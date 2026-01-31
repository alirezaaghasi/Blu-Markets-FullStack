/**
 * Shared Token Refresh Utility
 *
 * Centralizes token refresh logic to prevent drift between API clients.
 * Both RTK Query and Axios use this for consistent auth handling.
 */
import { tokenStorage } from './secureStorage';
import { API_BASE_URL } from '../config/api';

// Singleton state for refresh coordination
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Attempts to refresh the access token using the stored refresh token.
 * Returns the new access token if successful, null if failed.
 *
 * This function handles concurrent refresh requests by queueing them
 * and returning the same promise to all callers.
 */
export async function refreshAccessToken(): Promise<string | null> {
  // If already refreshing, wait for the existing refresh to complete
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async (): Promise<string | null> => {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();

      if (!refreshToken) {
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // Refresh failed - clear tokens
        await tokenStorage.clearTokens();
        return null;
      }

      const data: RefreshResult = await response.json();

      // Store new tokens
      await tokenStorage.setTokens(data.accessToken, data.refreshToken);

      return data.accessToken;
    } catch (error) {
      // Network error or other failure - clear tokens
      console.error('[AuthRefresh] Token refresh failed:', error);
      await tokenStorage.clearTokens();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Checks if a refresh is currently in progress.
 */
export function isTokenRefreshing(): boolean {
  return isRefreshing;
}

/**
 * Gets the current refresh promise if one is in progress.
 * Useful for queuing requests that should wait for refresh.
 */
export function getRefreshPromise(): Promise<string | null> | null {
  return refreshPromise;
}
