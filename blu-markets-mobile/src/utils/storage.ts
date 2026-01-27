// Storage Utilities
// Handles persisting and loading app state using AsyncStorage
//
// BUG-004 FIX: Portfolio state is now obfuscated before storage
//
// ⚠️⚠️⚠️ BUG-012 SECURITY WARNING ⚠️⚠️⚠️
// Current implementation uses XOR obfuscation which is NOT cryptographically secure!
// XOR with a hardcoded key can be trivially reversed by anyone with source code access.
//
// PRODUCTION REQUIREMENTS:
// 1. Replace XOR obfuscation with AES-256 encryption (expo-crypto)
// 2. Derive encryption key from device-specific data (not hardcoded)
// 3. Use expo-secure-store for sensitive tokens (already in package.json)
// 4. Consider adding HMAC for integrity verification
//
// ACCEPTABLE FOR: Demo/development mode where security is secondary
// NOT ACCEPTABLE FOR: Production deployment with real user data
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PortfolioState, AuthState, OnboardingState, PriceState } from '../types';

// BUG-004 FIX: Simple obfuscation for sensitive data at rest
// In production, replace with proper encryption using device-bound keys
// This provides basic protection against casual inspection of backup files
const OBFUSCATION_KEY = 'blu_markets_v1'; // Simple key for base64 + XOR obfuscation

function obfuscateData(data: string): string {
  // Convert to base64 first
  const base64 = typeof btoa !== 'undefined'
    ? btoa(unescape(encodeURIComponent(data)))
    : Buffer.from(data).toString('base64');

  // XOR with key for basic obfuscation
  let result = '';
  for (let i = 0; i < base64.length; i++) {
    const charCode = base64.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length);
    result += String.fromCharCode(charCode);
  }

  // Return as base64 to ensure safe storage
  return typeof btoa !== 'undefined'
    ? btoa(result)
    : Buffer.from(result).toString('base64');
}

function deobfuscateData(obfuscated: string): string {
  try {
    // Decode outer base64
    const xored = typeof atob !== 'undefined'
      ? atob(obfuscated)
      : Buffer.from(obfuscated, 'base64').toString();

    // XOR with key to reverse obfuscation
    let base64 = '';
    for (let i = 0; i < xored.length; i++) {
      const charCode = xored.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length);
      base64 += String.fromCharCode(charCode);
    }

    // Decode inner base64
    return typeof atob !== 'undefined'
      ? decodeURIComponent(escape(atob(base64)))
      : Buffer.from(base64, 'base64').toString();
  } catch (error) {
    // If deobfuscation fails, try parsing as plain JSON (migration from old format)
    if (__DEV__) console.warn('[Storage] Failed to deobfuscate, trying plain JSON');
    return obfuscated;
  }
}

// Storage keys
const STORAGE_KEYS = {
  AUTH: '@blu_markets_auth',
  PORTFOLIO: '@blu_markets_portfolio',
  ONBOARDING: '@blu_markets_onboarding',
  PRICES_CACHE: '@blu_markets_prices_cache',
  LAST_SYNC: '@blu_markets_last_sync',
} as const;

// Type-safe storage interface
interface StorageData {
  auth?: Partial<AuthState>;
  portfolio?: Partial<PortfolioState>;
  onboarding?: Partial<OnboardingState>;
  pricesCache?: Partial<PriceState>;
  lastSync?: number;
}

// Save auth state
export const saveAuthState = async (state: AuthState): Promise<void> => {
  try {
    // Don't persist the auth token in regular storage - use secure store
    const stateToSave = {
      phone: state.phone,
      isAuthenticated: state.isAuthenticated,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(stateToSave));
  } catch (error) {
    if (__DEV__) console.error('Failed to save auth state:', error);
  }
};

// Load auth state
export const loadAuthState = async (): Promise<Partial<AuthState> | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.AUTH);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    if (__DEV__) console.error('Failed to load auth state:', error);
    return null;
  }
};

// Save portfolio state
// BUG-004 FIX: Portfolio state is now obfuscated before storage
export const savePortfolioState = async (state: PortfolioState): Promise<void> => {
  try {
    const jsonData = JSON.stringify(state);
    // BUG-004 FIX: Obfuscate sensitive portfolio data before storing
    const obfuscatedData = obfuscateData(jsonData);
    await AsyncStorage.setItem(STORAGE_KEYS.PORTFOLIO, obfuscatedData);
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  } catch (error) {
    if (__DEV__) console.error('Failed to save portfolio state:', error);
  }
};

// Load portfolio state
// BUG-004 FIX: Portfolio state is deobfuscated when loading
export const loadPortfolioState = async (): Promise<Partial<PortfolioState> | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PORTFOLIO);
    if (!data) return null;

    // BUG-004 FIX: Deobfuscate portfolio data (handles migration from plain JSON)
    const jsonData = deobfuscateData(data);
    return JSON.parse(jsonData);
  } catch (error) {
    if (__DEV__) console.error('Failed to load portfolio state:', error);
    return null;
  }
};

// Save onboarding state
export const saveOnboardingState = async (state: OnboardingState): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, JSON.stringify(state));
  } catch (error) {
    if (__DEV__) console.error('Failed to save onboarding state:', error);
  }
};

// Load onboarding state
export const loadOnboardingState = async (): Promise<Partial<OnboardingState> | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    if (__DEV__) console.error('Failed to load onboarding state:', error);
    return null;
  }
};

// Save prices cache (for offline support)
export const savePricesCache = async (state: PriceState): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PRICES_CACHE, JSON.stringify(state));
  } catch (error) {
    if (__DEV__) console.error('Failed to save prices cache:', error);
  }
};

// Load prices cache
export const loadPricesCache = async (): Promise<Partial<PriceState> | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PRICES_CACHE);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    if (__DEV__) console.error('Failed to load prices cache:', error);
    return null;
  }
};

// Load all persisted state
export const loadAllState = async (): Promise<StorageData> => {
  try {
    const [auth, portfolio, onboarding, pricesCache, lastSync] = await Promise.all([
      loadAuthState(),
      loadPortfolioState(),
      loadOnboardingState(),
      loadPricesCache(),
      AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC),
    ]);

    return {
      auth: auth || undefined,
      portfolio: portfolio || undefined,
      onboarding: onboarding || undefined,
      pricesCache: pricesCache || undefined,
      lastSync: lastSync ? parseInt(lastSync, 10) : undefined,
    };
  } catch (error) {
    if (__DEV__) console.error('Failed to load all state:', error);
    return {};
  }
};

// Clear all persisted state (for logout)
export const clearAllState = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH,
      STORAGE_KEYS.PORTFOLIO,
      STORAGE_KEYS.ONBOARDING,
      STORAGE_KEYS.PRICES_CACHE,
      STORAGE_KEYS.LAST_SYNC,
    ]);
  } catch (error) {
    if (__DEV__) console.error('Failed to clear all state:', error);
  }
};

// Clear only portfolio state (for reset)
export const clearPortfolioState = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.PORTFOLIO);
  } catch (error) {
    if (__DEV__) console.error('Failed to clear portfolio state:', error);
  }
};

// Get last sync timestamp
export const getLastSyncTime = async (): Promise<number | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return data ? parseInt(data, 10) : null;
  } catch (error) {
    if (__DEV__) console.error('Failed to get last sync time:', error);
    return null;
  }
};
