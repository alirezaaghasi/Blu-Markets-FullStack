// API Switcher
// Toggles between real and mock API based on DEMO_MODE
// Based on BACKEND_INTEGRATION_V2.md Phase 1.1

import { DEMO_MODE } from '../config/api';
import * as realApi from './realApi';
import * as mockApi from './mockApi';

// Export the appropriate API implementation
// In demo mode: use mockApi (works offline with Redux store)
// In real mode: use realApi (calls actual backend)
export const api = DEMO_MODE ? mockApi : realApi;

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
} from './realApi';

// Export DEMO_MODE for components that need to know
export { DEMO_MODE };

// Usage example:
// import { api, DEMO_MODE } from '@/services/apiSwitch';
//
// const fetchPortfolio = async () => {
//   try {
//     const portfolio = await api.portfolio.get();
//     console.log('Portfolio:', portfolio);
//   } catch (error) {
//     console.error('Failed to fetch portfolio:', error);
//   }
// };
//
// API Namespaces:
// - api.auth       - Authentication (sendOtp, verifyOtp, logout)
// - api.onboarding - Onboarding flow (submitQuestionnaire, recordConsent, createPortfolio)
// - api.portfolio  - Portfolio data (get, addFunds, getAsset)
// - api.trade      - Trading (preview, execute)
// - api.activity   - Activity feed (getRecent, getAll) - for Home tab
// - api.rebalance  - Rebalancing (getStatus, preview, execute)
// - api.protection - Protections (getActive, getEligible, purchase, cancel) - for Services tab
// - api.loans      - Loans (getAll, getCapacity, create, repay) - for Services tab
// - api.prices     - Price data (getAll)
// - api.user       - User profile (getProfile, updateSettings) - for Profile tab
