import React, { useState } from 'react';
import { formatIRR, formatIRRShort, getAssetDisplayName } from '../helpers.js';
import { BOUNDARY_LABELS } from '../constants/index.js';

/**
 * Helper to group entries by date
 */
function groupByDate(entries) {
  const groups = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  entries.forEach(entry => {
    const date = new Date(entry.tsISO).toDateString();
    let label;

    if (date === today) {
      label = 'Today';
    } else if (date === yesterday) {
      label = 'Yesterday';
    } else {
      label = new Date(entry.tsISO).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  });

  return groups;
}

/**
 * Format time only (since date is in header)
 */
function formatTimeOnly(timestamp) {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * HistoryPane - Full action history with expandable details
 * Groups entries by date, shows boundary badges, portfolio impact
 */
function HistoryPane({ ledger }) {
  const [expanded, setExpanded] = useState({});

  // Empty state with rich placeholder
  if (!ledger || ledger.length === 0) {
    return (
      <div className="card">
        <h3>Action History</h3>
        <div className="emptyLedger">
          <div className="emptyIcon">📋</div>
          <div className="emptyText">No actions yet</div>
          <div className="emptySubtext">Your decisions will be recorded here</div>
        </div>
      </div>
    );
  }

  const getActionIcon = (entry) => {
    const type = entry.type.replace('_COMMIT', '');
    if (type === 'TRADE') return entry.details?.payload?.side === 'BUY' ? '+' : '-';
    const icons = {
      'PORTFOLIO_CREATED': '✓',
      'ADD_FUNDS': '+',
      'REBALANCE': '⚖️',
      'PROTECT': '☂️',
      'BORROW': '💰',
      'REPAY': '✓'
    };
    return icons[type] || '•';
  };

  const getIconClass = (entry) => {
    const type = entry.type.replace('_COMMIT', '');
    if (type === 'TRADE') return entry.details?.payload?.side === 'BUY' ? 'trade-buy' : 'trade-sell';
    const classes = {
      'PORTFOLIO_CREATED': 'action-success',
      'ADD_FUNDS': 'funds-add',
      'REBALANCE': 'action-rebalance',
      'PROTECT': 'action-protect',
      'BORROW': 'action-loan',
      'REPAY': 'action-success'
    };
    return classes[type] || '';
  };

  const formatLedgerAction = (entry) => {
    const type = entry.type.replace('_COMMIT', '');
    const payload = entry.details?.payload;
    switch (type) {
      case 'PORTFOLIO_CREATED': return 'Portfolio Created';
      case 'ADD_FUNDS': return 'Funds Added';
      case 'TRADE': return `${payload?.side === 'BUY' ? 'Bought' : 'Sold'} ${getAssetDisplayName(payload?.assetId)}`;
      case 'REBALANCE': return 'Rebalanced';
      case 'PROTECT': return `Protected ${getAssetDisplayName(payload?.assetId)} (${payload?.months}mo)`;
      case 'BORROW': return `Borrowed ${formatIRRShort(payload?.amountIRR)} IRR against ${getAssetDisplayName(payload?.assetId)}`;
      case 'REPAY': return 'Loan Repaid';
      default: return type;
    }
  };

  const getEntryAmount = (entry) => {
    const type = entry.type.replace('_COMMIT', '');
    const payload = entry.details?.payload;
    switch (type) {
      case 'PORTFOLIO_CREATED': return entry.details?.amountIRR;
      case 'ADD_FUNDS': return payload?.amountIRR;
      case 'TRADE': return payload?.amountIRR;
      case 'BORROW': return payload?.amountIRR;
      case 'REPAY': return payload?.amountIRR;
      case 'PROTECT': {
        // Show premium paid from after snapshot
        const before = entry.details?.before;
        const after = entry.details?.after;
        if (before && after) return before.cashIRR - after.cashIRR;
        return null;
      }
      case 'REBALANCE': return null;
      default: return null;
    }
  };

  const hasDetails = (entry) => {
    const boundary = entry.details?.boundary;
    const before = entry.details?.before;
    const after = entry.details?.after;
    return (boundary && boundary !== 'SAFE') || (before && after);
  };

  // Group entries by date (reversed for newest first)
  const grouped = groupByDate([...ledger].reverse());

  return (
    <div className="card">
      <h3>Action History</h3>
      <div className="ledgerIntro">
        Every action you take is recorded immutably.
      </div>
      <div className="historyList">
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="historyGroup">
            <div className="historyDateHeader">{date}</div>
            {items.map((entry) => {
              const amount = getEntryAmount(entry);
              const showExpand = hasDetails(entry);
              const isExpanded = expanded[entry.id];
              const boundary = entry.details?.boundary;
              const boundaryClass = boundary ? boundary.toLowerCase() : '';

              return (
                <div key={entry.id} className={`ledgerEntry ${boundaryClass}`}>
                  <div
                    className="ledgerHeader"
                    onClick={() => showExpand && setExpanded(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                    style={{ cursor: showExpand ? 'pointer' : 'default' }}
                  >
                    <span className={`ledgerIcon ${getIconClass(entry)}`}>{getActionIcon(entry)}</span>
                    <span className="ledgerAction">{formatLedgerAction(entry)}</span>
                    {amount && <span className="ledgerAmount">{formatIRR(amount)}</span>}
                    <span className="ledgerTime">{formatTimeOnly(entry.tsISO)}</span>
                    {showExpand && <span className="ledgerExpand">{isExpanded ? '−' : '+'}</span>}
                  </div>

                  {isExpanded && showExpand && (
                    <div className="historyEntryDetails">
                      {entry.details?.boundary && entry.details.boundary !== 'SAFE' && (
                        <div className="statusChange">
                          <span className="statusLabel">Boundary:</span>
                          <span className={`boundaryPill ${entry.details.boundary.toLowerCase()}`}>
                            {BOUNDARY_LABELS[entry.details.boundary]}
                          </span>
                        </div>
                      )}
                      {entry.details?.before && entry.details?.after && (
                        <div className="ledgerImpact">
                          <div className="impactRow">
                            <span className="impactLabel">Portfolio Before</span>
                            <span className="impactValue">{formatIRR(entry.details.before.totalIRR)}</span>
                          </div>
                          <div className="impactRow">
                            <span className="impactLabel">Portfolio After</span>
                            <span className="impactValue">{formatIRR(entry.details.after.totalIRR)}</span>
                          </div>
                          <div className="layerChange">
                            <div className="changeRow">
                              <span className="changeLabel">Before:</span>
                              <span><span className="layerDot foundation"></span> Foundation {Math.round(entry.details.before.layerPct.FOUNDATION)}% · <span className="layerDot growth"></span> Growth {Math.round(entry.details.before.layerPct.GROWTH)}% · <span className="layerDot upside"></span> Upside {Math.round(entry.details.before.layerPct.UPSIDE)}%</span>
                            </div>
                            <div className="changeRow">
                              <span className="changeLabel">After:</span>
                              <span><span className="layerDot foundation"></span> Foundation {Math.round(entry.details.after.layerPct.FOUNDATION)}% · <span className="layerDot growth"></span> Growth {Math.round(entry.details.after.layerPct.GROWTH)}% · <span className="layerDot upside"></span> Upside {Math.round(entry.details.after.layerPct.UPSIDE)}%</span>
                            </div>
                          </div>
                          {/* Show constraint notes for rebalance entries */}
                          {entry.type.replace('_COMMIT', '') === 'REBALANCE' && entry.details?.frictionCopy?.length > 0 && (
                            <div className="impactConstraints">
                              {entry.details.frictionCopy.map((msg, i) => (
                                <div key={i} className="constraintNote">{msg}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default React.memo(HistoryPane);
