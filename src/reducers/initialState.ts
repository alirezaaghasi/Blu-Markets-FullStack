/**
 * Initial State - Shared state builder
 *
 * Single source of truth for the app's initial state structure.
 * Used by the orchestrator and can be imported for testing.
 */

import type { AppState, Holding } from '../types';
import { ASSETS } from '../state/domain';
import { STAGES } from '../constants/index';

/**
 * Build the initial application state
 */
export function initialState(): AppState {
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
    } as Holding)),
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

interface LogEntry {
  id: number;
  timestamp: number;
  type: string;
  [key: string]: unknown;
}

/**
 * Add a log entry to the action log with size capping
 */
export function addLogEntry(state: AppState, type: string, data: Record<string, unknown> = {}): AppState {
  const now = Date.now();
  const newLog: LogEntry[] = [...state.actionLog, { id: now, timestamp: now, type, ...data }];
  // Cap log size to prevent unbounded growth
  const cappedLog = newLog.length > MAX_ACTION_LOG_SIZE
    ? newLog.slice(-MAX_ACTION_LOG_SIZE)
    : newLog;
  return { ...state, actionLog: cappedLog };
}
