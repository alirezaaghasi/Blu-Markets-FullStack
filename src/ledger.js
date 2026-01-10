// Event Ledger - Immutable action log
// All portfolio actions are recorded here for audit and transparency

export function createLedgerEntry(action, result, boundaryLevel = null) {
  return {
    id: generateId(),
    timestamp: Date.now(),
    action: action.type,
    details: sanitizeDetails(action),
    boundaryLevel,
    success: result.success !== false,
    error: result.error || null,
  };
}

function generateId() {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeDetails(action) {
  // Extract relevant details without circular references
  const { type, ...rest } = action;
  return rest;
}

export function appendToLedger(ledger, entry) {
  // Immutable append
  return [...ledger, entry];
}

export function formatLedgerEntry(entry) {
  const date = new Date(entry.timestamp);
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const actionLabels = {
    'BUY': 'Bought',
    'SELL': 'Sold',
    'ADD_FUNDS': 'Deposited',
    'REBALANCE': 'Rebalanced',
    'EXECUTE': 'Portfolio created',
  };

  const label = actionLabels[entry.action] || entry.action;

  let detail = '';
  if (entry.details.asset) {
    detail = `${entry.details.asset}`;
  }
  if (entry.details.amountIRR) {
    detail += ` ${Number(entry.details.amountIRR).toLocaleString('en-US')} IRR`;
  }

  return {
    time,
    label,
    detail,
    success: entry.success,
    boundaryLevel: entry.boundaryLevel,
  };
}

// Ledger analytics
export function getLedgerStats(ledger) {
  const totalActions = ledger.length;
  const byType = {};
  const byBoundary = { SAFE: 0, DRIFT: 0, STRUCTURAL: 0, STRESS: 0 };

  for (const entry of ledger) {
    byType[entry.action] = (byType[entry.action] || 0) + 1;
    if (entry.boundaryLevel) {
      byBoundary[entry.boundaryLevel] = (byBoundary[entry.boundaryLevel] || 0) + 1;
    }
  }

  return { totalActions, byType, byBoundary };
}
