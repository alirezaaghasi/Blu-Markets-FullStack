// Blu Markets Mobile App Types
// Based on PRD Section 11 - Data Models

// Asset and Layer Types
export type Layer = 'FOUNDATION' | 'GROWTH' | 'UPSIDE';

export type AssetId =
  // Foundation
  | 'USDT'
  | 'PAXG'
  | 'IRR_FIXED_INCOME'
  // Growth
  | 'BTC'
  | 'ETH'
  | 'BNB'
  | 'XRP'
  | 'KAG'
  | 'QQQ'
  // Upside
  | 'SOL'
  | 'TON'
  | 'LINK'
  | 'AVAX'
  | 'MATIC'
  | 'ARB';

export type Boundary = 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';

export type ActionType =
  | 'PORTFOLIO_CREATED'
  | 'ADD_FUNDS'
  | 'TRADE'
  | 'REBALANCE'
  | 'PROTECT'
  | 'CANCEL_PROTECTION'
  | 'BORROW'
  | 'REPAY';

export type TabId = 'PORTFOLIO' | 'PROTECTION' | 'LOANS' | 'HISTORY' | 'PROFILE';

export type PortfolioStatus = 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';

export type LoanStatus = 'ACTIVE' | 'REPAID' | 'LIQUIDATED';

// BUG-020 FIX: Proper type for backend-provided loan health status
export type LoanHealthStatus = 'HEALTHY' | 'CAUTION' | 'WARNING' | 'CRITICAL';

export type InstallmentStatus = 'PENDING' | 'PARTIAL' | 'PAID';

// Onboarding Types
export type OnboardingStep =
  | 'WELCOME'
  | 'PHONE_INPUT'
  | 'OTP_VERIFY'
  | 'QUESTIONNAIRE'
  | 'PROFILE_RESULT'
  | 'CONSENT'
  | 'INITIAL_FUNDING'
  | 'SUCCESS';

export interface QuestionnaireAnswer {
  questionId: string;
  optionIndex: number;
  score: number;
  weight: number;
}

export interface RiskProfile {
  score: number;
  profileName: string;
  profileNameFarsi: string;
  targetAllocation: TargetLayerPct;
}

// Portfolio Types
export interface Holding {
  id?: string; // Database ID for API calls (protection, loans)
  assetId: AssetId;
  quantity: number;
  frozen: boolean;
  layer: Layer;
  purchasedAt?: string; // ISO string for fixed income accrual
  // Backend-derived valuation fields (frontend should NOT recompute these)
  valueIrr?: number; // Backend-calculated holding value in IRR
  valueUsd?: number; // Backend-calculated holding value in USD
  priceIrr?: number; // Current asset price in IRR
  priceUsd?: number; // Current asset price in USD
  // Fixed income breakdown (backend-calculated)
  fixedIncome?: {
    principal: number;
    accruedInterest: number;
    total: number;
    daysHeld: number;
    dailyRate: number;
  };
}

export interface TargetLayerPct {
  FOUNDATION: number;
  GROWTH: number;
  UPSIDE: number;
}

export type ProtectionStatus = 'ACTIVE' | 'EXPIRED' | 'EXERCISED' | 'CANCELLED';

export interface Protection {
  id: string;
  assetId: AssetId;
  notionalIrr: number;
  notionalUsd: number;
  premiumIrr: number;
  premiumUsd: number;
  coveragePct: number;
  durationDays: number;
  strikeUsd: number;
  startDate: string;
  expiryDate: string;
  status: ProtectionStatus;
  // Optional settlement info (for exercised protections)
  settlementIrr?: number;
  settlementUsd?: number;
  settlementDate?: string;
  // Backend-derived fields (frontend should display these, NOT recompute)
  daysRemaining?: number; // Days until protection expires
  progressPct?: number; // Time elapsed progress (0-100)
  currentValueUsd?: number; // Current protected asset value
  // Aliases for API compatibility (backend may return different field names)
  startISO?: string; // Alias for startDate
  endISO?: string; // Alias for expiryDate
  notionalIRR?: number; // Alias for notionalIrr
  premiumIRR?: number; // Alias for premiumIrr
}

