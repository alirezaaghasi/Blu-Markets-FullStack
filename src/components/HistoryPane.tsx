import React, { useState, useMemo, useCallback } from 'react';
import { formatIRR, formatIRRShort, getAssetDisplayName, formatTimeOnly } from '../helpers';
import type { LedgerEntry, LedgerEntryDetails, PortfolioSnapshot } from '../types';

// Pagination config
const ITEMS_PER_PAGE = 20;

interface GroupedEntries {
  [date: string]: LedgerEntry[];
}

// Cached formatter for legacy entries without precomputed labels
const dateLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/**
 * Helper to group entries by date
 * Uses precomputed tsDateLabel when available (O(1)), falls back to Date parsing for legacy entries
 */
function groupByDate(entries: LedgerEntry[]): GroupedEntries {
  const groups: GroupedEntries = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const entry of entries) {
    // Use precomputed label if available (fast path)
    let label = entry.tsDateLabel;

    // Fallback for legacy entries without precomputed label
    if (!label) {
      const date = new Date(entry.tsISO).toDateString();
      if (date === today) {
        label = 'Today';
      } else if (date === yesterday) {
        label = 'Yesterday';
      } else {
        label = dateLabelFormatter.format(new Date(entry.tsISO));
      }
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }

  return groups;
}

// ============================================================================
// HELPER FUNCTIONS (moved outside component to avoid re-creation per render)
// ============================================================================

const ACTION_ICONS = {
  'PORTFOLIO_CREATED': '✓',
  'ADD_FUNDS': '+',
  'REBALANCE': '⚖️',
  'PROTECT': '☂️',
  'BORROW': '💰',
  'REPAY': '✓',
  'CANCEL_PROTECTION': '✕',
  'PROTECTION_CANCELLED': '✕'
};

const ICON_CLASSES: Record<string, string> = {
  'PORTFOLIO_CREATED': 'action-success',
  'ADD_FUNDS': 'funds-add',
  'REBALANCE': 'action-rebalance',
  'PROTECT': 'action-protect',
  'BORROW': 'action-loan',
  'REPAY': 'action-success',
  'CANCEL_PROTECTION': 'action-cancel',
  'PROTECTION_CANCELLED': 'action-cancel'
};

function getActionIcon(entry: LedgerEntry): string {
  const type = entry.type.replace('_COMMIT', '');
  if (type === 'TRADE') return entry.details?.payload && 'side' in entry.details.payload && entry.details.payload.side === 'BUY' ? '+' : '-';
  return ACTION_ICONS[type as keyof typeof ACTION_ICONS] || '•';
}

function getIconClass(entry: LedgerEntry): string {
  const type = entry.type.replace('_COMMIT', '');
  if (type === 'TRADE') return entry.details?.payload && 'side' in entry.details.payload && entry.details.payload.side === 'BUY' ? 'trade-buy' : 'trade-sell';
  return ICON_CLASSES[type] || '';
}

function formatLedgerAction(entry: LedgerEntry): string {
  const type = entry.type.replace('_COMMIT', '');
  const payload = entry.details?.payload as unknown as Record<string, unknown> | undefined;
  switch (type) {
    case 'PORTFOLIO_CREATED': return 'Portfolio Created';
    case 'ADD_FUNDS': return 'Funds Added';
    case 'TRADE': return `${payload?.side === 'BUY' ? 'Bought' : 'Sold'} ${getAssetDisplayName(payload?.assetId as string)}`;
    case 'REBALANCE': return 'Rebalanced';
    case 'PROTECT': return `Protected ${getAssetDisplayName(payload?.assetId as string)} (${payload?.months}mo)`;
    case 'BORROW': return `Borrowed ${formatIRRShort(payload?.amountIRR as number)} IRR against ${getAssetDisplayName(payload?.assetId as string)}`;
    case 'REPAY': return 'Loan Repaid';
    case 'CANCEL_PROTECTION':
    case 'PROTECTION_CANCELLED': return `Cancelled ${getAssetDisplayName(payload?.assetId as string)} protection`;
    default: return type;
  }
}

