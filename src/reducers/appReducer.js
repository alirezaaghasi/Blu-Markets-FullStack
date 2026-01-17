// @ts-check
// ====== BLU MARKETS REDUCER v10 ======
// Orchestrator pattern - delegates to domain slices
// All state transitions go through this single reducer
// Actions flow: PREVIEW_* -> pendingAction -> CONFIRM_PENDING -> ledger

// Import slices
import { UI_ACTIONS, uiReducer } from './slices/uiSlice.js';
import { ONBOARDING_ACTIONS, onboardingReducer, buildInitialHoldings } from './slices/onboardingSlice.js';
import { PORTFOLIO_ACTIONS, portfolioReducer } from './slices/portfolioSlice.js';
import { LEDGER_ACTIONS, ledgerReducer } from './slices/ledgerSlice.js';
import { initialState } from './initialState.js';

// Re-export for backwards compatibility
export { initialState, buildInitialHoldings };

// Build action-to-reducer mapping
const ACTION_MAP = {
  ...Object.fromEntries(UI_ACTIONS.map(a => [a, uiReducer])),
  ...Object.fromEntries(ONBOARDING_ACTIONS.map(a => [a, onboardingReducer])),
  ...Object.fromEntries(PORTFOLIO_ACTIONS.map(a => [a, portfolioReducer])),
  ...Object.fromEntries(LEDGER_ACTIONS.map(a => [a, ledgerReducer])),
};

/**
 * Main reducer - orchestrates domain slices
 * @param {import('../types').AppState} state
 * @param {{ type: string, [key: string]: any }} action
 * @returns {import('../types').AppState}
 */
export function reducer(state, action) {
  const sliceReducer = ACTION_MAP[action.type];
  if (sliceReducer) {
    return sliceReducer(state, action);
  }
  // Unknown action - return state unchanged
  return state;
}