// Protection Quote (from /protection/quote endpoint)
export interface ProtectionQuote {
  quoteId: string;
  assetId: AssetId;
  holdingValueIrr: number;
  holdingValueUsd: number;
  coveragePct: number;
  notionalIrr: number;
  notionalUsd: number;
  durationDays: number;
  strikeUsd: number;
  strikePct: number;
  premiumIrr: number;
  premiumUsd: number;
  premiumPct: number;
  annualizedPct: number;
  breakeven: {
    priceDrop: number;
    priceUsd: number;
  };
  greeks: {
    delta: number;
    gamma: number;
    vega: number;
    theta: number;
  };
  volatility: {
    iv: number;
    regime: string;
  };
  expiresAt: string;
  validForSeconds: number;
}

// Protectable holding (from /protection/holdings endpoint)
export interface ProtectableHolding {
  holdingId: string;
  assetId: AssetId;
  name: string;
  layer: Layer;
  quantity: number;
  valueIrr: number;
  valueUsd: number;
  priceUsd: number;
  priceIrr: number;
  isProtectable: boolean;
  hasExistingProtection: boolean;
  volatility: {
    iv: number;
    regime: string;
    regimeColor: string;
  };
  indicativePremium: {
    thirtyDayPct: number;
    thirtyDayIrr: number;
  };
}

// Premium curve point (from /protection/quote/curve endpoint)
export interface PremiumCurvePoint {
  durationDays: number;
  premiumIrr: number;
  premiumPct: number;
  annualizedPct: number;
}

// Volatility info (from /protection/volatility/:assetId endpoint)
export interface AssetVolatility {
  assetId: AssetId;
  baseVolatility: number;
  adjustedVolatility: number;
  regime: string;
  regimeDescription: string;
  regimeColor: string;
  termStructure: Array<{
    durationDays: number;
    multiplier: number;
    adjustedIv: number;
  }>;
}

export interface LoanInstallment {
  number: number;
  dueISO: string;
  principalIRR: number;
  interestIRR: number;
  totalIRR: number;
  paidIRR: number;
  status: InstallmentStatus;
}

export interface Loan {
  id: string;
  collateralAssetId: AssetId;
  collateralQuantity: number;
  amountIRR: number;
  dailyInterestRate: number; // Daily interest rate (0.30/365 ≈ 0.000822 for 30% APR)
  interestRate?: number; // Annual interest rate for display (0.30 = 30%)
  durationDays: 90 | 180; // 3 or 6 months per PRD
  startISO: string;
  dueISO: string;
  status: LoanStatus;
  totalInterestIRR?: number; // Pre-calculated total interest
  totalRepaymentIRR?: number; // Principal + interest
  totalDueIRR?: number; // Total amount due (principal + interest)
  paidIRR?: number; // Amount already paid
  installments: LoanInstallment[];
  installmentsPaid: number;
  // Backend-derived fields (frontend should display these, NOT recompute)
  healthStatus?: LoanHealthStatus; // Backend-calculated health status
  remainingIrr?: number; // Remaining balance to repay
  currentLtv?: number; // Current loan-to-value ratio
  progressPct?: number; // Repayment progress (0-100)
  daysUntilDue?: number; // Days until loan is due
  collateralValueIrr?: number; // Current collateral value in IRR
  settledAt?: string; // ISO date when loan was fully repaid (only for REPAID loans)
}

// Activity Feed Types
export interface ActionLogEntry {
  id: number;
  timestamp: string;
  type: ActionType;
  boundary: Boundary;
  amountIRR?: number;
  assetId?: AssetId;
  message: string;
}

