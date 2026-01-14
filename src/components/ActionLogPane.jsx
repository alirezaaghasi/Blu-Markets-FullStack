import React, { useRef, useEffect } from 'react';
import { formatTime, formatIRRShort, getAssetDisplayName } from '../helpers.js';

/**
 * ActionLogPane - Displays recent actions in a scrollable log
 * Shows last 10 actions with boundary indicators
 */
function ActionLogPane({ actionLog }) {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [actionLog]);

  if (!actionLog || actionLog.length === 0) {
    return (
      <div className="actionLogEmpty">
        <div className="muted">No actions yet</div>
      </div>
    );
  }

  // Limit to last 10 actions
  const recentActions = actionLog.slice(-10);

  const renderLogEntry = (entry) => {
    const time = formatTime(entry.timestamp);
    // Add boundary dot indicator for DRIFT/STRUCTURAL
    const boundaryDot = entry.boundary && entry.boundary !== 'SAFE' ? (
      <span className={`logBoundaryDot ${entry.boundary.toLowerCase()}`}></span>
    ) : null;

    if (entry.type === 'REBALANCE') {
      return <span>{boundaryDot}{time}  ⚖️ Rebalanced</span>;
    }

    switch (entry.type) {
      case 'PORTFOLIO_CREATED':
        return <span>{time}  Started with {formatIRRShort(entry.amountIRR)}</span>;
      case 'ADD_FUNDS':
        return <span>{boundaryDot}{time}  +{formatIRRShort(entry.amountIRR)} cash</span>;
      case 'TRADE':
        return <span>{boundaryDot}{time}  {entry.side === 'BUY' ? '+' : '-'}{getAssetDisplayName(entry.assetId)} {formatIRRShort(entry.amountIRR)}</span>;
      case 'BORROW':
        return <span>{boundaryDot}{time}  💰 Borrowed {formatIRRShort(entry.amountIRR)} against {getAssetDisplayName(entry.assetId)}</span>;
      case 'REPAY':
        return <span>{boundaryDot}{time}  ✓ Repaid {formatIRRShort(entry.amountIRR)}</span>;
      case 'PROTECT':
        return <span>{boundaryDot}{time}  ☂️ {getAssetDisplayName(entry.assetId)} protected {entry.months}mo</span>;
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
