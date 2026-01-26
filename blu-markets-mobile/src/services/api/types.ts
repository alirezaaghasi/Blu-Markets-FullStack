// API Response Types
// Shared types for all API modules

import type {
  AssetId,
  Holding,
  Loan,
  Protection,
  ProtectionQuote,
  ProtectableHolding,
  PremiumCurvePoint,
  AssetVolatility,
  TargetLayerPct,
  ActionLogEntry,
  PortfolioStatus,
  TradePreview,
  RebalancePreview,
  Boundary,
  Layer,
} from '../../types';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
  onboardingComplete?: boolean;
}

export interface QuestionnaireResponse {
  riskScore: number;
  riskTier: number | string;
  profileName: string;
  riskProfile?: {
    name: string;
    nameFa?: string;
  };
  targetAllocation: TargetLayerPct;
}

export interface PortfolioResponse {
  cashIrr: number;
  holdings: Holding[];
  targetAllocation: TargetLayerPct;
  status: PortfolioStatus;
  // Backend-calculated values (frontend is presentation layer only)
  totalValueIrr: number;
  holdingsValueIrr?: number;
  allocation?: TargetLayerPct;
  driftPct?: number;
  dailyChangePercent: number;
  // Risk profile info (for profile screen)
  riskScore?: number;
  riskProfileName?: string;
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

// Loan preview response - all calculations from backend
export interface LoanPreviewResponse {
  valid: boolean;
  collateralAssetId: string;
  collateralValueIrr: number;
  maxLtv: number;
  maxLoanIrr: number;
  principalIrr: number;
  interestRate: number;
  effectiveAPR: number;
  durationMonths: number;
  totalInterestIrr: number;
  totalRepaymentIrr: number;
  numInstallments: number;
  installmentAmountIrr: number;
  installments: Array<{
    number: number;
    dueDate: string;
    principalIrr: number;
    interestIrr: number;
    totalIrr: number;
  }>;
}

export interface ProtectionsResponse {
  protections: Protection[];
}

export interface ProtectableHoldingsResponse {
  holdings: ProtectableHolding[];
  durationPresets?: number[];
  coverageRange?: { min: number; max: number; step: number };
  minNotionalIrr?: number;
}

export interface ProtectionQuoteRequest {
  assetId: AssetId;
  coveragePct: number;
  durationDays: number;
}

export interface ProtectionQuoteResponse {
  quote: ProtectionQuote;
}

// Backend's actual quote response shape (different from frontend's ProtectionQuote)
export interface BackendQuoteResponse {
  quote: {
    quoteId: string;
    holdingId: string;
    assetId: string;
    coveragePct: number;
    notionalIrr: number;
    notionalUsd: number;
    strikePct: number;
    strikeUsd: number;
    strikeIrr: number;
    durationDays: number;
    spotPriceUsd: number;
    spotPriceIrr: number;
    premiumPct: number;
    premiumIrr: number;
    premiumUsd: number;
    fairValuePct: number;
    executionSpreadPct: number;
    profitMarginPct: number;
    impliedVolatility: number;
    volatilityRegime: string;
    greeks: {
      delta: number;
      gamma: number;
      vega: number;
      theta: number;
      rho: number;
    };
    quotedAt: string;
    validUntil: string;
  };
  breakeven: {
    priceDropPct: number;
    priceDropPctDisplay: string;
    breakEvenUsd: number;
    breakEvenIrr: number;
    description: string;
    descriptionFa: string;
  };
  validity: {
    secondsRemaining: number;
    validUntil: string;
  };
}

export interface PremiumCurveRequest {
  assetId: AssetId;
  coveragePct: number;
}

export interface PremiumCurveResponse {
  assetId: AssetId;
  coveragePct: number;
  curve: PremiumCurvePoint[];
}

export interface ProtectionPurchaseRequest {
  quoteId: string;
  maxPremiumIrr?: number;
}

export interface ProtectionPurchaseResponse {
  success: boolean;
  protection: Protection;
}

export interface VolatilityResponse {
  volatility: AssetVolatility;
}

// Legacy - keep for backwards compatibility
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
  ProtectionQuote,
  ProtectableHolding,
  PremiumCurvePoint,
  AssetVolatility,
  TargetLayerPct,
  ActionLogEntry,
  PortfolioStatus,
  TradePreview,
  RebalancePreview,
  Boundary,
  Layer,
};
