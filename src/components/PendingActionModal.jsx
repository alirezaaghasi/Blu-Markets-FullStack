import React, { useState } from 'react';
import { formatIRR, formatIRRShort, getAssetDisplayName } from '../helpers.js';
import { ERROR_MESSAGES, BOUNDARY_LABELS } from '../constants/index.js';

/**
 * Issue 9: Collapsible rebalance trades section with summary
 */
function RebalanceTradesSection({ trades, cashDeployed }) {
  const [expanded, setExpanded] = useState(false);

  // Calculate summary stats
  const sells = trades.filter(t => t.side === 'SELL');
  const buys = trades.filter(t => t.side === 'BUY');
  const sellTotal = sells.reduce((sum, t) => sum + Math.abs(t.amountIRR), 0);
  const buyTotal = buys.reduce((sum, t) => sum + Math.abs(t.amountIRR), 0);

  return (
    <div className="rebalanceTradesCard">
      {/* Summary always visible */}
      <div className="rebalanceSummary">
        {sells.length > 0 && (
          <div className="summaryLine sell">Selling {sells.length} asset{sells.length > 1 ? 's' : ''} ({formatIRRShort(sellTotal)})</div>
        )}
        {buys.length > 0 && (
          <div className="summaryLine buy">Buying {buys.length} asset{buys.length > 1 ? 's' : ''} ({formatIRRShort(buyTotal)})</div>
        )}
      </div>

      {/* Expand/collapse toggle */}
      <button className="expandTradesBtn" onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Hide trades ▲' : 'See all trades ▼'}
      </button>

      {/* Detailed trades list when expanded */}
      {expanded && (
        <div className="rebalanceTradesList">
          {trades.map((trade, i) => (
            <div key={i} className="rebalanceTradeRow">
              <span className={`layerDot ${trade.layer.toLowerCase()}`}></span>
              <span className="tradeName">{getAssetDisplayName(trade.assetId)}</span>
              <span className={`tradeAmount ${trade.side === 'SELL' ? 'sell' : 'buy'}`}>
                {trade.side === 'SELL' ? '-' : '+'}{formatIRR(Math.floor(Math.abs(trade.amountIRR)))}
              </span>
            </div>
          ))}
        </div>
      )}

      {cashDeployed > 0 && (
        <div className="rebalanceCashSummary">
          Cash deployed: {formatIRR(Math.floor(cashDeployed))}
        </div>
      )}
    </div>
  );
}

/**
 * PendingActionModal - Preview and confirm modal for pending actions
 *
 * Simple confirmation for: ADD_FUNDS, PROTECT, BORROW, REPAY
 * Full before/after preview for: TRADE, REBALANCE
 */
