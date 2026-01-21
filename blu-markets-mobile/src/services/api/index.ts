// API Switcher - Main Export
// Automatically switches between real and mock APIs based on DEMO_MODE

import { DEMO_MODE } from '../../config/api';

// Import real API modules
import { auth as realAuth } from './auth';
import { portfolio as realPortfolio } from './portfolio';
import { activity as realActivity } from './activity';
import { trade as realTrade } from './trade';
import { loans as realLoans } from './loans';
import { protection as realProtection } from './protection';
import { rebalance as realRebalance } from './rebalance';
import { onboarding as realOnboarding } from './onboarding';
import { prices as realPrices } from './prices';
import { user as realUser } from './user';

// Import mock API modules
import {
  auth as mockAuth,
  portfolio as mockPortfolio,
  activity as mockActivity,
  trade as mockTrade,
  loans as mockLoans,
  protection as mockProtection,
  rebalance as mockRebalance,
  onboarding as mockOnboarding,
  prices as mockPrices,
  user as mockUser,
} from './mock';

// Export the appropriate API based on DEMO_MODE
export const auth = DEMO_MODE ? mockAuth : realAuth;
export const portfolio = DEMO_MODE ? mockPortfolio : realPortfolio;
export const activity = DEMO_MODE ? mockActivity : realActivity;
export const trade = DEMO_MODE ? mockTrade : realTrade;
export const loans = DEMO_MODE ? mockLoans : realLoans;
export const protection = DEMO_MODE ? mockProtection : realProtection;
export const rebalance = DEMO_MODE ? mockRebalance : realRebalance;
export const onboarding = DEMO_MODE ? mockOnboarding : realOnboarding;
export const prices = DEMO_MODE ? mockPrices : realPrices;
export const user = DEMO_MODE ? mockUser : realUser;

// Re-export types for convenience
export type {
  AuthResponse,
  QuestionnaireResponse,
  PortfolioResponse,
  ActivityResponse,
  LoanCapacityResponse,
  LoansResponse,
  ProtectionsResponse,
  EligibleAssetsResponse,
  PricesResponse,
  TradeExecuteResponse,
  UserProfile,
  UserSettings,
} from './types';

// Re-export client utilities
export { setAuthTokens, clearAuthTokens, isAuthenticated } from './client';

// Combined API object for backwards compatibility
export const api = {
  auth,
  portfolio,
  activity,
  trade,
  loans,
  protection,
  rebalance,
  onboarding,
  prices,
  user,
};

export default api;
