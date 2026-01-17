import React, { useRef, useEffect, useMemo } from 'react';
import { formatTime, formatIRRShort, getAssetDisplayName } from '../helpers';

/**
 * Format activity message with verb-first plain language
 * Moved outside component to prevent recreation on each render
 */
function formatActivityMessage(entry) {
  switch (entry.type) {
    case 'PORTFOLIO_CREATED':
      return `Started with ${formatIRRShort(entry.amountIRR)}`;
    case 'ADD_FUNDS':
      return `Added ${formatIRRShort(entry.amountIRR)} cash`;
    case 'TRADE':
      return entry.side === 'BUY'
        ? `Bought ${getAssetDisplayName(entry.assetId)} (${formatIRRShort(entry.amountIRR)})`
        : `Sold ${getAssetDisplayName(entry.assetId)} (${formatIRRShort(entry.amountIRR)})`;
    case 'BORROW':
      return `Borrowed ${formatIRRShort(entry.amountIRR)} against ${getAssetDisplayName(entry.assetId)}`;
    case 'REPAY':
      return `Repaid ${formatIRRShort(entry.amountIRR)} loan`;
    case 'PROTECT':
      return `Protected ${getAssetDisplayName(entry.assetId)} for ${entry.months}mo`;
    case 'REBALANCE':
      return `Rebalanced portfolio`;
    case 'CANCEL_PROTECTION':
    case 'PROTECTION_CANCELLED':
      return `Cancelled ${getAssetDisplayName(entry.assetId)} protection`;
    default:
      return entry.type;
  }
}

/**
 * Get CSS class for boundary indicator
 * Moved outside component to prevent recreation on each render
 */
function getBoundaryClass(entry) {
  if (!entry.boundary || entry.boundary === 'SAFE') return '';
  return entry.boundary.toLowerCase();
}

/**
 * ActionLogPane - Displays recent actions in a scrollable log
 * Shows last 10 actions with boundary indicators
 */
function ActionLogPane({ actionLog }) {
  const logRef = useRef(null);

  // Memoize recent actions slice to avoid repeated slicing on re-renders
  const recentActions = useMemo(
    () => (actionLog || []).slice(-10),
    [actionLog]
  );

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [actionLog]);

  if (recentActions.length === 0) {
    return (
      <div className="actionLogEmpty">
        <div className="muted">No actions yet</div>
      </div>
    );
  }

  return (
    <div className="actionLog" ref={logRef}>
      {recentActions.map((entry) => (
        <div key={entry.id} className={`logEntry ${getBoundaryClass(entry)}`}>
          <div className="activityItem">
            <span className="activityDot">●</span>
            <span className="activityTime">{formatTime(entry.timestamp)}</span>
            <span className="activityMessage">{formatActivityMessage(entry)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default React.memo(ActionLogPane);
