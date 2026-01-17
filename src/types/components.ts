// ============================================================================
// COMPONENT PROPS - Type definitions for React components
// ============================================================================

import type {
  AssetId,
  PortfolioStatus,
  Holding,
  Protection,
  Loan,
} from './domain';

import type {
  PortfolioSnapshot,
  LedgerEntry,
  PendingAction,
  LastAction,
  ActionLogEntry,
} from './state';

// ============================================================================
// COMPONENT PROPS
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

import type { TargetLayerPct } from './domain';
import type { AppState } from './state';

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
