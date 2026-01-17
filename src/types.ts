// ============================================================================
// BLU MARKETS v10 - TYPE DEFINITIONS
// ============================================================================
// This file is the SINGLE SOURCE OF TRUTH for all data models.
// All other modules derive from these types.
// Rule: Chat can propose actions, but only the deterministic engine can
//       execute actions and update state.
// v10: Updated Holding to use quantity-based system
// ============================================================================

// ============================================================================
// DOMAIN PRIMITIVES
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
// USER PROFILE
// ============================================================================

/** Questionnaire answer record */
export interface QuestionnaireAnswers {
  [questionId: string]: string | number; // questionId -> optionId or optionIndex
}

/** User profile from onboarding */
export interface UserProfile {
  phone: string | null;
  questionnaireAnswers: QuestionnaireAnswers;
  riskTier: RiskTier;
}

// ============================================================================
// TARGET ALLOCATION
// ============================================================================

/** Target allocation percentages by layer (must sum to 100) */
export interface TargetLayerPct {
  FOUNDATION: number; // 0-100
  GROWTH: number;     // 0-100
  UPSIDE: number;     // 0-100
}

/** Per-asset weight within a layer (must sum to 1.0 within layer) */
export interface LayerWeights {
  [assetId: string]: number; // 0.0-1.0
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

// ============================================================================
// PORTFOLIO STATE - HOLDINGS
// ============================================================================

/** Single asset holding in portfolio (v10 quantity-based) */
export interface Holding {
  assetId: AssetId;
  quantity: number;        // Number of units held (value computed from quantity × price × fxRate)
  frozen: boolean;         // True if locked as loan collateral
  purchasedAt?: string;    // ISO timestamp for accrual calculations (fixed income)
  // Derived fields (computed on-demand, not stored)
  layer?: Layer;           // Asset's layer classification (from ASSET_LAYER)
}

// ============================================================================
// PORTFOLIO STATE - PROTECTIONS
// ============================================================================

/** Active protection contract (options/insurance) */
export interface Protection {
  id: string;
  assetId: AssetId;
  notionalIRR: number;     // Protected value at time of purchase
  premiumIRR: number;      // Premium paid
  startISO: string;        // Start date (YYYY-MM-DD)
  endISO: string;          // End date (YYYY-MM-DD)
  durationMonths?: number; // Original duration in months
  floorPrice?: number;     // Strike price for protection (mock)
  startTimeMs?: number;    // Pre-computed timestamp for O(1) comparisons
  endTimeMs?: number;      // Pre-computed timestamp for O(1) comparisons
}

// ============================================================================
// PORTFOLIO STATE - LOANS
// ============================================================================

/** Active loan against collateral */
export interface Loan {
  id: string;
  collateralAssetId: AssetId;
  amountIRR: number;       // Current borrowed amount (decreases on repay)
  ltv: number;             // Loan-to-value ratio at origination
  liquidationIRR: number;  // Collateral value at which liquidation triggers
  startISO: string;        // Loan start date
  status?: LoanStatus;     // Current loan status
  repaidIRR?: number;      // Total amount repaid so far
}

// ============================================================================
// AUDIT TRAIL / LEDGER
// ============================================================================

/** Ledger entry types (commit records) */
export type LedgerEntryType =
  | 'PORTFOLIO_CREATED_COMMIT'
  | 'ADD_FUNDS_COMMIT'
  | 'TRADE_COMMIT'
  | 'PROTECT_COMMIT'
  | 'BORROW_COMMIT'
  | 'REPAY_COMMIT'
  | 'REBALANCE_COMMIT'
  | 'PROTECTION_CANCELLED_COMMIT';

/** Snapshot of portfolio at a point in time */
export interface PortfolioSnapshot {
  totalIRR: number;                          // Holdings + Cash
  holdingsIRR: number;                       // Holdings only
  cashIRR: number;                           // Cash balance
  holdingsIRRByAsset: Partial<Record<AssetId, number>>;
  layerPct: TargetLayerPct;                  // Actual percentages
  layerIRR: Record<Layer, number>;           // Actual values by layer
}

/** Details stored with each ledger entry */
export interface LedgerEntryDetails {
  kind?: ActionKind;
  payload?: ActionPayload;
  before?: PortfolioSnapshot;
  after?: PortfolioSnapshot;
  boundary?: Boundary;
  validation?: ValidationResult;
  frictionCopy?: string[];
  // Portfolio creation specific
  amountIRR?: number;
  targetLayerPct?: TargetLayerPct;
  // Rebalance specific
  rebalanceMeta?: RebalanceMeta;
  // Protection cancellation specific
  protectionId?: string;
  assetId?: AssetId;
}

/** Immutable ledger entry (audit trail record) */
export interface LedgerEntry {
  id: string;
  tsISO: string;           // ISO timestamp
  tsDateLabel?: string;    // Pre-computed date label (e.g., "Today", "Jan 17") for O(1) grouping
  type: LedgerEntryType;
  details: LedgerEntryDetails;
}

// ============================================================================
// ACTION PAYLOADS
// ============================================================================

export interface AddFundsPayload {
  amountIRR: number;
}

export interface TradePayload {
  side: TradeSide;
  assetId: AssetId;
  amountIRR: number;
}

export interface ProtectPayload {
  assetId: AssetId;
  months: number;
}

export interface BorrowPayload {
  assetId: AssetId;
  amountIRR: number;
}

export interface RepayPayload {
  loanId: string;
  amountIRR: number;
}

export interface RebalancePayload {
  mode: RebalanceMode;
}

export type ActionPayload =
  | AddFundsPayload
  | TradePayload
  | ProtectPayload
  | BorrowPayload
  | RepayPayload
  | RebalancePayload;

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationMeta {
  required?: number;
  available?: number;
  maxBorrow?: number;
  maxLtv?: number;
  loan?: Loan;
  // Loan cap validation (v10.2.7)
  maxTotalLoans?: number;
  existingLoans?: number;
  remainingCapacity?: number;
  requested?: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  meta?: ValidationMeta;
}

// ============================================================================
// REBALANCE META
// ============================================================================

export interface RebalanceTrade {
  layer: Layer;
  assetId: AssetId;
  amountIRR: number;
  side: TradeSide;
}

/** Factors calculated by the HRAM algorithm */
export interface HRAMFactors {
  volatility: number;
  riskParityWeight: number;
  momentum: number;
  momentumFactor: number;
  avgCorrelation: number;
  correlationFactor: number;
  liquidityFactor: number;
}

/** Intra-layer weight calculation result */
export interface IntraLayerWeightResult {
  weights: Record<string, number>;
  factors: Record<string, HRAMFactors>;
  metadata?: {
    layer: Layer;
    assetCount: number;
    calculatedAt: string;
  };
}

export interface RebalanceMeta {
  hasLockedCollateral: boolean;
  insufficientCash: boolean;
  residualDrift: number;
  trades: RebalanceTrade[];
  cashDeployed: number;
  // Intra-layer balancing info
  intraLayerWeights?: {
    FOUNDATION?: IntraLayerWeightResult;
    GROWTH?: IntraLayerWeightResult;
    UPSIDE?: IntraLayerWeightResult;
  };
  strategy?: StrategyPreset;
}

// ============================================================================
// PENDING ACTION (Preview State)
// ============================================================================

export interface PendingAction {
  kind: ActionKind;
  payload: ActionPayload | Record<string, unknown>;
  before: PortfolioSnapshot;
  after: PortfolioSnapshot;
  validation: ValidationResult;
  boundary: Boundary;
  frictionCopy: string[];
  rebalanceMeta?: RebalanceMeta | null;
}

// ============================================================================
// DRAFT STATE (Form Inputs)
// ============================================================================

export interface TradeDraft {
  assetId: AssetId;
  side: TradeSide;
  amountIRR: number | null;
}

export interface ProtectDraft {
  assetId: AssetId;
  months: number;
}

export interface BorrowDraft {
  assetId: AssetId;
  amountIRR: number | null;
}

export interface RepayDraft {
  loanId: string;
  amountIRR: number;
}

export interface AddFundsDraft {
  amountIRR: number | null;
}

export interface GapAnalysis {
  hasFrozenAssets: boolean;
  remainingGapPct: number;
  currentCash: number;
  cashSufficient: boolean;
  cashNeededForPerfectBalance: number;
  cashShortfall: number;
  cashWouldHelp: boolean;
  partialCashBenefit: number;
}

export interface RebalanceDraft {
  mode: RebalanceMode;
  useCash?: boolean;
  useCashAmount?: number;
  gapAnalysis?: GapAnalysis;
}

// ============================================================================
// UI STATE
// ============================================================================

export interface QuestionnaireState {
  index: number;
  answers: QuestionnaireAnswers;
}

/** Consent checkbox state for Task 2 */
export interface ConsentCheckboxState {
  riskAcknowledged: boolean;
  lossAcknowledged: boolean;
  noGuaranteeAcknowledged: boolean;
}

export interface LastAction {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface ActionLogEntry {
  id: number;
  timestamp: number;
  type: string;
  boundary?: Boundary;
  [key: string]: unknown;
}

// ============================================================================
// COMPLETE APPLICATION STATE
// ============================================================================

export interface AppState {
  // === Core Portfolio State ===
  stage: Stage;
  phone: string | null;
  cashIRR: number;
  holdings: Holding[];
  targetLayerPct: TargetLayerPct;
  protections: Protection[];
  loans: Loan[];
  ledger: LedgerEntry[];           // Audit trail
  pendingAction: PendingAction | null;
  stressMode: boolean;

