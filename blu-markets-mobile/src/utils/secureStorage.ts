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

// BUG-003 FIX: Block web token storage in production to prevent XSS vulnerability
// localStorage is vulnerable to XSS attacks - production web apps MUST use HttpOnly cookies
const isProductionWeb = isWeb && process.env.NODE_ENV === 'production';

// BUG-019 FIX: Throw error instead of just logging in production
if (isProductionWeb) {
  throw new Error(
    '[SecureStorage] SECURITY ERROR: Web platform token storage is disabled in production. ' +
    'localStorage is vulnerable to XSS attacks. ' +
    'PRODUCTION WEB APPS MUST use HttpOnly cookies. ' +
    'See: https://owasp.org/www-community/HttpOnly'
  );
}

/**
 * Securely store a value
 * BUG-003 FIX: Throws error in production web builds to prevent XSS vulnerability
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    // BUG-003 FIX: Block token storage on production web - XSS vulnerability
    if (isProductionWeb) {
      throw new Error(
        '[SecureStorage] Token storage is blocked on production web. ' +
        'Use HttpOnly cookies instead. See: https://owasp.org/www-community/HttpOnly'
      );
    }
    // Development-only: allow localStorage for testing
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
 * BUG-003 FIX: Throws error in production web builds to prevent XSS vulnerability
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) {
    // BUG-003 FIX: Block token retrieval on production web - XSS vulnerability
    if (isProductionWeb) {
      throw new Error(
        '[SecureStorage] Token retrieval is blocked on production web. ' +
        'Use HttpOnly cookies instead. See: https://owasp.org/www-community/HttpOnly'
      );
    }
    // Development-only: allow localStorage for testing
    return localStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
}

/**
 * Securely delete a value
 * BUG-003 FIX: Throws error in production web builds to prevent XSS vulnerability
 */
export async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) {
    // BUG-003 FIX: Block token deletion on production web
    if (isProductionWeb) {
      throw new Error(
        '[SecureStorage] Token operations are blocked on production web. ' +
        'Use HttpOnly cookies instead. See: https://owasp.org/www-community/HttpOnly'
      );
    }
    // Development-only: allow localStorage for testing
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
