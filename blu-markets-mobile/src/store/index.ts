// Redux Store Configuration
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import onboardingReducer from './slices/onboardingSlice';
import portfolioReducer from './slices/portfolioSlice';
import pricesReducer from './slices/pricesSlice';
import uiReducer from './slices/uiSlice';
import { apiSlice } from './api/apiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    onboarding: onboardingReducer,
    portfolio: portfolioReducer,
    prices: pricesReducer,
    ui: uiReducer,
    // RTK Query API reducer - handles caching, invalidation, and refetching
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['portfolio/setLastSync'],
        // Ignore RTK Query internal paths
        ignoredPaths: ['api'],
      },
    }).concat(apiSlice.middleware), // RTK Query middleware for caching and invalidation
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Re-export RTK Query hooks for convenience
export * from './api/apiSlice';
