// Real API Endpoints
// Based on BACKEND_INTEGRATION_V2.md Phase 1.2

import { apiClient, setAuthTokens, clearAuthTokens } from './client';
import type {
  AssetId,
  Holding,
  Loan,
  Protection,
  TargetLayerPct,
  ActionLogEntry,
  PortfolioStatus,
  TradePreview,
  RebalancePreview,
  Boundary,
} from '../../types';

// Response types for API calls
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}

export interface QuestionnaireResponse {
  riskScore: number;
  riskTier: number;
  riskProfile: {
    name: string;
    nameFa: string;
  };
  targetAllocation: TargetLayerPct;
}

export interface PortfolioResponse {
  cashIrr: number;
  holdings: Holding[];
  targetAllocation: TargetLayerPct;
  status: PortfolioStatus;
  totalValueIrr: number;
  dailyChangePercent: number;
}

export interface ActivityResponse {
  activities: ActionLogEntry[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface LoanCapacityResponse {
  availableIrr: number;
  usedIrr: number;
  maxCapacityIrr: number;
  portfolioValueIrr: number;
}

export interface LoansResponse {
  loans: Loan[];
}

export interface ProtectionsResponse {
  protections: Protection[];
}

export interface EligibleAssetsResponse {
  assets: Array<{
    assetId: AssetId;
    holdingQuantity: number;
    holdingValueIrr: number;
    premiumRatePerMonth: number;
    estimatedPremiumIrr: number;
  }>;
}

export interface PricesResponse {
  prices: Record<string, number>;
  fxRate: number;
  timestamp: string;
}

export interface TradeExecuteResponse {
  success: boolean;
  tradeId: string;
  assetId: AssetId;
  side: 'BUY' | 'SELL';
  amountIrr: number;
  quantity: number;
  boundary: Boundary;
  newHoldingQuantity: number;
  // BUG-017 FIX: Backend must return the new cash balance (includes spread/fees)
  newCashIrr: number;
}

export interface UserProfile {
  id: string;
  phone: string;
  riskScore: number;
  riskTier: number;
  profileName: string;
  profileNameFa: string;
  createdAt: string;
}

export interface UserSettings {
  language: 'en' | 'fa';
  notifications: boolean;
  biometricEnabled: boolean;
}

// Authentication APIs
export const auth = {
  sendOtp: (phone: string): Promise<{ success: boolean }> =>
    apiClient.post('/auth/send-otp', { phone }),

  verifyOtp: async (phone: string, code: string): Promise<AuthResponse> => {
    const response: AuthResponse = await apiClient.post('/auth/verify-otp', { phone, code });
    // Store tokens after successful verification
    await setAuthTokens(response.accessToken, response.refreshToken);
    return response;
  },

  refresh: (): Promise<AuthResponse> =>
    apiClient.post('/auth/refresh'),

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      await clearAuthTokens();
    }
  },
};

// Onboarding APIs
export const onboarding = {
  submitQuestionnaire: (answers: Record<string, number>): Promise<QuestionnaireResponse> =>
    apiClient.post('/onboarding/questionnaire', { answers }),

  recordConsent: (): Promise<{ success: boolean }> =>
    apiClient.post('/onboarding/consent'),

  createPortfolio: (amountIrr: number): Promise<PortfolioResponse> =>
    apiClient.post('/onboarding/initial-funding', { amountIrr }),
};

// Portfolio APIs
export const portfolio = {
  get: (): Promise<PortfolioResponse> =>
    apiClient.get('/portfolio'),

  addFunds: (amountIrr: number): Promise<PortfolioResponse> =>
    apiClient.post('/portfolio/add-funds', { amountIrr }),

  getAsset: (assetId: AssetId): Promise<{
    holding: Holding;
    currentPriceUsd: number;
    valueIrr: number;
    changePercent24h: number;
  }> =>
    apiClient.get(`/portfolio/asset/${assetId}`),
};

// Trade APIs
export const trade = {
  preview: (assetId: AssetId, side: 'BUY' | 'SELL', amountIrr: number): Promise<TradePreview> =>
    apiClient.post('/trade/preview', { assetId, side, amountIrr }),

  execute: (assetId: AssetId, side: 'BUY' | 'SELL', amountIrr: number): Promise<TradeExecuteResponse> =>
    apiClient.post('/trade/execute', { assetId, side, amountIrr }),
};

// Activity APIs (for Home tab Activity Feed)
export const activity = {
  getRecent: (limit = 20): Promise<ActivityResponse> =>
    apiClient.get(`/history/activity?limit=${limit}`),

  getAll: (cursor?: string): Promise<ActivityResponse> =>
    apiClient.get(`/history/all${cursor ? `?cursor=${cursor}` : ''}`),
};

// Rebalance APIs
export const rebalance = {
  getStatus: (): Promise<{
    needsRebalance: boolean;
    lastRebalanceAt: string | null;
    canRebalance: boolean;
    reason?: string;
  }> =>
    apiClient.get('/rebalance/status'),

  preview: (): Promise<RebalancePreview> =>
    apiClient.get('/rebalance/preview'),

  execute: (): Promise<{
    success: boolean;
    tradesExecuted: number;
    newStatus: PortfolioStatus;
  }> =>
    apiClient.post('/rebalance/execute'),
};

// Protection APIs (for Services tab > Protection sub-tab)
export const protection = {
  getActive: (): Promise<ProtectionsResponse> =>
    apiClient.get('/protection'),

  getEligible: (): Promise<EligibleAssetsResponse> =>
    apiClient.get('/protection/eligible'),

  purchase: (assetId: AssetId, durationMonths: number): Promise<Protection> =>
    apiClient.post('/protection', { assetId, durationMonths }),

  cancel: (protectionId: string): Promise<{ success: boolean }> =>
    apiClient.delete(`/protection/${protectionId}`),
};

// Loans APIs (for Services tab > Loans sub-tab)
export const loans = {
  getAll: (): Promise<LoansResponse> =>
    apiClient.get('/loans'),

  getCapacity: (): Promise<LoanCapacityResponse> =>
    apiClient.get('/loans/capacity'),

  create: (amountIrr: number, termMonths: 3 | 6): Promise<Loan> =>
    apiClient.post('/loans', { amountIrr, termMonths }),

  repay: (loanId: string, amountIrr: number): Promise<{
    success: boolean;
    remainingBalance: number;
    installmentsPaid: number;
  }> =>
    apiClient.post(`/loans/${loanId}/repay`, { amountIrr }),
};

// Prices APIs
export const prices = {
  getAll: (): Promise<PricesResponse> =>
    apiClient.get('/prices'),
};

// User APIs (for Profile tab)
export const user = {
  getProfile: (): Promise<UserProfile> =>
    apiClient.get('/user/profile'),

  updateSettings: (settings: Partial<UserSettings>): Promise<UserSettings> =>
    apiClient.patch('/user/settings', settings),
};
