// @ts-check
/**
 * Initial State - Shared state builder
 *
 * Single source of truth for the app's initial state structure.
 * Used by the orchestrator and can be imported for testing.
 */

import { ASSETS } from '../state/domain.js';
import { STAGES } from '../constants/index.js';

/**
 * Build the initial application state
 * @returns {import('../types').AppState}
 */
export function initialState() {
  return {
    // Core state from spec
    stage: STAGES.WELCOME,
    phone: null,
    cashIRR: 0,
    // v10: Holdings store quantities instead of valueIRR
    holdings: ASSETS.map(a => ({
      assetId: a,
      quantity: 0,
      purchasedAt: null,  // Used for IRR_FIXED_INCOME accrual
      frozen: false,
    })),
    targetLayerPct: { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 },
    protections: [],
    loans: [],
    ledger: [],
    pendingAction: null,
    stressMode: false,

    // UI state
    questionnaire: { index: 0, answers: {} },
    profileResult: null,  // v10: Risk profile result from questionnaire
    consentStep: 0,
    consentMessages: [],
    investAmountIRR: null,
    tab: 'PORTFOLIO',
    lastAction: null,
    showResetConfirm: false,
    actionLog: [],

    // Draft state for UI input collection
    tradeDraft: null,
    protectDraft: null,
    borrowDraft: null,
    repayDraft: null,
    addFundsDraft: null,
    rebalanceDraft: null,
  };
}

// Max entries to keep in actionLog to prevent unbounded memory growth
export const MAX_ACTION_LOG_SIZE = 50;

/**
 * Add a log entry to the action log with size capping
 * @param {import('../types').AppState} state
 * @param {string} type
 * @param {Object} data
 * @returns {import('../types').AppState}
 */
export function addLogEntry(state, type, data = {}) {
  const now = Date.now();
  const newLog = [...state.actionLog, { id: now, timestamp: now, type, ...data }];
  // Cap log size to prevent unbounded growth
  const cappedLog = newLog.length > MAX_ACTION_LOG_SIZE
    ? newLog.slice(-MAX_ACTION_LOG_SIZE)
    : newLog;
  return { ...state, actionLog: cappedLog };
}
