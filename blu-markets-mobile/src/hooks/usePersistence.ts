// Persistence Hook
// Automatically saves and loads state from AsyncStorage
import { useEffect, useRef, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from './useStore';
import {
  saveAuthState,
  savePortfolioState,
  saveOnboardingState,
  savePricesCache,
  loadAllState,
  clearAllState,
} from '../utils/storage';
import { initializePortfolio, setTargetLayerPct } from '../store/slices/portfolioSlice';
import { setAuthToken, setPhone } from '../store/slices/authSlice';
import { setRiskProfile, setConsent, setInitialInvestment } from '../store/slices/onboardingSlice';
import { setPrices, setFxRate } from '../store/slices/pricesSlice';

// Debounce time for saving (prevent too frequent writes)
const DEBOUNCE_MS = 1000;

export const usePersistence = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);
  const portfolio = useAppSelector((state) => state.portfolio);
  const onboarding = useAppSelector((state) => state.onboarding);
  const prices = useAppSelector((state) => state.prices);

  const isInitializedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load persisted state on mount
  const loadPersistedState = useCallback(async () => {
    if (isInitializedRef.current) return;

    try {
      const data = await loadAllState();

      // Restore auth state
      if (data.auth) {
        if (data.auth.phone) {
          dispatch(setPhone(data.auth.phone));
        }
        // Note: Token is stored in secure storage, not AsyncStorage
        // We'll check SecureStore for the token separately
      }

      // Restore portfolio state
      if (data.portfolio) {
        if (data.portfolio.holdings && data.portfolio.targetLayerPct) {
          dispatch(initializePortfolio({
            cashIRR: data.portfolio.cashIRR || 0,
            holdings: data.portfolio.holdings,
            targetLayerPct: data.portfolio.targetLayerPct,
          }));
        }
      }

      // Restore onboarding state (if user was mid-onboarding)
      if (data.onboarding) {
        if (data.onboarding.riskProfile) {
          dispatch(setRiskProfile(data.onboarding.riskProfile));
        }
        if (data.onboarding.consents) {
          if (data.onboarding.consents.riskAcknowledged) {
            dispatch(setConsent({ key: 'riskAcknowledged', value: true }));
          }
          if (data.onboarding.consents.lossAcknowledged) {
            dispatch(setConsent({ key: 'lossAcknowledged', value: true }));
          }
          if (data.onboarding.consents.noGuaranteeAcknowledged) {
            dispatch(setConsent({ key: 'noGuaranteeAcknowledged', value: true }));
          }
        }
        if (data.onboarding.initialInvestment) {
          dispatch(setInitialInvestment(data.onboarding.initialInvestment));
        }
      }

      // Restore prices cache (for offline support)
      if (data.pricesCache?.prices) {
        dispatch(setPrices(data.pricesCache.prices));
        if (data.pricesCache.fxRate) {
          dispatch(setFxRate({
            rate: data.pricesCache.fxRate,
            source: data.pricesCache.fxSource || 'fallback',
          }));
        }
      }

      isInitializedRef.current = true;
    } catch (error) {
      console.error('Failed to load persisted state:', error);
      isInitializedRef.current = true;
    }
  }, [dispatch]);

  // Debounced save function
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await Promise.all([
          saveAuthState(auth),
          savePortfolioState(portfolio),
          saveOnboardingState(onboarding),
          savePricesCache(prices),
        ]);
      } catch (error) {
        console.error('Failed to persist state:', error);
      }
    }, DEBOUNCE_MS);
  }, [auth, portfolio, onboarding, prices]);

  // Load state on mount
  useEffect(() => {
    loadPersistedState();
  }, [loadPersistedState]);

  // Save state when it changes (debounced)
  useEffect(() => {
    if (!isInitializedRef.current) return;
    debouncedSave();
  }, [auth, portfolio, onboarding, prices, debouncedSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Manual clear function (for logout)
  const clearPersisted = useCallback(async () => {
    await clearAllState();
  }, []);

  return {
    isInitialized: isInitializedRef.current,
    clearPersisted,
    loadPersistedState,
  };
};

export default usePersistence;