export interface LedgerEntry {
  id: string;
  tsISO: string;
  tsDateLabel: string;
  type: string;
  details: {
    kind: ActionType;
    payload: Record<string, unknown>;
    before: PortfolioSnapshot;
    after: PortfolioSnapshot;
    boundary: Boundary;
    frictionCopy: string[];
  };
}

export interface PortfolioSnapshot {
  cashIRR: number;
  holdings: Holding[];
  layerPercentages: TargetLayerPct;
  totalValueIRR: number;
}

// App State Types
export interface AuthState {
  phone: string | null;
  authToken: string | null;
  isAuthenticated: boolean;
}

export interface OnboardingState {
  step: OnboardingStep;
  phone: string;
  answers: Record<string, number>;
  riskProfile: RiskProfile | null;
  consents: {
    riskAcknowledged: boolean;
    lossAcknowledged: boolean;
    noGuaranteeAcknowledged: boolean;
  };
  initialInvestment: number;
}

export interface PortfolioState {
  cashIRR: number;
  holdings: Holding[];
  targetLayerPct: TargetLayerPct;
  protections: Protection[];
  loans: Loan[];
  actionLog: ActionLogEntry[];
  ledger: LedgerEntry[];
  status: PortfolioStatus;
  lastSyncTimestamp: number;
  // Risk profile from onboarding (stored for profile screen)
  riskScore: number;
  riskProfileName: string;
  // Backend-calculated values (frontend is presentation layer only)
  totalValueIrr: number;
  holdingsValueIrr: number;
  currentAllocation: TargetLayerPct;
  driftPct: number;
}

export interface PriceState {
  prices: Record<AssetId, number>; // USD prices
  pricesIrr?: Record<AssetId, number>; // Direct IRR prices from backend
  fxRate: number; // IRR per USD
  fxSource: 'bonbast' | 'fallback';
  updatedAt: string;
  isLoading: boolean;
  error: string | null;
}

export interface UIState {
  currentTab: TabId;
  isLoading: boolean;
  pendingAction: {
    type: ActionType;
    payload: Record<string, unknown>;
  } | null;
}

export interface MobileAppState {
  auth: AuthState;
  onboarding: OnboardingState;
  portfolio: PortfolioState;
  prices: PriceState;
  ui: UIState;
}

// Asset Configuration
export interface AssetConfig {
  id: AssetId;
  name: string;
  symbol: string;
  layer: Layer;
  volatility: number;
  layerWeight: number;
  liquidity: number;
  protectionEligible: boolean;
  ltv: number;
  coinGeckoId?: string;
}

// Trade Types
export interface TradePreview {
  side: 'BUY' | 'SELL';
  assetId: AssetId;
  amountIRR: number;
  quantity: number;
  priceUSD: number;
  spread: number;
  before: TargetLayerPct;
  after: TargetLayerPct;
  target: TargetLayerPct;
  boundary: Boundary;
  frictionCopy: string[];
  movesTowardTarget: boolean;
}

// Rebalance Types
export type RebalanceMode = 'HOLDINGS_ONLY' | 'HOLDINGS_PLUS_CASH' | 'SMART';

export interface RebalanceTrade {
  side: 'BUY' | 'SELL';
  assetId: AssetId;
  amountIRR: number;
  layer: Layer;
  quantity?: number;
}

export interface RebalancePreview {
  mode: RebalanceMode;
  before: TargetLayerPct;
  after: TargetLayerPct;
  target: TargetLayerPct;
  trades: RebalanceTrade[];
  cashDeployed: number;
  residualDrift: number;
  hasLockedCollateral: boolean;
  insufficientCash: boolean;
}

// Validation Types
export interface ValidationResult {
  ok: boolean;
  errors: string[];
  meta?: {
    required?: number;
    available?: number;
    maxBorrow?: number;
    maxLtv?: number;
    maxTotalLoans?: number;
    existingLoans?: number;
    remainingCapacity?: number;
    notionalIRR?: number;
    holdingValueIRR?: number;
  };
}
