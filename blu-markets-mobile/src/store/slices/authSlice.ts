// Auth Slice
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DEMO_TOKEN } from '../../constants/business';

interface AuthState {
  phone: string | null;
  authToken: string | null;
  isAuthenticated: boolean;
  onboardingComplete: boolean;
}

const initialState: AuthState = {
  phone: null,
  authToken: null,
  isAuthenticated: false,
  onboardingComplete: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setPhone: (state, action: PayloadAction<string>) => {
      state.phone = action.payload;
    },
    setAuthToken: (state, action: PayloadAction<string>) => {
      state.authToken = action.payload;
      state.isAuthenticated = true;
    },
    completeOnboarding: (state) => {
      state.onboardingComplete = true;
    },
    // Demo mode: skip directly to main app with mock data
    // SECURITY: Only allowed in development builds to prevent production bypass
    enableDemoMode: (state) => {
      if (!__DEV__) {
        console.warn('Demo mode is not available in production builds');
        return;
      }
      state.authToken = DEMO_TOKEN;
      state.isAuthenticated = true;
      state.onboardingComplete = true;
      state.phone = '+989123456789';
    },
    logout: (state) => {
      state.phone = null;
      state.authToken = null;
      state.isAuthenticated = false;
      state.onboardingComplete = false;
    },
  },
});

export const { setPhone, setAuthToken, completeOnboarding, enableDemoMode, logout } = authSlice.actions;
export default authSlice.reducer;
