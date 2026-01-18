// ============================================================================
// DOMAIN PRIMITIVES - Core business entities
// ============================================================================

/** All supported asset identifiers (15-asset universe) */
export type AssetId =
  // Foundation (3)
  | 'USDT'
  | 'PAXG'
  | 'IRR_FIXED_INCOME'
  // Growth (6)
  | 'BTC'
  | 'ETH'
  | 'BNB'
  | 'XRP'
  | 'KAG'
  | 'QQQ'
  // Upside (6)
  | 'SOL'
  | 'TON'
  | 'LINK'
  | 'AVAX'
  | 'MATIC'
  | 'ARB';

/** Portfolio layer classification (risk tiers) */
export type Layer = 'FOUNDATION' | 'GROWTH' | 'UPSIDE';

/** Risk profile derived from questionnaire */
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

/** Application lifecycle stages */
export type Stage =
  | 'WELCOME'
  | 'ONBOARDING_PHONE'
  | 'ONBOARDING_QUESTIONNAIRE'
  | 'ONBOARDING_RESULT'
  | 'AMOUNT_REQUIRED'
  | 'PORTFOLIO_CREATED'
  | 'ACTIVE';

/** Active tab in the main UI */
export type TabId = 'PORTFOLIO' | 'PROTECTION' | 'LOANS' | 'HISTORY';

/** Trade direction */
export type TradeSide = 'BUY' | 'SELL';

/** Action kinds for operations */
export type ActionKind =
  | 'ADD_FUNDS'
  | 'TRADE'
  | 'PROTECT'
  | 'BORROW'
  | 'REPAY'
  | 'REBALANCE';

/** Boundary classification for action risk */
export type Boundary = 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';

/** Portfolio health status */
export type PortfolioStatus = 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';

/** Rebalance execution mode */
export type RebalanceMode = 'HOLDINGS_ONLY' | 'HOLDINGS_PLUS_CASH' | 'SMART';

/** Intra-layer balancing strategy presets */
export type StrategyPreset =
  | 'EQUAL_WEIGHT'
  | 'RISK_PARITY'
  | 'MOMENTUM_TILT'
  | 'MAX_DIVERSIFICATION'
  | 'BALANCED'
  | 'CONSERVATIVE'
  | 'AGGRESSIVE';

/** User profile type for strategy mapping */
export type UserProfileType =
  | 'ANXIOUS_NOVICE'
  | 'STEADY_BUILDER'
  | 'AGGRESSIVE_ACCUMULATOR'
  | 'WEALTH_PRESERVER'
  | 'SPECULATOR';

/** Loan status */
export type LoanStatus = 'ACTIVE' | 'REPAID' | 'LIQUIDATED';

// ============================================================================
// PORTFOLIO ENTITIES
// ============================================================================

/** Target allocation percentages by layer (must sum to 100) */
export interface TargetLayerPct {
  FOUNDATION: number;
  GROWTH: number;
  UPSIDE: number;
}

/** Per-asset weight within a layer (must sum to 1.0 within layer) */
export interface LayerWeights {
  [assetId: string]: number;
}

/** Complete target allocation specification */
export interface TargetAllocation {
  layerPct: TargetLayerPct;
  weights: {
    FOUNDATION: LayerWeights;
    GROWTH: LayerWeights;
    UPSIDE: LayerWeights;
  };
}

/** Single asset holding in portfolio (v10 quantity-based) */
export interface Holding {
  assetId: AssetId;
  quantity: number;
  frozen: boolean;
  purchasedAt?: string;
  layer?: Layer;
}

/** Active protection contract (options/insurance) */
export interface Protection {
  id: string;
  assetId: AssetId;
  notionalIRR: number;
  premiumIRR: number;
  startISO: string;
  endISO: string;
  durationMonths?: number;
  floorPrice?: number;
  startTimeMs?: number;
  endTimeMs?: number;
}

/** Active loan against collateral */
export interface Loan {
  id: string;
  collateralAssetId: AssetId;
  collateralQuantity?: number;
  amountIRR: number;
  ltv: number;
  interestRate?: number;
  liquidationIRR: number;
  startISO: string;
  dueISO?: string;
  durationMonths: 3 | 6;
  status?: LoanStatus;
  repaidIRR?: number;
  accruedInterestIRR?: number;
}

// ============================================================================
// USER PROFILE
// ============================================================================

/** Questionnaire answer record */
export interface QuestionnaireAnswers {
  [questionId: string]: string | number;
}

/** User profile from onboarding */
export interface UserProfile {
  phone: string | null;
  questionnaireAnswers: QuestionnaireAnswers;
  riskTier: RiskTier;
}

// ============================================================================
// ERROR CODES
// ============================================================================

export type ErrorCode =
  | 'INVALID_AMOUNT'
  | 'INVALID_ASSET'
  | 'INSUFFICIENT_CASH'
  | 'INVALID_SIDE'
  | 'INSUFFICIENT_ASSET_VALUE'
  | 'ASSET_FROZEN'
  | 'INVALID_MONTHS'
  | 'NO_NOTIONAL'
  | 'ASSET_ALREADY_PROTECTED'
  | 'INSUFFICIENT_CASH_FOR_PREMIUM'
  | 'ASSET_NOT_ELIGIBLE_FOR_PROTECTION'
  | 'ASSET_ALREADY_FROZEN'
  | 'EXCEEDS_MAX_BORROW'
  | 'NO_ACTIVE_LOAN'
  | 'NO_CASH'
  | 'INVALID_MODE';
