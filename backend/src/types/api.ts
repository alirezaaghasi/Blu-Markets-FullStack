import type { AssetId, Boundary, Layer, TargetAllocation, TradeAction } from './domain.js';

// ============================================================================
// AUTH
// ============================================================================

export interface SendOtpRequest {
  phone: string; // +989XXXXXXXXX
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  expiresIn: number;
}

export interface VerifyOtpRequest {
  phone: string;
  code: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface VerifyOtpResponse {
  success: boolean;
  tokens: AuthTokens;
  isNewUser: boolean;
  onboardingComplete: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ============================================================================
// ONBOARDING
// ============================================================================

export interface QuestionnaireAnswer {
  questionId: string;
  answerId: string;
  value: number;
}

export interface SubmitQuestionnaireRequest {
  answers: QuestionnaireAnswer[];
}

export interface SubmitQuestionnaireResponse {
  riskScore: number;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
  profileName: string;
  targetAllocation: TargetAllocation;
}

export interface RecordConsentRequest {
  consentRisk: boolean;
  consentLoss: boolean;
  consentNoGuarantee: boolean;
}

export interface InitialFundingRequest {
  amountIrr: number;
}

// ============================================================================
// PORTFOLIO
// ============================================================================

export interface PortfolioSummary {
  id: string;
  cashIrr: number;
  totalValueIrr: number;
  holdingsValueIrr: number;
  allocation: TargetAllocation;
  targetAllocation: TargetAllocation;
  status: 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';
  driftPct: number;
  holdingsCount: number;
  activeLoansCount: number;
  activeProtectionsCount: number;
  holdings: HoldingResponse[];
}

export interface HoldingResponse {
  assetId: AssetId;
  name: string;
  quantity: number;
  layer: Layer;
  frozen: boolean;
  valueIrr: number;
  valueUsd: number;
  priceUsd: number;
  priceIrr: number;
  change24hPct?: number;
  pctOfPortfolio: number;
}

export interface AddFundsRequest {
  amountIrr: number;
}

// ============================================================================
// TRADE
// ============================================================================

export interface TradePreviewRequest {
  action: TradeAction;
  assetId: AssetId;
  amountIrr: number;
}

export interface TradePreviewResponse {
  valid: boolean;
  preview: {
    action: TradeAction;
    assetId: AssetId;
    quantity: number;
    amountIrr: number;
    priceIrr: number;
    spread: number;
    spreadAmountIrr: number;
  };
  allocation: {
    before: TargetAllocation;
    target: TargetAllocation;
    after: TargetAllocation;
  };
  boundary: Boundary;
  frictionCopy?: string;
  movesToward: boolean;
  error?: string;
}

export interface TradeExecuteRequest {
  action: TradeAction;
  assetId: AssetId;
  amountIrr: number;
  acknowledgedWarning?: boolean;
}

export interface TradeExecuteResponse {
  success: boolean;
  trade: {
    action: TradeAction;
    assetId: AssetId;
    quantity: number;
    amountIrr: number;
    priceIrr: number;
  };
  newBalance: {
    cashIrr: number;
    holdingQuantity: number;
  };
  boundary: Boundary;
  ledgerEntryId: string;
}

// ============================================================================
// REBALANCE
// ============================================================================

export type RebalanceMode = 'HOLDINGS_ONLY' | 'HOLDINGS_PLUS_CASH' | 'SMART';

export interface RebalancePreviewRequest {
  mode?: RebalanceMode;
}

export interface RebalanceTrade {
  side: 'BUY' | 'SELL';
  assetId: string;
  amountIrr: number;
  layer: string;
}

export interface GapAnalysis {
  layer: string;
  current: number;
  target: number;
  gap: number;
  gapIrr: number;
  sellableIrr?: number;
  frozenIrr?: number;
}

export interface RebalancePreviewResponse {
  trades: RebalanceTrade[];
  currentAllocation: TargetAllocation;
  targetAllocation: TargetAllocation;
  afterAllocation: TargetAllocation;
  totalBuyIrr: number;
  totalSellIrr: number;
  canFullyRebalance: boolean;
  residualDrift?: number;
  hasLockedCollateral?: boolean;
  gapAnalysis: GapAnalysis[];
}

export interface RebalanceExecuteRequest {
  mode?: RebalanceMode;
  acknowledgedWarning?: boolean;
}

export interface RebalanceExecuteResponse {
  success: boolean;
  tradesExecuted: number;
  newAllocation: TargetAllocation;
  ledgerEntryId: string;
  boundary: Boundary;
}

// ============================================================================
// LOANS
// ============================================================================

export interface LoanCapacityResponse {
  maxPortfolioLoanIrr: number;
  currentLoansIrr: number;
  availableIrr: number;
  perAsset: {
    assetId: AssetId;
    layer: Layer;
    maxLtv: number;
    holdingValueIrr: number;
    maxLoanIrr: number;
    existingLoanIrr: number;
    availableLoanIrr: number;
    frozen: boolean;
  }[];
}

export interface CreateLoanRequest {
  collateralAssetId: AssetId;
  amountIrr: number;
  durationMonths: 3 | 6;
}

export interface LoanResponse {
  id: string;
  collateralAssetId: AssetId;
  collateralQuantity: number;
  collateralValueIrr: number;
  principalIrr: number;
  interestRate: number;
  totalInterestIrr: number;
  totalDueIrr: number;
  durationMonths: number;
  startDate: string;
  dueDate: string;
  installments: {
    number: number;
    dueDate: string;
    totalIrr: number;
    paidIrr: number;
    status: 'PENDING' | 'PARTIAL' | 'PAID';
  }[];
  paidIrr: number;
  remainingIrr: number;
  ltv: number;
  status: 'ACTIVE' | 'REPAID' | 'LIQUIDATED';
}

export interface RepayLoanRequest {
  amountIrr: number;
}

export interface RepayLoanResponse {
  success: boolean;
  amountApplied: number;
  remainingDue: number;
  installmentsPaid: number;
  isFullySettled: boolean;
  collateralUnfrozen: boolean;
}

// ============================================================================
// PROTECTION
// ============================================================================

export interface ProtectionEligibleAsset {
  assetId: AssetId;
  layer: Layer;
  holdingValueIrr: number;
  monthlyRate: number;
  alreadyProtected: boolean;
}

export interface CreateProtectionRequest {
  assetId: AssetId;
  notionalIrr: number;
  durationMonths: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface ProtectionResponse {
  id: string;
  assetId: AssetId;
  notionalIrr: number;
  premiumIrr: number;
  durationMonths: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  daysRemaining?: number;
}

// ============================================================================
// HISTORY / ACTIVITY
// ============================================================================

export interface HistoryQuery {
  page?: number;
  limit?: number;
  type?: string;
  from?: string;
  to?: string;
}

export interface HistoryEntryResponse {
  id: string;
  entryType: string;
  assetId?: AssetId;
  quantity?: number;
  amountIrr?: number;
  boundary?: Boundary;
  message: string;
  createdAt: string;
  beforeSnapshot?: {
    cashIrr: number;
    totalValueIrr: number;
    allocation: TargetAllocation;
  };
  afterSnapshot?: {
    cashIrr: number;
    totalValueIrr: number;
    allocation: TargetAllocation;
  };
}

export interface ActivityLogEntry {
  id: string;
  actionType: string;
  boundary?: Boundary;
  message: string;
  amountIrr?: number;
  assetId?: AssetId;
  createdAt: string;
}

// ============================================================================
// PRICES
// ============================================================================

export interface PriceResponse {
  assetId: AssetId;
  priceUsd: number;
  priceIrr: number;
  change24hPct?: number;
  source: string;
  fetchedAt: string;
}

export interface AllPricesResponse {
  prices: PriceResponse[];
  fxRate: {
    usdIrr: number;
    source: string;
    fetchedAt: string;
  };
  status: 'live' | 'stale' | 'offline';
}

// ============================================================================
// ERRORS
// ============================================================================

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'NOT_IMPLEMENTED'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'SERVICE_UNAVAILABLE'
  | 'INSUFFICIENT_CASH'
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_HOLDINGS'
  | 'ASSET_FROZEN'
  | 'EXCEEDS_PORTFOLIO_LOAN_LIMIT'
  | 'EXCEEDS_PORTFOLIO_LIMIT'
  | 'EXCEEDS_ASSET_LTV'
  | 'PROTECTION_EXISTS'
  | 'PROTECTION_NOT_ELIGIBLE'
  | 'QUOTE_NOT_FOUND'
  | 'QUOTE_EXPIRED'
  | 'QUOTE_IN_USE'
  | 'REBALANCE_TOO_SOON'
  | 'REBALANCE_COOLDOWN'
  | 'NO_REBALANCE_NEEDED'
  | 'NO_TRADES'
  | 'ACKNOWLEDGMENT_REQUIRED'
  | 'RATE_LIMITED'
  | 'OTP_EXPIRED'
  | 'OTP_INVALID'
  | 'OTP_MAX_ATTEMPTS';
