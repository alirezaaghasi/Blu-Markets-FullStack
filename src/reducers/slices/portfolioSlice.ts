/**
 * Portfolio Slice - Handles portfolio action state transitions
 *
 * Actions handled:
 * - START_ADD_FUNDS, SET_ADD_FUNDS_AMOUNT, PREVIEW_ADD_FUNDS
 * - START_TRADE, SET_TRADE_SIDE, SET_TRADE_AMOUNT, PREVIEW_TRADE
 * - START_PROTECT, SET_PROTECT_ASSET, SET_PROTECT_MONTHS, PREVIEW_PROTECT
 * - START_BORROW, SET_BORROW_ASSET, SET_BORROW_AMOUNT, PREVIEW_BORROW
 * - START_REPAY, PREVIEW_REPAY
 * - START_REBALANCE, SET_REBALANCE_USE_CASH, PREVIEW_REBALANCE
 * - CANCEL_PROTECTION
 */

import { computeSnapshot } from '../../engine/snapshot';
import { classifyActionBoundary, frictionCopyForBoundary } from '../../engine/boundary';
import {
  validateAddFunds,
  validateTrade,
  validateProtect,
  validateBorrow,
  validateRepay,
  validateRebalance,
} from '../../engine/validate';
import {
  cloneState,
  previewAddFunds,
  previewTrade,
  previewProtect,
  previewBorrow,
  previewRepay,
  previewRebalance,
  calculateRebalanceGap,
} from '../../engine/preview';
import { STAGES, DEFAULT_PRICES, DEFAULT_FX_RATE } from '../../constants/index';
import { uid, nowISO, computeDateLabel } from '../../helpers';
import { addLogEntry } from '../initialState';
import type { AppState, AppAction, ActionKind, ValidationResult, PendingAction, Holding, LedgerEntry, RebalanceMeta, RebalanceMode, LedgerEntryType, AssetId } from '../../types';

export const PORTFOLIO_ACTIONS: string[] = [
  // Add Funds
  'START_ADD_FUNDS',
  'SET_ADD_FUNDS_AMOUNT',
  'PREVIEW_ADD_FUNDS',
  // Trade
  'START_TRADE',
  'SET_TRADE_SIDE',
  'SET_TRADE_AMOUNT',
  'PREVIEW_TRADE',
  // Protect
  'START_PROTECT',
  'SET_PROTECT_ASSET',
  'SET_PROTECT_MONTHS',
  'PREVIEW_PROTECT',
  // Borrow
  'START_BORROW',
  'SET_BORROW_ASSET',
  'SET_BORROW_AMOUNT',
  'PREVIEW_BORROW',
  // Repay
  'START_REPAY',
  'PREVIEW_REPAY',
  // Rebalance
  'START_REBALANCE',
  'SET_REBALANCE_USE_CASH',
  'PREVIEW_REBALANCE',
  // Cancel
  'CANCEL_PROTECTION',
];

interface AfterStateWithMeta extends AppState {
  _rebalanceMeta?: RebalanceMeta;
}

/**
 * Build pending action with boundary classification
 */
function buildPending(
  state: AppState,
  kind: ActionKind,
  payload: Record<string, unknown>,
  validation: ValidationResult,
  afterState: AfterStateWithMeta
): PendingAction {
  const before = computeSnapshot(state.holdings, state.cashIRR);
  const after = computeSnapshot(afterState.holdings, afterState.cashIRR);
  const boundary = classifyActionBoundary({
    kind,
    validation,
    before,
    after,
    stressMode: state.stressMode,
    targetLayerPct: state.targetLayerPct,
  });

  // Extract rebalance meta if present for constraint messaging
  const meta = afterState._rebalanceMeta || null;

  return {
    kind,
    payload,
    before,
    after,
    validation,
    boundary,
    frictionCopy: frictionCopyForBoundary(boundary, kind, meta || {}),
    // R-1: Include rebalance meta for trade details display
    rebalanceMeta: kind === 'REBALANCE' ? meta : null,
  } as PendingAction;
}

/**
 * Portfolio slice reducer
 */
