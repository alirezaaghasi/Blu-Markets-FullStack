// API Configuration
// Based on BACKEND_INTEGRATION_V2.md Phase 1

// Environment-based configuration
const ENV = {
  development: {
    API_BASE_URL: 'http://localhost:3000/api/v1',
    WS_BASE_URL: 'ws://localhost:3000',
  },
  staging: {
    API_BASE_URL: 'https://staging-api.blumarkets.ir/api/v1',
    WS_BASE_URL: 'wss://staging-api.blumarkets.ir',
  },
  production: {
    API_BASE_URL: 'https://api.blumarkets.ir/api/v1',
    WS_BASE_URL: 'wss://api.blumarkets.ir',
  },
};

// Get environment from Expo public env vars or default to development
const getEnvironment = (): 'development' | 'staging' | 'production' => {
  const env = process.env.EXPO_PUBLIC_ENV;
  if (env === 'staging' || env === 'production') {
    return env;
  }
  return 'development';
};

const currentEnv = getEnvironment();

// Demo mode toggle - use demo mode in development unless explicitly disabled
// Set EXPO_PUBLIC_USE_BACKEND=true to use real backend
export const DEMO_MODE = false; // Using real backend

// API URLs - can be overridden via environment variables
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || ENV[currentEnv].API_BASE_URL;
export const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_URL || ENV[currentEnv].WS_BASE_URL;

// API timeout configuration
export const API_TIMEOUT = 10000; // 10 seconds

// WebSocket configuration
export const WS_RECONNECT_INTERVAL = 5000; // 5 seconds
export const WS_PING_INTERVAL = 30000; // 30 seconds

// Token storage keys
export const TOKEN_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;
