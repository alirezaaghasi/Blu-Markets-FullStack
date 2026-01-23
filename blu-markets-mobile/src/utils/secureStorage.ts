// Secure Token Storage
// Uses expo-secure-store for native platforms (encrypted Keychain/Keystore)
// Falls back to localStorage for web (with warning)

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEYS } from '../config/api';

/**
 * SECURITY: Tokens are sensitive credentials that should be stored securely.
 * - iOS: Uses Keychain Services (encrypted, hardware-backed on newer devices)
 * - Android: Uses Android Keystore (encrypted, hardware-backed on newer devices)
 * - Web: Falls back to localStorage (NOT secure, but acceptable for development)
 */

const isWeb = Platform.OS === 'web';

// Warn if running on web in production
if (isWeb && process.env.NODE_ENV === 'production') {
  console.warn(
    '[SecureStorage] Running on web platform. Tokens are stored in localStorage ' +
    'which is NOT secure. Consider implementing HttpOnly cookies or other secure alternatives for production web apps.'
  );
}

/**
 * Securely store a value
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value, {
      // Require device authentication (Face ID/Touch ID/PIN) to access
      // Disabled for better UX - tokens are still encrypted
      requireAuthentication: false,
    });
  }
}

/**
 * Securely retrieve a value
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) {
    return localStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
}

/**
 * Securely delete a value
 */
export async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * Delete multiple values
 */
export async function deleteSecureItems(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => deleteSecureItem(key)));
}

// Token-specific helpers for convenience
export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return getSecureItem(TOKEN_KEYS.ACCESS_TOKEN);
  },

  async setAccessToken(token: string): Promise<void> {
    return setSecureItem(TOKEN_KEYS.ACCESS_TOKEN, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return getSecureItem(TOKEN_KEYS.REFRESH_TOKEN);
  },

  async setRefreshToken(token: string): Promise<void> {
    return setSecureItem(TOKEN_KEYS.REFRESH_TOKEN, token);
  },

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      setSecureItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken),
      setSecureItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken),
    ]);
  },

  async clearTokens(): Promise<void> {
    await deleteSecureItems([TOKEN_KEYS.ACCESS_TOKEN, TOKEN_KEYS.REFRESH_TOKEN]);
  },

  async hasTokens(): Promise<boolean> {
    const token = await getSecureItem(TOKEN_KEYS.ACCESS_TOKEN);
    return !!token;
  },
};
