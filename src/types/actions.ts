// ============================================================================
// REDUCER ACTIONS - All action types for state management
// ============================================================================

import type {
  AssetId,
  TabId,
  TradeSide,
} from './domain';

import type {
  AppState,
  AddFundsPayload,
} from './state';

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
  | { type: 'GO_BACK_QUESTION' }
  | { type: 'ADVANCE_CONSENT'; message: string }
  | { type: 'SUBMIT_CONSENT'; text: string }
  | { type: 'TOGGLE_CONSENT_CHECKBOX'; checkbox: 'risk' | 'loss' | 'noGuarantee' }
  | { type: 'SUBMIT_CHECKBOX_CONSENT' }
  | { type: 'SET_INVEST_AMOUNT'; amountIRR: number | null }
  | { type: 'EXECUTE_PORTFOLIO'; prices?: Record<string, number>; fxRate?: number }
  | { type: 'GO_TO_DASHBOARD' }
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
  | { type: 'SET_BORROW_DURATION'; durationMonths: 3 | 6 }
  | { type: 'PREVIEW_BORROW'; prices?: Record<string, number>; fxRate?: number }
  // Repay
  | { type: 'START_REPAY'; loanId?: string }
  | { type: 'SET_REPAY_AMOUNT'; amountIRR: number }
  | { type: 'PREVIEW_REPAY' }
  // Rebalance
  | { type: 'START_REBALANCE'; prices?: Record<string, number>; fxRate?: number }
  | { type: 'PREVIEW_REBALANCE'; prices?: Record<string, number>; fxRate?: number }
  | { type: 'SET_REBALANCE_USE_CASH'; useCash: boolean }
  // Confirm
  | { type: 'CONFIRM_PENDING' };

// ============================================================================
// REDUCER TYPES
// ============================================================================

/** Slice reducer function signature */
export type SliceReducer = (state: AppState, action: AppAction) => AppState;
