// API Response Types
// Shared types for all API modules

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

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
  onboardingComplete?: boolean;
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

// Re-export types from main types file for convenience
export type {
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
};
