/**
 * Ledger Slice - Handles pending action confirmation and cancellation
 *
 * Actions handled:
 * - CONFIRM_PENDING: Commit pending action to ledger
 * - CANCEL_PENDING: Cancel pending action and clear drafts
 */

import { cloneState, previewAddFunds, previewTrade, previewBorrow, previewRepay, previewRebalance } from '../../engine/preview';
import { calcPremiumIRR } from '../../engine/pricing';
import { uid, nowISO, computeDateLabel, getAssetDisplayName } from '../../helpers';
import { addLogEntry } from '../initialState';
import type {
  AppState,
  AppAction,
  LedgerEntry,
  LedgerEntryType,
  ActionPayload,
  AddFundsPayload,
  TradePayload,
  ProtectPayload,
  BorrowPayload,
  RepayPayload,
  RebalancePayload,
} from '../../types';

export const LEDGER_ACTIONS: string[] = ['CONFIRM_PENDING', 'CANCEL_PENDING'];

/**
 * Ledger slice reducer
 */
export function ledgerReducer(state: AppState, action: AppAction): AppState {
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

      // Capture loan details BEFORE processing REPAY (loan may be removed if settled)
      let repayLoanInfo: { collateralAssetId: string; installmentsPaid: number; isSettlement: boolean } | null = null;
      if (p.kind === 'REPAY') {
        const repayPayload = p.payload as RepayPayload;
        const loan = state.loans.find(l => l.id === repayPayload.loanId);
        if (loan) {
          // Determine if this payment will settle the loan
          const totalOwed = loan.amountIRR + (loan.accruedInterestIRR || 0);
          const willSettle = repayPayload.amountIRR >= totalOwed;
          repayLoanInfo = {
            collateralAssetId: loan.collateralAssetId,
            installmentsPaid: (loan.installmentsPaid || 0) + 1, // Will increment after this payment
            isSettlement: willSettle,
          };
        }
      }

      // Commit by replaying deterministic preview with type-safe payload dispatch
      switch (p.kind) {
        case 'ADD_FUNDS':
          next = previewAddFunds(next, p.payload as AddFundsPayload);
          break;
        case 'TRADE':
          next = previewTrade(next, p.payload as TradePayload);
          break;
        case 'BORROW':
          next = previewBorrow(next, p.payload as BorrowPayload);
          break;
        case 'REPAY':
          next = previewRepay(next, p.payload as RepayPayload);
          break;
        case 'REBALANCE':
          next = previewRebalance(next, p.payload as RebalancePayload);
          break;
        case 'PROTECT':
          // Handled separately below
          break;
      }

      if (p.kind === 'PROTECT') {
        const protectPayload = p.payload as ProtectPayload;
        const holding = next.holdings.find(h => h.assetId === protectPayload.assetId);
        if (holding) {
          // v10: Get notionalIRR from computed snapshot, not holding directly
          const notionalIRR = p.after.holdingsIRRByAsset[holding.assetId] || 0;

          const premium = calcPremiumIRR({
            assetId: holding.assetId,
            notionalIRR,
            months: protectPayload.months,
          });
          next.cashIRR -= premium;

          const startISO = new Date().toISOString().slice(0, 10);
          const end = new Date();
          end.setMonth(end.getMonth() + protectPayload.months);
          const endISO = end.toISOString().slice(0, 10);

          next.protections = [
            ...next.protections,
            {
              id: uid(),
              assetId: holding.assetId,
              notionalIRR,
              premiumIRR: premium,
              durationMonths: protectPayload.months,
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
      const tsISO = nowISO();

      // Determine the payload to store - enrich REPAY with collateral info for History display
      let storedPayload: ActionPayload = p.payload as ActionPayload;
      if (p.kind === 'REPAY' && repayLoanInfo) {
        const repayPayload = p.payload as RepayPayload;
        storedPayload = {
          ...repayPayload,
          collateralName: getAssetDisplayName(repayLoanInfo.collateralAssetId),
          installmentsPaid: repayLoanInfo.installmentsPaid,
          isSettlement: repayLoanInfo.isSettlement,
        };
      }

      const entry: LedgerEntry = {
        id: uid(),
        tsISO,
        tsDateLabel: computeDateLabel(tsISO),  // Pre-computed for O(1) grouping in HistoryPane
        type: `${p.kind}_COMMIT` as LedgerEntryType,
        details: {
          kind: p.kind,
          payload: storedPayload,
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
      next.ledger = [...next.ledger, entry] as LedgerEntry[];
      next.lastAction = {
        type: p.kind,
        timestamp: Date.now(),
        ...p.payload,
        // Include boundary and rebalanceMeta for accurate toast messaging
        boundary: p.boundary,
        rebalanceMeta: p.rebalanceMeta,
      };
      // Fix 6: Include boundary in action log for indicators
      // For REPAY: include collateral name and installment info for enhanced log messages
      if (p.kind === 'REPAY' && repayLoanInfo) {
        next = addLogEntry(next, p.kind, {
          ...p.payload,
          boundary: p.boundary,
          collateralName: getAssetDisplayName(repayLoanInfo.collateralAssetId),
          installmentsPaid: repayLoanInfo.installmentsPaid,
          isSettlement: repayLoanInfo.isSettlement,
        });
      } else {
        next = addLogEntry(next, p.kind, { ...p.payload, boundary: p.boundary });
      }

      // G-3: Portfolio Gravity - return to Portfolio Home after any action
      next.tab = 'PORTFOLIO';

      return next;
    }

    default:
      return state;
  }
}