export function portfolioReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // ====== ADD FUNDS ======
    case 'START_ADD_FUNDS': {
      if (state.stage !== STAGES.ACTIVE) return state;
      return { ...state, addFundsDraft: { amountIRR: null }, pendingAction: null };
    }

    case 'SET_ADD_FUNDS_AMOUNT': {
      if (!state.addFundsDraft) return state;
      const amountIRR = typeof action.amountIRR === 'string' ? parseFloat(action.amountIRR) || null : action.amountIRR;
      return { ...state, addFundsDraft: { ...state.addFundsDraft, amountIRR } };
    }

    case 'PREVIEW_ADD_FUNDS': {
      if (state.stage !== STAGES.ACTIVE) return state;
      const amountIRR = Number(state.addFundsDraft?.amountIRR || action.payload?.amountIRR);
      const payload = { amountIRR };
      const validation = validateAddFunds(payload);
      const afterState = validation.ok ? previewAddFunds(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'ADD_FUNDS', payload, validation, afterState) };
    }

    // ====== TRADE ======
    case 'START_TRADE': {
      if (state.stage !== STAGES.ACTIVE) return state;
      return {
        ...state,
        tradeDraft: { assetId: action.assetId, side: action.side || 'BUY', amountIRR: null },
        pendingAction: null,
      };
    }

    case 'SET_TRADE_SIDE': {
      if (!state.tradeDraft) return state;
      return { ...state, tradeDraft: { ...state.tradeDraft, side: action.side } };
    }

    case 'SET_TRADE_AMOUNT': {
      if (!state.tradeDraft) return state;
      const amountIRR = typeof action.amountIRR === 'string' ? parseFloat(action.amountIRR) || null : action.amountIRR;
      return { ...state, tradeDraft: { ...state.tradeDraft, amountIRR } };
    }

    case 'PREVIEW_TRADE': {
      if (state.stage !== STAGES.ACTIVE || !state.tradeDraft) return state;
      // v10: Include prices and fxRate for quantity-based trade execution
      const prices = action.prices || DEFAULT_PRICES;
      const fxRate = action.fxRate || DEFAULT_FX_RATE;
      const payload = {
        side: state.tradeDraft.side,
        assetId: state.tradeDraft.assetId,
        amountIRR: Number(state.tradeDraft.amountIRR),
        prices,
        fxRate,
      };
      const validation = validateTrade(payload, state);
      const afterState = validation.ok ? previewTrade(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'TRADE', payload, validation, afterState) };
    }

    // ====== PROTECT ======
    case 'START_PROTECT': {
      if (state.stage !== STAGES.ACTIVE) return state;
      // v10: Check quantity instead of valueIRR
      const startProtectAction = action as { type: 'START_PROTECT'; assetId?: string };
      const assetId = (startProtectAction.assetId || state.holdings.find((h: Holding) => h.quantity > 0)?.assetId) as AssetId | undefined;
      if (!assetId) return state;
      return {
        ...state,
        protectDraft: { assetId, months: 3 },
        pendingAction: null,
      };
    }

    case 'SET_PROTECT_ASSET': {
      if (!state.protectDraft) return state;
      return { ...state, protectDraft: { ...state.protectDraft, assetId: action.assetId as AssetId } };
    }

    case 'SET_PROTECT_MONTHS': {
      if (!state.protectDraft) return state;
      return { ...state, protectDraft: { ...state.protectDraft, months: action.months } };
    }

    case 'PREVIEW_PROTECT': {
      if (state.stage !== STAGES.ACTIVE || !state.protectDraft) return state;
      // v10: Include prices and fxRate for quantity-based value computation
      const prices = action.prices || DEFAULT_PRICES;
      const fxRate = action.fxRate || DEFAULT_FX_RATE;
      const payload = {
        assetId: state.protectDraft.assetId,
        months: Number(state.protectDraft.months),
        prices,
        fxRate,
      };
      const validation = validateProtect(payload, state);
      const afterState = validation.ok ? previewProtect(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'PROTECT', payload, validation, afterState) };
    }

    // ====== BORROW ======
    case 'START_BORROW': {
      if (state.stage !== STAGES.ACTIVE) return state;
      // v10: Check quantity instead of valueIRR
      const available = state.holdings.filter((h: Holding) => !h.frozen && h.quantity > 0);
      if (available.length === 0) return state;
      const assetId = action.assetId || available[0].assetId;
      return {
        ...state,
        borrowDraft: { assetId, amountIRR: null },
        pendingAction: null,
      };
    }

    case 'SET_BORROW_ASSET': {
      if (!state.borrowDraft) return state;
      return { ...state, borrowDraft: { ...state.borrowDraft, assetId: action.assetId as AssetId } };
    }

    case 'SET_BORROW_AMOUNT': {
      if (!state.borrowDraft) return state;
      const amountIRR = typeof action.amountIRR === 'string' ? parseFloat(action.amountIRR) || null : action.amountIRR;
      return { ...state, borrowDraft: { ...state.borrowDraft, amountIRR } };
    }

    case 'PREVIEW_BORROW': {
      if (state.stage !== STAGES.ACTIVE || !state.borrowDraft) return state;
      // v10: Include prices and fxRate for quantity-based value computation
      const prices = action.prices || DEFAULT_PRICES;
      const fxRate = action.fxRate || DEFAULT_FX_RATE;
      const payload = {
        assetId: state.borrowDraft.assetId,
        amountIRR: Number(state.borrowDraft.amountIRR),
        prices,
        fxRate,
      };
      const validation = validateBorrow(payload, state);
      const afterState = validation.ok ? previewBorrow(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'BORROW', payload, validation, afterState) };
    }

    // ====== REPAY ======
    case 'START_REPAY': {
      if (state.stage !== STAGES.ACTIVE) return state;
      const loans = state.loans || [];
      if (loans.length === 0) return state;
      // Select the loan to repay (passed via action or default to first loan)
      const startRepayAction = action as { type: 'START_REPAY'; loanId?: string };
      const loanId = startRepayAction.loanId || loans[0].id;
      const loan = loans.find((l: { id: string }) => l.id === loanId);
      if (!loan) return state;
      return {
        ...state,
        repayDraft: { loanId: loan.id, amountIRR: loan.amountIRR },
        pendingAction: null,
      };
    }

    case 'PREVIEW_REPAY': {
      if (state.stage !== STAGES.ACTIVE || !state.repayDraft) return state;
      const payload = { loanId: state.repayDraft.loanId, amountIRR: state.repayDraft.amountIRR };
      const validation = validateRepay(payload, state);
      const afterState = validation.ok ? previewRepay(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'REPAY', payload, validation, afterState) };
    }

    // ====== REBALANCE ======
    case 'START_REBALANCE': {
      if (state.stage !== STAGES.ACTIVE) return state;
      // Calculate rebalance gap to determine if locked assets prevent full rebalancing
      const prices = action.prices || DEFAULT_PRICES;
      const fxRate = action.fxRate || DEFAULT_FX_RATE;
      const gapAnalysis = calculateRebalanceGap(state, prices, fxRate);

      return {
        ...state,
        rebalanceDraft: {
          mode: 'HOLDINGS_ONLY',
          useCash: false,  // User opt-in for using cash
          useCashAmount: 0,
          gapAnalysis,  // Store gap analysis for UI display
        },
        pendingAction: null,
      };
    }

    case 'SET_REBALANCE_USE_CASH': {
      if (!state.rebalanceDraft) return state;
      const useCash = Boolean(action.useCash);
      const gapAnalysis = state.rebalanceDraft.gapAnalysis;

      // Calculate how much cash to use
      let useCashAmount = 0;
      if (useCash && gapAnalysis) {
        if (gapAnalysis.cashSufficient) {
          // Use exactly what's needed for perfect balance
          useCashAmount = gapAnalysis.cashNeededForPerfectBalance;
        } else {
          // Use all available cash to get as close as possible
          useCashAmount = gapAnalysis.currentCash;
        }
      }

      return {
        ...state,
        rebalanceDraft: {
          ...state.rebalanceDraft,
          useCash,
          useCashAmount,
        },
      };
    }

    case 'PREVIEW_REBALANCE': {
      if (state.stage !== STAGES.ACTIVE) return state;
      // v10: Include prices and fxRate for quantity-based rebalance execution
      const prices = action.prices || DEFAULT_PRICES;
      const fxRate = action.fxRate || DEFAULT_FX_RATE;

      // Determine mode and cash usage based on user selection
      const draft = state.rebalanceDraft || { mode: 'HOLDINGS_ONLY' as RebalanceMode };
      const useCash = draft.useCash && (draft.useCashAmount || 0) > 0;

      const payload = {
        mode: (useCash ? 'SMART' : 'HOLDINGS_ONLY') as RebalanceMode,
        prices,
        fxRate,
        useCashAmount: useCash ? (draft.useCashAmount || 0) : 0,
      };

      const validation = validateRebalance(payload);
      const afterState = validation.ok ? previewRebalance(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'REBALANCE', payload, validation, afterState) };
    }

    // ====== CANCEL PROTECTION ======
    case 'CANCEL_PROTECTION': {
      if (state.stage !== STAGES.ACTIVE) return state;
      const protectionId = action.protectionId;
      const protection = state.protections.find(p => p.id === protectionId);
      if (!protection) return state;

      // Remove protection (no refund - premium was for the coverage period)
      const newProtections = state.protections.filter(p => p.id !== protectionId);

      // Create ledger entry
      const tsISO = nowISO();
      const entry: LedgerEntry = {
        id: uid(),
        tsISO,
        tsDateLabel: computeDateLabel(tsISO),  // Pre-computed for O(1) grouping in HistoryPane
        type: 'PROTECTION_CANCELLED_COMMIT' as LedgerEntryType,
        details: {
          protectionId,
          assetId: protection.assetId,
        },
      };

      let next: AppState = {
        ...state,
        protections: newProtections,
        ledger: [...state.ledger, entry],
        lastAction: { type: 'PROTECTION_CANCELLED', timestamp: Date.now(), assetId: protection.assetId },
      };
      next = addLogEntry(next, 'PROTECTION_CANCELLED', { assetId: protection.assetId });

      return next;
    }

    default:
      return state;
  }
}
