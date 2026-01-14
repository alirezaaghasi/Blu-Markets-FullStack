import React, { useRef, useEffect, useMemo } from 'react';
import { formatTime, formatIRRShort, getAssetDisplayName } from '../helpers.js';

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

  // Decision 15: Format activity message with verb-first plain language
  const formatActivityMessage = (entry) => {
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
        return `Cancelled ${getAssetDisplayName(entry.assetId)} protection`;
      default:
        return entry.type;
    }
  };

  const renderLogEntry = (entry) => {
    const time = formatTime(entry.timestamp);
    const message = formatActivityMessage(entry);

    return (
      <div className="activityItem">
        <span className="activityDot">●</span>
        <span className="activityTime">{time}</span>
        <span className="activityMessage">{message}</span>
      </div>
    );
  };

  const getBoundaryClass = (entry) => {
    if (!entry.boundary || entry.boundary === 'SAFE') return '';
    return entry.boundary.toLowerCase();
  };

  return (
    <div className="actionLog" ref={logRef}>
      {recentActions.map((entry) => (
        <div key={entry.id} className={`logEntry ${getBoundaryClass(entry)}`}>
          {renderLogEntry(entry)}
        </div>
      ))}
    </div>
  );
}

export default React.memo(ActionLogPane);
