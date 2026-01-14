import React from 'react';
import { formatIRR, getAssetDisplayName } from '../helpers.js';
import { ERROR_MESSAGES, BOUNDARY_LABELS } from '../constants/index.js';

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
                    🛡️{Math.round(before.layerPct.FOUNDATION)}% 📈{Math.round(before.layerPct.GROWTH)}% 🚀{Math.round(before.layerPct.UPSIDE)}%
                  </div>
                  <div className="previewTotal">{formatIRR(before.totalIRR)}</div>
                </div>
                <div className="previewColumn">
                  <div className="previewLabel">After</div>
                  <div className="previewLayers">
                    🛡️{Math.round(after.layerPct.FOUNDATION)}% 📈{Math.round(after.layerPct.GROWTH)}% 🚀{Math.round(after.layerPct.UPSIDE)}%
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

          {/* Show executed trades for rebalance */}
          {kind === 'REBALANCE' && rebalanceMeta && rebalanceMeta.trades && rebalanceMeta.trades.length > 0 && (
            <div className="rebalanceTradesCard">
              <div className="rebalanceTradesHeader">Executed Trades</div>
              <div className="rebalanceTradesList">
                {rebalanceMeta.trades.map((trade, i) => (
                  <div key={i} className="rebalanceTradeRow">
                    <span className={`layerDot ${trade.layer.toLowerCase()}`}></span>
                    <span className="tradeName">{getAssetDisplayName(trade.assetId)}</span>
                    <span className={`tradeAmount ${trade.side === 'SELL' ? 'sell' : 'buy'}`}>
                      {trade.side === 'SELL' ? '-' : '+'}{formatIRR(Math.floor(Math.abs(trade.amountIRR)))}
                    </span>
                  </div>
                ))}
              </div>
              {rebalanceMeta.cashDeployed > 0 && (
                <div className="rebalanceCashSummary">
                  Cash deployed: {formatIRR(Math.floor(rebalanceMeta.cashDeployed))}
                </div>
              )}
            </div>
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
