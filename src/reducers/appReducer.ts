// ====== BLU MARKETS REDUCER v10 ======
// Orchestrator pattern - delegates to domain slices
// All state transitions go through this single reducer
// Actions flow: PREVIEW_* -> pendingAction -> CONFIRM_PENDING -> ledger

import type { AppState, AppAction, SliceReducer } from '../types';

// Import slices
import { UI_ACTIONS, uiReducer } from './slices/uiSlice';
import { ONBOARDING_ACTIONS, onboardingReducer, buildInitialHoldings } from './slices/onboardingSlice';
import { PORTFOLIO_ACTIONS, portfolioReducer } from './slices/portfolioSlice';
import { LEDGER_ACTIONS, ledgerReducer } from './slices/ledgerSlice';
import { initialState } from './initialState';

// Re-export for backwards compatibility
export { initialState, buildInitialHoldings };

// Build action-to-reducer mapping
const ACTION_MAP: Record<string, SliceReducer> = {
  ...Object.fromEntries(UI_ACTIONS.map(a => [a, uiReducer])),
  ...Object.fromEntries(ONBOARDING_ACTIONS.map(a => [a, onboardingReducer])),
  ...Object.fromEntries(PORTFOLIO_ACTIONS.map(a => [a, portfolioReducer])),
  ...Object.fromEntries(LEDGER_ACTIONS.map(a => [a, ledgerReducer])),
};

/**
 * Main reducer - orchestrates domain slices
 */
export function reducer(state: AppState, action: AppAction): AppState {
  const sliceReducer = ACTION_MAP[action.type];
  if (sliceReducer) {
    return sliceReducer(state, action);
  }
  // Unknown action - return state unchanged
  return state;
}