  // === UI State ===
  questionnaire: QuestionnaireState;
  profileResult: unknown;  // v10: Risk profile result from questionnaire (complex object)
  consentStep: number;
  consentMessages: string[];
  consentCheckboxes: ConsentCheckboxState;  // Task 2: Checkbox consent state
  investAmountIRR: number | null;
  tab: TabId;
  lastAction: LastAction | null;
  showResetConfirm: boolean;
  actionLog: ActionLogEntry[];

  // === Draft State (Form Inputs) ===
  tradeDraft: TradeDraft | null;
  protectDraft: ProtectDraft | null;
  borrowDraft: BorrowDraft | null;
  repayDraft: RepayDraft | null;
  addFundsDraft: AddFundsDraft | null;
  rebalanceDraft: RebalanceDraft | null;
}

// ============================================================================
// REDUCER ACTIONS
// ============================================================================

export type AppAction =
  // Global
  | { type: 'RESET' }
  | { type: 'SHOW_RESET_CONFIRM' }
  | { type: 'HIDE_RESET_CONFIRM' }
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'SET_STRESS_MODE'; payload: { on: boolean } }
  | { type: 'DISMISS_LAST_ACTION' }
  // Onboarding
  | { type: 'START_ONBOARDING' }
  | { type: 'SET_PHONE'; phone: string }
  | { type: 'SUBMIT_PHONE' }
  | { type: 'ANSWER_QUESTION'; qId: string; optionId: string }
  | { type: 'GO_BACK_QUESTION' }  // Task 4: Back button in questionnaire
  | { type: 'ADVANCE_CONSENT'; message: string }
  | { type: 'SUBMIT_CONSENT'; text: string }
  | { type: 'TOGGLE_CONSENT_CHECKBOX'; checkbox: 'risk' | 'loss' | 'noGuarantee' }  // Task 2: Checkbox consent
  | { type: 'SUBMIT_CHECKBOX_CONSENT' }  // Task 2: Submit checkbox consent
  | { type: 'SET_INVEST_AMOUNT'; amountIRR: number | null }
  | { type: 'EXECUTE_PORTFOLIO'; prices?: Record<string, number>; fxRate?: number }
  | { type: 'GO_TO_DASHBOARD' }  // Task 1: Navigate from summary to dashboard
  // Cancel
  | { type: 'CANCEL_PENDING' }
  | { type: 'CANCEL_PROTECTION'; protectionId: string }
  // Add Funds
  | { type: 'START_ADD_FUNDS' }
  | { type: 'SET_ADD_FUNDS_AMOUNT'; amountIRR: string | number }
  | { type: 'PREVIEW_ADD_FUNDS'; payload?: AddFundsPayload }
  // Trade
  | { type: 'START_TRADE'; assetId: AssetId; side?: TradeSide }
  | { type: 'SET_TRADE_SIDE'; side: TradeSide }
  | { type: 'SET_TRADE_AMOUNT'; amountIRR: string | number }
  | { type: 'PREVIEW_TRADE'; prices?: Record<string, number>; fxRate?: number }
  // Protect
  | { type: 'START_PROTECT'; assetId?: AssetId }
  | { type: 'SET_PROTECT_ASSET'; assetId: string }
  | { type: 'SET_PROTECT_MONTHS'; months: number }
  | { type: 'PREVIEW_PROTECT'; prices?: Record<string, number>; fxRate?: number }
  // Borrow
  | { type: 'START_BORROW'; assetId?: AssetId }
  | { type: 'SET_BORROW_ASSET'; assetId: string }
  | { type: 'SET_BORROW_AMOUNT'; amountIRR: string | number }
  | { type: 'PREVIEW_BORROW'; prices?: Record<string, number>; fxRate?: number }
  // Repay
  | { type: 'START_REPAY'; loanId?: string }
  | { type: 'PREVIEW_REPAY' }
  // Rebalance
  | { type: 'START_REBALANCE'; prices?: Record<string, number>; fxRate?: number }
  | { type: 'PREVIEW_REBALANCE'; prices?: Record<string, number>; fxRate?: number }
  | { type: 'SET_REBALANCE_USE_CASH'; useCash: boolean }
  // Confirm
  | { type: 'CONFIRM_PENDING' };

// ============================================================================
// COMPONENT PROPS (for extracted components)
// ============================================================================

export interface DonutChartProps {
  foundation: number;
  growth: number;
  upside: number;
  size?: number;
}

export interface HoldingRowProps {
  holding: Holding;
  snapshot: PortfolioSnapshot;
  protections: Protection[];
  loans: Loan[];
  onBuy: (assetId: AssetId) => void;
  onSell: (assetId: AssetId) => void;
  onProtect: (assetId: AssetId) => void;
  onBorrow: (assetId: AssetId) => void;
}

export interface ActionLogPaneProps {
  actionLog: ActionLogEntry[];
}

export interface ExecutionSummaryProps {
  lastAction: LastAction | null;
  onDismiss: () => void;
}

export interface PendingActionModalProps {
  pendingAction: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface HistoryPaneProps {
  ledger: LedgerEntry[];
}

export interface PortfolioHealthBadgeProps {
  status: PortfolioStatus;
}

// ============================================================================
// HELPER FUNCTION SIGNATURES
// ============================================================================

export type ComputeSnapshot = (state: Pick<AppState, 'holdings' | 'cashIRR'>) => PortfolioSnapshot;

export type ComputePortfolioStatus = (layerPct: TargetLayerPct) => {
  status: PortfolioStatus;
  issues: string[];
};

export type CalcPremiumIRR = (params: {
  assetId: AssetId;
  notionalIRR: number;
  months: number;
}) => number;

export type CalcLiquidationIRR = (params: {
  amountIRR: number;
  ltv: number;
}) => number;

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

// ============================================================================
// REDUCER TYPES
// ============================================================================

/** Slice reducer function signature */
export type SliceReducer = (state: AppState, action: AppAction) => AppState;
