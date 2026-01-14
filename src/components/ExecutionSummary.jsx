import React, { useEffect } from 'react';
import { formatIRRShort, getAssetDisplayName } from '../helpers.js';

/**
 * ExecutionSummary - Toast notification for completed actions
 * Auto-dismisses after 4 seconds
 */
function ExecutionSummary({ lastAction, dispatch }) {
  useEffect(() => {
    if (lastAction) {
      const timer = setTimeout(() => dispatch({ type: 'DISMISS_LAST_ACTION' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [lastAction, dispatch]);

  if (!lastAction) return null;

  const formatSummary = () => {
    switch (lastAction.type) {
      case 'PORTFOLIO_CREATED':
        return '✓ Portfolio created';
      case 'ADD_FUNDS':
        return `✓ +${formatIRRShort(lastAction.amountIRR)} cash added`;
      case 'TRADE':
        return `✓ ${lastAction.side === 'BUY' ? 'Bought' : 'Sold'} ${getAssetDisplayName(lastAction.assetId)}`;
      case 'BORROW':
        return `✓ Borrowed ${formatIRRShort(lastAction.amountIRR)}`;
      case 'REPAY':
        return '✓ Loan repaid';
      case 'PROTECT':
        return `✓ ${getAssetDisplayName(lastAction.assetId)} protected`;
      case 'REBALANCE':
        return '✓ Rebalanced successfully';
      default:
        return `✓ ${lastAction.type}`;
    }
  };

  return <div className="toast success">{formatSummary()}</div>;
}

export default React.memo(ExecutionSummary);