function PendingActionModal({ pendingAction, dispatch }) {
  if (!pendingAction) return null;

  const { kind, payload, before, after, validation, boundary, frictionCopy, rebalanceMeta } = pendingAction;
  const isValid = validation.ok;

  // Only TRADE and REBALANCE affect allocation — show full preview for these
  const showFullPreview = kind === 'TRADE' || kind === 'REBALANCE';

  const getTitle = () => {
    switch (kind) {
      case 'ADD_FUNDS': return 'Add Funds';
      case 'TRADE': return `${payload.side === 'BUY' ? 'Buy' : 'Sell'} ${getAssetDisplayName(payload.assetId)}`;
      case 'PROTECT': return `Protect ${getAssetDisplayName(payload.assetId)}`;
      case 'BORROW': return 'Borrow';
      case 'REPAY': return 'Repay Loan';
      case 'REBALANCE': return 'Rebalance Portfolio';
      default: return kind;
    }
  };

  // Simple summary for non-allocation-changing actions
  const renderSimpleSummary = () => {
    switch (kind) {
      case 'ADD_FUNDS':
        return (
          <div className="simpleSummary">
            <div className="summaryRow">
              <span className="summaryLabel">Amount</span>
              <span className="summaryValue">{formatIRR(payload.amountIRR)}</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">New cash balance</span>
              <span className="summaryValue">{formatIRR(after.cashIRR)}</span>
            </div>
          </div>
        );

      case 'PROTECT':
        const premiumPaid = before.cashIRR - after.cashIRR;
        return (
          <div className="simpleSummary">
            <div className="summaryRow">
              <span className="summaryLabel">Asset</span>
              <span className="summaryValue">{getAssetDisplayName(payload.assetId)}</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Duration</span>
              <span className="summaryValue">{payload.months} month{payload.months > 1 ? 's' : ''}</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Premium</span>
              <span className="summaryValue">{formatIRR(premiumPaid)}</span>
            </div>
          </div>
        );

      case 'BORROW':
        return (
          <div className="simpleSummary">
            <div className="summaryRow">
              <span className="summaryLabel">Loan amount</span>
              <span className="summaryValue">{formatIRR(payload.amountIRR)}</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Collateral</span>
              <span className="summaryValue">{getAssetDisplayName(payload.assetId)} 🔒</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">New cash balance</span>
              <span className="summaryValue">{formatIRR(after.cashIRR)}</span>
            </div>
          </div>
        );

      case 'REPAY':
        return (
          <div className="simpleSummary">
            <div className="summaryRow">
              <span className="summaryLabel">Repay amount</span>
              <span className="summaryValue">{formatIRR(payload.amountIRR)}</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Remaining cash</span>
              <span className="summaryValue">{formatIRR(after.cashIRR)}</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="previewPanel">
      <div className="previewTitle">{getTitle()}</div>

      {!isValid && (
        <div className="validationDisplay">
          {validation.errors.map((e, i) => (
            <div key={i} className="validationError">
              {ERROR_MESSAGES[e] || e}
            </div>
          ))}
        </div>
      )}

      {isValid && (
        <>
          {/* Simple summary for ADD_FUNDS, PROTECT, BORROW, REPAY */}
          {!showFullPreview && renderSimpleSummary()}

          {/* Full before/after preview for TRADE and REBALANCE */}
          {showFullPreview && (
            <div className="previewCard">
              <div className="previewGrid">
                <div className="previewColumn">
                  <div className="previewLabel">Before</div>
                  <div className="previewLayers">
                    <span className="layerDot foundation"></span> {Math.round(before.layerPct.FOUNDATION)}% · <span className="layerDot growth"></span> {Math.round(before.layerPct.GROWTH)}% · <span className="layerDot upside"></span> {Math.round(before.layerPct.UPSIDE)}%
                  </div>
                  <div className="previewTotal">{formatIRR(before.totalIRR)}</div>
                </div>
                <div className="previewColumn">
                  <div className="previewLabel">After</div>
                  <div className="previewLayers">
                    <span className="layerDot foundation"></span> {Math.round(after.layerPct.FOUNDATION)}% · <span className="layerDot growth"></span> {Math.round(after.layerPct.GROWTH)}% · <span className="layerDot upside"></span> {Math.round(after.layerPct.UPSIDE)}%
                  </div>
                  <div className="previewTotal">{formatIRR(after.totalIRR)}</div>
                </div>
              </div>
              <div className="projectedBoundary">
                <span className="projectedLabel">Boundary:</span>
                <span className={`healthPill ${boundary.toLowerCase()}`}>{BOUNDARY_LABELS[boundary]}</span>
              </div>
            </div>
          )}

          {/* Issue 9: Collapsible rebalance trade preview with summary */}
          {kind === 'REBALANCE' && rebalanceMeta && rebalanceMeta.trades && rebalanceMeta.trades.length > 0 && (
            <RebalanceTradesSection trades={rebalanceMeta.trades} cashDeployed={rebalanceMeta.cashDeployed} />
          )}

          {/* Styled rebalance no trades empty state */}
          {kind === 'REBALANCE' && rebalanceMeta && (!rebalanceMeta.trades || rebalanceMeta.trades.length === 0) && (
            <div className="rebalanceNoTrades">
              <div className="noTradesIcon">✓</div>
              <div className="noTradesText">Portfolio is balanced</div>
              <div className="noTradesHint">No trades needed — you're already at target allocation</div>
            </div>
          )}

          {/* Rebalance-specific constraint warning */}
          {kind === 'REBALANCE' && boundary === 'STRUCTURAL' && frictionCopy.length > 0 && (
            <div className="rebalanceConstraintWarning">
              <div className="warningIcon">⚠️</div>
              <div className="warningMessages">
                {frictionCopy.map((msg, i) => (
                  <div key={i} className="warningMessage">{msg}</div>
                ))}
              </div>
            </div>
          )}

          {/* Friction copy only for TRADE (not rebalance which has its own) */}
          {kind === 'TRADE' && frictionCopy.length > 0 && (
            <div className="validationDisplay">
              {frictionCopy.map((msg, i) => <div key={i} className="validationWarning">{msg}</div>)}
            </div>
          )}
        </>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={() => dispatch({ type: 'CONFIRM_PENDING' })} disabled={!isValid}>Confirm</button>
        <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
      </div>
    </div>
  );
}

export default React.memo(PendingActionModal);
