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
  assetId: AssetId;
  quantity: number;
  frozen: boolean;
  layer: Layer;
  purchasedAt?: string; // ISO string for fixed income accrual
}

export interface TargetLayerPct {
  FOUNDATION: number;
  GROWTH: number;
  UPSIDE: number;
}

export interface Protection {
  id: string;
  assetId: AssetId;
  notionalIRR: number;
  premiumIRR: number;
  startISO: string;
  endISO: string;
  durationMonths: number;
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
  interestRate: number;
  durationMonths: 3 | 6;
  startISO: string;
  dueISO: string;
  status: LoanStatus;
  installments: LoanInstallment[];
  installmentsPaid: number;
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
}

export interface PriceState {
  prices: Record<AssetId, number>; // USD prices
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