function getEntryAmount(entry: LedgerEntry): number | null | undefined {
  const type = entry.type.replace('_COMMIT', '');
  const payload = entry.details?.payload as unknown as Record<string, unknown> | undefined;
  switch (type) {
    case 'PORTFOLIO_CREATED': return entry.details?.amountIRR;
    case 'ADD_FUNDS': return payload?.amountIRR as number | undefined;
    case 'TRADE': return payload?.amountIRR as number | undefined;
    case 'BORROW': return payload?.amountIRR as number | undefined;
    case 'REPAY': return payload?.amountIRR as number | undefined;
    case 'PROTECT': {
      const before = entry.details?.before;
      const after = entry.details?.after;
      if (before && after) return before.cashIRR - after.cashIRR;
      return null;
    }
    case 'REBALANCE': return null;
    default: return null;
  }
}

function hasDetails(entry: LedgerEntry): boolean {
  return !!(entry.details?.before && entry.details?.after);
}

// ============================================================================
// HISTORY ENTRY COMPONENT (memoized for performance)
// ============================================================================

interface HistoryEntryProps {
  entry: LedgerEntry;
  isExpanded: boolean;
  onToggle: (entryId: string) => void;
}

const HistoryEntry = React.memo(function HistoryEntry({ entry, isExpanded, onToggle }: HistoryEntryProps) {
  const amount = getEntryAmount(entry);
  const showExpand = hasDetails(entry);
  const boundary = entry.details?.boundary;
  const boundaryClass = boundary ? boundary.toLowerCase() : '';

  return (
    <div className={`ledgerEntry ${boundaryClass}`}>
      <div
        className="ledgerHeader"
        onClick={() => showExpand && onToggle(entry.id)}
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
                  <span>Foundation {Math.round(entry.details.before.layerPct.FOUNDATION)}% · Growth {Math.round(entry.details.before.layerPct.GROWTH)}% · Upside {Math.round(entry.details.before.layerPct.UPSIDE)}%</span>
                </div>
                <div className="changeRow">
                  <span className="changeLabel">After:</span>
                  <span>Foundation {Math.round(entry.details.after.layerPct.FOUNDATION)}% · Growth {Math.round(entry.details.after.layerPct.GROWTH)}% · Upside {Math.round(entry.details.after.layerPct.UPSIDE)}%</span>
                </div>
              </div>
              {/* Show constraint notes for rebalance entries */}
              {entry.type.replace('_COMMIT', '') === 'REBALANCE' && entry.details?.frictionCopy && entry.details.frictionCopy.length > 0 && (
                <div className="impactConstraints">
                  {entry.details.frictionCopy.map((msg: string, i: number) => (
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
});

/**
 * HistoryPane - Full action history with expandable details
 * Groups entries by date, shows portfolio impact with before/after allocation
 * Optimized with pagination to prevent large DOM renders
 */
interface HistoryPaneProps {
  ledger: LedgerEntry[];
}

function HistoryPane({ ledger }: HistoryPaneProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Memoize reversed ledger
  const reversedLedger = useMemo(
    () => ledger ? [...ledger].reverse() : [],
    [ledger]
  );

  // Paginated entries
  const paginatedEntries = useMemo(
    () => reversedLedger.slice(0, visibleCount),
    [reversedLedger, visibleCount]
  );

  // Memoize grouped entries based on paginated subset
  const grouped = useMemo(
    () => groupByDate(paginatedEntries),
    [paginatedEntries]
  );

  // Stable toggle callback
  const handleToggle = useCallback((entryId: string) => {
    setExpanded(prev => ({ ...prev, [entryId]: !prev[entryId] }));
  }, []);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  }, []);

  const hasMore = reversedLedger.length > visibleCount;

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
            {(items as LedgerEntry[]).map((entry: LedgerEntry) => (
              <HistoryEntry
                key={entry.id}
                entry={entry}
                isExpanded={!!expanded[entry.id]}
                onToggle={handleToggle}
              />
            ))}
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="loadMoreContainer">
          <button className="btn loadMoreBtn" onClick={handleLoadMore}>
            Load more ({reversedLedger.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(HistoryPane);
