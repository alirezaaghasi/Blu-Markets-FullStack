// @ts-check
/**
 * Ledger Slice - Handles pending action confirmation and cancellation
 *
 * Actions handled:
 * - CONFIRM_PENDING: Commit pending action to ledger
 * - CANCEL_PENDING: Cancel pending action and clear drafts
 */

import { cloneState, previewAddFunds, previewTrade, previewBorrow, previewRepay, previewRebalance } from '../../engine/preview';
import { calcPremiumIRR } from '../../engine/pricing';
import { uid, nowISO } from '../../helpers';
import { addLogEntry } from '../initialState';

/** @type {string[]} */
export const LEDGER_ACTIONS = ['CONFIRM_PENDING', 'CANCEL_PENDING'];

/**
 * Ledger slice reducer
 * @param {import('../../types').AppState} state
 * @param {{ type: string, [key: string]: any }} action
 * @returns {import('../../types').AppState}
 */
export function ledgerReducer(state, action) {
  switch (action.type) {
    case 'CANCEL_PENDING':
      return {
        ...state,
        pendingAction: null,
        tradeDraft: null,
        protectDraft: null,
        borrowDraft: null,
        repayDraft: null,
        addFundsDraft: null,
        rebalanceDraft: null,
      };

    case 'CONFIRM_PENDING': {
      const p = state.pendingAction;
      if (!p || !p.validation.ok) return state;

      let next = cloneState(state);

      // Commit by replaying deterministic preview
      if (p.kind === 'ADD_FUNDS') next = previewAddFunds(next, p.payload);
      if (p.kind === 'TRADE') next = previewTrade(next, p.payload);
      if (p.kind === 'BORROW') next = previewBorrow(next, p.payload);
      if (p.kind === 'REPAY') next = previewRepay(next, p.payload);
      if (p.kind === 'REBALANCE') next = previewRebalance(next, p.payload);

      if (p.kind === 'PROTECT') {
        const holding = next.holdings.find(h => h.assetId === p.payload.assetId);
        if (holding) {
          // v10: Get notionalIRR from computed snapshot, not holding directly
          const notionalIRR = p.after.holdingsIRRByAsset[holding.assetId] || 0;

          const premium = calcPremiumIRR({
            assetId: holding.assetId,
            notionalIRR,
            months: p.payload.months,
          });
          next.cashIRR -= premium;

          const startISO = new Date().toISOString().slice(0, 10);
          const end = new Date();
          end.setMonth(end.getMonth() + p.payload.months);
          const endISO = end.toISOString().slice(0, 10);

          next.protections = [
            ...next.protections,
            {
              id: uid(),
              assetId: holding.assetId,
              notionalIRR,
              premiumIRR: premium,
              durationMonths: p.payload.months,
              startISO,
              endISO,
              // Pre-computed timestamps for O(1) comparisons in UI (avoid repeated Date parsing)
              startTimeMs: new Date(startISO).getTime(),
              endTimeMs: end.getTime(),
            },
          ];
        }
      }

      // Reuse after snapshot from preview instead of recomputing
      // (state is deterministic, so after snapshot is identical)
      const entry = {
        id: uid(),
        tsISO: nowISO(),
        type: `${p.kind}_COMMIT`,
        details: {
          kind: p.kind,
          payload: p.payload,
          boundary: p.boundary,
          validation: p.validation,
          before: p.before,
          after: p.after,
          // Issue 9: Store friction copy for ledger display
          frictionCopy: p.frictionCopy || [],
        },
      };

      next.pendingAction = null;
      next.tradeDraft = null;
      next.protectDraft = null;
      next.borrowDraft = null;
      next.repayDraft = null;
      next.addFundsDraft = null;
      next.rebalanceDraft = null;
      next.ledger = [...next.ledger, entry];
      next.lastAction = {
        type: p.kind,
        timestamp: Date.now(),
        ...p.payload,
        // Include boundary and rebalanceMeta for accurate toast messaging
        boundary: p.boundary,
        rebalanceMeta: p.rebalanceMeta,
      };
      // Fix 6: Include boundary in action log for indicators
      next = addLogEntry(next, p.kind, { ...p.payload, boundary: p.boundary });

      // G-3: Portfolio Gravity - return to Portfolio Home after any action
      next.tab = 'PORTFOLIO';

      return next;
    }

    default:
      return state;
  }
}
