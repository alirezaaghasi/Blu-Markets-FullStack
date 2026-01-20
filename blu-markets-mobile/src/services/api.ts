// API Service
// Connects to Blu Markets backend
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/business';

// Token storage keys
const ACCESS_TOKEN_KEY = 'blu_access_token';
const REFRESH_TOKEN_KEY = 'blu_refresh_token';

// Store tokens securely
export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

// Get stored tokens
export async function getTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  return { accessToken, refreshToken };
}

// Clear tokens on logout
export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// API Error type
export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
}

// Auth response types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  expiresIn: number;
}

export interface VerifyOtpResponse {
  success: boolean;
  tokens: AuthTokens;
  isNewUser: boolean;
  onboardingComplete: boolean;
}

// Generic fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add auth token if available
  const { accessToken } = await getTokens();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const error: ApiError = {
      code: data.error?.code || 'UNKNOWN_ERROR',
      message: data.error?.message || 'An unexpected error occurred',
      statusCode: response.status,
    };
    throw error;
  }

  return data;
}

// Auth API
export const authApi = {
  // Send OTP to phone number
  async sendOtp(phone: string): Promise<SendOtpResponse> {
    return apiFetch<SendOtpResponse>('/api/v1/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  // Verify OTP and get tokens
  async verifyOtp(phone: string, code: string): Promise<VerifyOtpResponse> {
    const response = await apiFetch<VerifyOtpResponse>('/api/v1/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });

    // Store tokens on successful verification
    if (response.tokens) {
      await storeTokens(response.tokens.accessToken, response.tokens.refreshToken);
    }

    return response;
  },

  // Refresh access token
  async refreshTokens(): Promise<AuthTokens> {
    const { refreshToken } = await getTokens();
    if (!refreshToken) {
      throw { code: 'NO_REFRESH_TOKEN', message: 'No refresh token available', statusCode: 401 };
    }

    const response = await apiFetch<AuthTokens>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    await storeTokens(response.accessToken, response.refreshToken);
    return response;
  },

  // Logout
  async logout(): Promise<void> {
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      await clearTokens();
    }
  },
};

// Onboarding API
export interface QuestionnaireAnswer {
  questionId: string;
  answerId: string;
  value: number;
}

export interface RiskProfileResponse {
  riskScore: number;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
  profileName: string;
  targetAllocation: {
    foundation: number;
    growth: number;
    upside: number;
  };
}

export interface InitialFundingResponse {
  portfolioId: string;
  cashIrr: number;
  targetAllocation: {
    foundation: number;
    growth: number;
    upside: number;
  };
}

export const onboardingApi = {
  // Submit questionnaire answers
  async submitQuestionnaire(answers: QuestionnaireAnswer[]): Promise<RiskProfileResponse> {
    return apiFetch<RiskProfileResponse>('/api/v1/onboarding/questionnaire', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  // Record user consents
  async recordConsent(): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>('/api/v1/onboarding/consent', {
      method: 'POST',
      body: JSON.stringify({
        consentRisk: true,
        consentLoss: true,
        consentNoGuarantee: true,
      }),
    });
  },

  // Create portfolio with initial funding
  async createPortfolio(amountIrr: number): Promise<InitialFundingResponse> {
    return apiFetch<InitialFundingResponse>('/api/v1/onboarding/initial-funding', {
      method: 'POST',
      body: JSON.stringify({ amountIrr }),
    });
  },
};

// Portfolio API
export interface PortfolioSummary {
  id: string;
  cashIrr: number;
  totalValueIrr: number;
  holdingsValueIrr: number;
  allocation: {
    foundation: number;
    growth: number;
    upside: number;
  };
  targetAllocation: {
    foundation: number;
    growth: number;
    upside: number;
  };
  status: 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';
  driftPct: number;
  holdingsCount: number;
  activeLoansCount: number;
  activeProtectionsCount: number;
}

export interface HoldingResponse {
  assetId: string;
  name: string;
  quantity: number;
  layer: 'FOUNDATION' | 'GROWTH' | 'UPSIDE';
  frozen: boolean;
  valueIrr: number;
  valueUsd: number;
  priceUsd: number;
  priceIrr: number;
  change24hPct: number;
  pctOfPortfolio: number;
}

export const portfolioApi = {
  // Get portfolio summary
  async getSummary(): Promise<PortfolioSummary> {
    return apiFetch<PortfolioSummary>('/api/v1/portfolio');
  },

  // Get holdings
  async getHoldings(): Promise<HoldingResponse[]> {
    return apiFetch<HoldingResponse[]>('/api/v1/portfolio/holdings');
  },

  // Add funds
  async addFunds(amountIrr: number): Promise<{ newCashIrr: number; ledgerEntryId: string }> {
    return apiFetch<{ newCashIrr: number; ledgerEntryId: string }>('/api/v1/portfolio/add-funds', {
      method: 'POST',
      body: JSON.stringify({ amountIrr }),
    });
  },
};

// Trade API
export interface TradePreviewResponse {
  valid: boolean;
  preview: {
    action: 'BUY' | 'SELL';
    assetId: string;
    quantity: number;
    amountIrr: number;
    priceIrr: number;
    spread: number;
    spreadAmountIrr: number;
  };
  allocation: {
    before: { foundation: number; growth: number; upside: number };
    target: { foundation: number; growth: number; upside: number };
    after: { foundation: number; growth: number; upside: number };
  };
  boundary: 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';
  frictionCopy: string;
  movesToward: boolean;
  error?: string;
}

export interface TradeExecuteResponse {
  success: boolean;
  trade: {
    action: 'BUY' | 'SELL';
    assetId: string;
    quantity: number;
    amountIrr: number;
    priceIrr: number;
  };
  newBalance: {
    cashIrr: number;
    holdingQuantity: number;
  };
  boundary: 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';
  ledgerEntryId: string;
}

export const tradeApi = {
  // Preview trade
  async preview(
    action: 'BUY' | 'SELL',
    assetId: string,
    amountIrr: number
  ): Promise<TradePreviewResponse> {
    return apiFetch<TradePreviewResponse>('/api/v1/trade/preview', {
      method: 'POST',
      body: JSON.stringify({ action, assetId, amountIrr }),
    });
  },

  // Execute trade
  async execute(
    action: 'BUY' | 'SELL',
    assetId: string,
    amountIrr: number,
    acknowledgedWarning?: boolean
  ): Promise<TradeExecuteResponse> {
    return apiFetch<TradeExecuteResponse>('/api/v1/trade/execute', {
      method: 'POST',
      body: JSON.stringify({ action, assetId, amountIrr, acknowledgedWarning }),
    });
  },
};

export default authApi;
