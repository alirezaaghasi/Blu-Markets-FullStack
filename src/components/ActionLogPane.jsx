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

  const renderLogEntry = (entry) => {
    const time = formatTime(entry.timestamp);
    // Add boundary dot indicator for DRIFT/STRUCTURAL
    const boundaryDot = entry.boundary && entry.boundary !== 'SAFE' ? (
      <span className={`logBoundaryDot ${entry.boundary.toLowerCase()}`}></span>
    ) : null;

    // Issue 7: Verb-based action log format
    switch (entry.type) {
      case 'PORTFOLIO_CREATED':
        return <span>{time}  Started with {formatIRRShort(entry.amountIRR)}</span>;
      case 'ADD_FUNDS':
        return <span>{boundaryDot}{time}  Added funds ({formatIRRShort(entry.amountIRR)})</span>;
      case 'TRADE':
        return <span>{boundaryDot}{time}  {entry.side === 'BUY' ? 'Bought' : 'Sold'} {getAssetDisplayName(entry.assetId)} ({formatIRRShort(entry.amountIRR)})</span>;
      case 'BORROW':
        return <span>{boundaryDot}{time}  Borrowed {formatIRRShort(entry.amountIRR)} ({getAssetDisplayName(entry.assetId)} collateral)</span>;
      case 'REPAY':
        return <span>{boundaryDot}{time}  Repaid loan ({formatIRRShort(entry.amountIRR)})</span>;
      case 'PROTECT':
        return <span>{boundaryDot}{time}  Protected {getAssetDisplayName(entry.assetId)} ({entry.months}mo)</span>;
      case 'REBALANCE':
        return <span>{boundaryDot}{time}  Rebalanced portfolio</span>;
      case 'CANCEL_PROTECTION':
        return <span>{boundaryDot}{time}  Cancelled protection ({getAssetDisplayName(entry.assetId)})</span>;
      default:
        return <span>{boundaryDot}{time}  {entry.type}</span>;
    }
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
