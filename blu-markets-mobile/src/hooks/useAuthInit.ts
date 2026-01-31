/**
 * Auth Initialization Hook
 *
 * Restores auth state from secure storage on app startup.
 * This solves the auth state drift issue where tokens exist in secure storage
 * but Redux state shows user as logged out after cold start.
 */
import { useEffect, useState } from 'react';
import { tokenStorage } from '../utils/secureStorage';
import { useAppDispatch } from './useStore';
import { setAuthToken, completeOnboarding, logout } from '../store/slices/authSlice';
import { API_BASE_URL } from '../config/api';
import { refreshAccessToken as sharedRefreshAccessToken } from '../utils/authRefresh';

interface AuthInitState {
  isInitializing: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

/**
 * Validates an access token by making a lightweight API call.
 * Uses the portfolio endpoint to check if user has completed onboarding.
 * Returns user data if valid, null if invalid/expired.
 */
async function validateToken(accessToken: string): Promise<{ onboardingComplete: boolean } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/portfolio`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true',
      },
    });

    if (response.ok) {
      // User has a portfolio - onboarding is complete
      return { onboardingComplete: true };
    }

    // Token expired - need to refresh
    if (response.status === 401) {
      return null;
    }

    // 404 - User doesn't have a portfolio yet (still onboarding)
    if (response.status === 404) {
      return { onboardingComplete: false };
    }

    // Other errors - assume token is valid but endpoint failed
    // Better to let user in than lock them out
    return { onboardingComplete: false };
  } catch {
    // Network error - assume token is valid but be conservative about onboarding
    // User will get proper errors when they try to do something
    return { onboardingComplete: false };
  }
}

// Token refresh is handled by the shared authRefresh utility

/**
 * Hook to initialize auth state from secure storage on app startup.
 *
 * Usage:
 * ```tsx
 * function App() {
 *   const { isInitializing } = useAuthInit();
 *
 *   if (isInitializing) {
 *     return <SplashScreen />;
 *   }
 *
 *   return <RootNavigator />;
 * }
 * ```
 */
export function useAuthInit(): AuthInitState {
  const dispatch = useAppDispatch();
  const [state, setState] = useState<AuthInitState>({
    isInitializing: true,
    isAuthenticated: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        // Check if we have tokens in secure storage
        const accessToken = await tokenStorage.getAccessToken();

        if (!accessToken) {
          // No tokens - user needs to log in
          if (mounted) {
            setState({ isInitializing: false, isAuthenticated: false, error: null });
          }
          return;
        }

        // Try to validate the access token
        let validationResult = await validateToken(accessToken);

        if (!validationResult) {
          // Access token invalid/expired - try to refresh using shared utility
          // The shared function handles getting refresh token, storing new tokens, etc.
          const newAccessToken = await sharedRefreshAccessToken();

          if (newAccessToken) {
            // Validate with new token
            validationResult = await validateToken(newAccessToken);

            if (validationResult) {
              // Success - restore auth state with new token
              dispatch(setAuthToken(newAccessToken));
              if (validationResult.onboardingComplete) {
                dispatch(completeOnboarding());
              }
              if (mounted) {
                setState({ isInitializing: false, isAuthenticated: true, error: null });
              }
              return;
            }
          }

          // Refresh failed - clear tokens and require re-login
          // (shared utility already cleared tokens on failure)
          dispatch(logout());
          if (mounted) {
            setState({ isInitializing: false, isAuthenticated: false, error: null });
          }
          return;
        }

        // Token is valid - restore auth state
        dispatch(setAuthToken(accessToken));
        if (validationResult.onboardingComplete) {
          dispatch(completeOnboarding());
        }

        if (mounted) {
          setState({ isInitializing: false, isAuthenticated: true, error: null });
        }
      } catch (error) {
        // Unexpected error - log out to be safe
        console.error('[AuthInit] Unexpected error:', error);
        await tokenStorage.clearTokens();
        dispatch(logout());

        if (mounted) {
          setState({
            isInitializing: false,
            isAuthenticated: false,
            error: error instanceof Error ? error.message : 'Auth initialization failed',
          });
        }
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [dispatch]);

  return state;
}

export default useAuthInit;
