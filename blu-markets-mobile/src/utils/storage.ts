// Storage Utilities
// Handles persisting and loading app state using AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PortfolioState, AuthState, OnboardingState, PriceState } from '../types';

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
export const savePortfolioState = async (state: PortfolioState): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PORTFOLIO, JSON.stringify(state));
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  } catch (error) {
    if (__DEV__) console.error('Failed to save portfolio state:', error);
  }
};

// Load portfolio state
export const loadPortfolioState = async (): Promise<Partial<PortfolioState> | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PORTFOLIO);
    return data ? JSON.parse(data) : null;
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
