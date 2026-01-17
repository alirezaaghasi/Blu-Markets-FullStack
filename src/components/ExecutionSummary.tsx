import React, { useEffect } from 'react';
import type { AppAction, LastAction, Boundary, AssetId, TradeSide, RebalanceMeta } from '../types';
import { formatIRRShort, getAssetDisplayName } from '../helpers';

interface ExecutionSummaryProps {
  lastAction: LastAction | null;
  dispatch: React.Dispatch<AppAction>;
}

interface LastActionWithDetails extends LastAction {
  amountIRR?: number;
  side?: TradeSide;
  assetId?: AssetId;
  boundary?: Boundary;
  rebalanceMeta?: RebalanceMeta;
}

/**
 * ExecutionSummary - Toast notification for completed actions
 * Auto-dismisses after 4 seconds
 */
function ExecutionSummary({ lastAction, dispatch }: ExecutionSummaryProps): React.ReactElement | null {
  useEffect(() => {
    if (lastAction) {
      const timer = setTimeout(() => dispatch({ type: 'DISMISS_LAST_ACTION' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [lastAction, dispatch]);

  if (!lastAction) return null;

  const action = lastAction as LastActionWithDetails;

  const formatSummary = (): string => {
    switch (action.type) {
      case 'PORTFOLIO_CREATED':
        return '✓ Portfolio created';
      case 'ADD_FUNDS':
        return `✓ +${formatIRRShort(action.amountIRR || 0)} cash added`;
      case 'TRADE':
        return `✓ ${action.side === 'BUY' ? 'Bought' : 'Sold'} ${getAssetDisplayName(action.assetId!)}`;
      case 'BORROW':
        return `✓ Borrowed ${formatIRRShort(action.amountIRR || 0)}`;
      case 'REPAY':
        return '✓ Loan repaid';
      case 'PROTECT':
        return `✓ ${getAssetDisplayName(action.assetId!)} protected`;
      case 'CANCEL_PROTECTION':
      case 'PROTECTION_CANCELLED':
        return `✓ Cancelled ${getAssetDisplayName(action.assetId!)} protection`;
      case 'REBALANCE': {
        // Show accurate message based on actual result (residualDrift), not just constraints
        const meta = action.rebalanceMeta;
        const residualDrift = meta?.residualDrift || 0;

        // If drift is minimal (< 1% total), it's a full rebalance regardless of constraints
        if (residualDrift < 1) {
          return '✓ Rebalanced successfully';
        }
        return '✓ Partially rebalanced';
      }
      default:
        return `✓ ${action.type}`;
    }
  };

  return <div className="toast success">{formatSummary()}</div>;
}

export default React.memo(ExecutionSummary);
