// ============================================================================
// APPLICATION STATE - All state-related types
// ============================================================================

import type {
  AssetId,
  Stage,
  TabId,
  TradeSide,
  ActionKind,
  Boundary,
  RebalanceMode,
  TargetLayerPct,
  Holding,
  Protection,
  Loan,
  QuestionnaireAnswers,
  Layer,
  StrategyPreset,
} from './domain';

// ============================================================================
// SNAPSHOTS & VALIDATION
// ============================================================================

/** Snapshot of portfolio at a point in time */
export interface PortfolioSnapshot {
  totalIRR: number;
  holdingsIRR: number;
  cashIRR: number;
  holdingsIRRByAsset: Partial<Record<AssetId, number>>;
  layerPct: TargetLayerPct;
  layerIRR: Record<Layer, number>;
}

export interface ValidationMeta {
  required?: number;
  available?: number;
  maxBorrow?: number;
  maxLtv?: number;
  loan?: Loan;
  maxTotalLoans?: number;
  existingLoans?: number;
  remainingCapacity?: number;
  requested?: number;
  notionalIRR?: number;
  holdingValueIRR?: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  meta?: ValidationMeta;
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
// REBALANCE META
// ============================================================================

export interface RebalanceTrade {
  layer: Layer;
  assetId: AssetId;
  amountIRR: number;
  side: TradeSide;
}

export interface HRAMFactors {
  volatility: number;
  riskParityWeight: number;
  momentum: number;
  momentumFactor: number;
  avgCorrelation: number;
  correlationFactor: number;
  liquidityFactor: number;
}

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
  intraLayerWeights?: {
    FOUNDATION?: IntraLayerWeightResult;
    GROWTH?: IntraLayerWeightResult;
    UPSIDE?: IntraLayerWeightResult;
  };
  strategy?: StrategyPreset;
}

// ============================================================================
// LEDGER / AUDIT TRAIL
// ============================================================================

export type LedgerEntryType =
  | 'PORTFOLIO_CREATED_COMMIT'
  | 'ADD_FUNDS_COMMIT'
  | 'TRADE_COMMIT'
  | 'PROTECT_COMMIT'
  | 'BORROW_COMMIT'
  | 'REPAY_COMMIT'
  | 'REBALANCE_COMMIT'
  | 'PROTECTION_CANCELLED_COMMIT';

export interface LedgerEntryDetails {
  kind?: ActionKind;
  payload?: ActionPayload;
  before?: PortfolioSnapshot;
  after?: PortfolioSnapshot;
  boundary?: Boundary;
  validation?: ValidationResult;
  frictionCopy?: string[];
  amountIRR?: number;
  targetLayerPct?: TargetLayerPct;
  rebalanceMeta?: RebalanceMeta;
  protectionId?: string;
  assetId?: AssetId;
}

export interface LedgerEntry {
  id: string;
  tsISO: string;
  tsDateLabel?: string;
  type: LedgerEntryType;
  details: LedgerEntryDetails;
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
  // Core Portfolio State
  stage: Stage;
  phone: string | null;
  cashIRR: number;
  holdings: Holding[];
  targetLayerPct: TargetLayerPct;
  protections: Protection[];
  loans: Loan[];
  ledger: LedgerEntry[];
  pendingAction: PendingAction | null;
  stressMode: boolean;

  // UI State
  questionnaire: QuestionnaireState;
  profileResult: unknown;
  consentStep: number;
  consentMessages: string[];
  consentCheckboxes: ConsentCheckboxState;
  investAmountIRR: number | null;
  tab: TabId;
  lastAction: LastAction | null;
  showResetConfirm: boolean;
  actionLog: ActionLogEntry[];

  // Draft State (Form Inputs)
  tradeDraft: TradeDraft | null;
  protectDraft: ProtectDraft | null;
  borrowDraft: BorrowDraft | null;
  repayDraft: RepayDraft | null;
  addFundsDraft: AddFundsDraft | null;
  rebalanceDraft: RebalanceDraft | null;
}
