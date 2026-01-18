// ============================================================================
// TYPE DEFINITIONS - Central export hub
// ============================================================================
// This file provides backwards compatibility by re-exporting all types
// from their modular locations.
// ============================================================================

// Domain primitives
export type {
  AssetId,
  Layer,
  RiskTier,
  Stage,
  TabId,
  TradeSide,
  ActionKind,
  Boundary,
  PortfolioStatus,
  RebalanceMode,
  StrategyPreset,
  UserProfileType,
  LoanStatus,
  InstallmentStatus,
  LoanInstallment,
  TargetLayerPct,
  LayerWeights,
  TargetAllocation,
  Holding,
  Protection,
  Loan,
  QuestionnaireAnswers,
  UserProfile,
  ErrorCode,
} from './domain';

// State types
export type {
  PortfolioSnapshot,
  ValidationMeta,
  ValidationResult,
  AddFundsPayload,
  TradePayload,
  ProtectPayload,
  BorrowPayload,
  RepayPayload,
  RebalancePayload,
  ActionPayload,
  RebalanceTrade,
  HRAMFactors,
  IntraLayerWeightResult,
  RebalanceMeta,
  LedgerEntryType,
  LedgerEntryDetails,
  LedgerEntry,
  PendingAction,
  TradeDraft,
  ProtectDraft,
  BorrowDraft,
  RepayDraft,
  AddFundsDraft,
  GapAnalysis,
  RebalanceDraft,
  QuestionnaireState,
  ConsentCheckboxState,
  LastAction,
  ActionLogEntry,
  AppState,
} from './state';

// Action types
export type {
  AppAction,
  SliceReducer,
} from './actions';

// Component props
export type {
  DonutChartProps,
  HoldingRowProps,
  ActionLogPaneProps,
  ExecutionSummaryProps,
  PendingActionModalProps,
  HistoryPaneProps,
  PortfolioHealthBadgeProps,
  ComputeSnapshot,
  ComputePortfolioStatus,
  CalcPremiumIRR,
  CalcLiquidationIRR,
} from './components';
