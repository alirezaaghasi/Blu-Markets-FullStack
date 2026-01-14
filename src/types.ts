// ============================================================================
// BLU MARKETS v9.7 - TYPE DEFINITIONS
// ============================================================================
// This file is the SINGLE SOURCE OF TRUTH for all data models.
// All other modules derive from these types.
// Rule: Chat can propose actions, but only the deterministic engine can
//       execute actions and update state.
// ============================================================================

// ============================================================================
// DOMAIN PRIMITIVES
// ============================================================================

/** All supported asset identifiers */
export type AssetId =
  | 'USDT'
  | 'IRR_FIXED_INCOME'
  | 'GOLD'
  | 'BTC'
  | 'ETH'
  | 'QQQ'
  | 'SOL'
  | 'TON';

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
export type RebalanceMode = 'HOLDINGS_ONLY' | 'HOLDINGS_PLUS_CASH';

/** Loan status */
export type LoanStatus = 'ACTIVE' | 'REPAID' | 'LIQUIDATED';

// ============================================================================
// USER PROFILE
// ============================================================================

/** Questionnaire answer record */
export interface QuestionnaireAnswers {
  [questionId: string]: string; // questionId -> optionId
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

/** Single asset holding in portfolio */
export interface Holding {
  assetId: AssetId;
  valueIRR: number;        // Current value in IRR
  frozen: boolean;         // True if locked as loan collateral
  // Derived fields (can be computed but stored for convenience)
  layer?: Layer;           // Asset's layer classification
  units?: number;          // Number of units (for future price tracking)
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
  | 'REBALANCE_COMMIT';

/** Snapshot of portfolio at a point in time */
export interface PortfolioSnapshot {
  totalIRR: number;                          // Holdings + Cash
  holdingsIRR: number;                       // Holdings only
  cashIRR: number;                           // Cash balance
  holdingsIRRByAsset: Record<AssetId, number>;
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
}

/** Immutable ledger entry (audit trail record) */
export interface LedgerEntry {
  id: string;
  tsISO: string;           // ISO timestamp
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

export interface RebalanceMeta {
  hasLockedCollateral: boolean;
  insufficientCash: boolean;
  residualDrift: number;
  trades: RebalanceTrade[];
  cashDeployed: number;
}

// ============================================================================
// PENDING ACTION (Preview State)
// ============================================================================

export interface PendingAction {
  kind: ActionKind;
  payload: ActionPayload;
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

export interface RebalanceDraft {
  mode: RebalanceMode;
}

// ============================================================================
// UI STATE
// ============================================================================

export interface QuestionnaireState {
  index: number;
  answers: QuestionnaireAnswers;
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
  consentStep: number;
  consentMessages: string[];
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
  | { type: 'ADVANCE_CONSENT'; message: string }
  | { type: 'SUBMIT_CONSENT'; text: string }
  | { type: 'SET_INVEST_AMOUNT'; amountIRR: number }
  | { type: 'EXECUTE_PORTFOLIO' }
  // Cancel
  | { type: 'CANCEL_PENDING' }
  // Add Funds
  | { type: 'START_ADD_FUNDS' }
  | { type: 'SET_ADD_FUNDS_AMOUNT'; amountIRR: number }
  | { type: 'PREVIEW_ADD_FUNDS'; payload?: AddFundsPayload }
  // Trade
  | { type: 'START_TRADE'; assetId: AssetId; side?: TradeSide }
  | { type: 'SET_TRADE_SIDE'; side: TradeSide }
  | { type: 'SET_TRADE_AMOUNT'; amountIRR: number }
  | { type: 'PREVIEW_TRADE' }
  // Protect
  | { type: 'START_PROTECT'; assetId?: AssetId }
  | { type: 'SET_PROTECT_ASSET'; assetId: AssetId }
  | { type: 'SET_PROTECT_MONTHS'; months: number }
  | { type: 'PREVIEW_PROTECT' }
  // Borrow
  | { type: 'START_BORROW'; assetId?: AssetId }
  | { type: 'SET_BORROW_ASSET'; assetId: AssetId }
  | { type: 'SET_BORROW_AMOUNT'; amountIRR: number }
  | { type: 'PREVIEW_BORROW' }
  // Repay
  | { type: 'START_REPAY'; loanId?: string }
  | { type: 'PREVIEW_REPAY' }
  // Rebalance
  | { type: 'START_REBALANCE' }
  | { type: 'PREVIEW_REBALANCE' }
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
