import React, { useState, useMemo } from 'react';
import { formatIRR, formatIRRShort, getAssetDisplayName } from '../helpers';
import { ERROR_MESSAGES } from '../constants/index';
import { LAYERS, LAYER_EXPLANATIONS } from '../constants/index';

/**
 * Issue 9: Collapsible rebalance trades section with summary
 */
function RebalanceTradesSection({ trades, cashDeployed }) {
  const [expanded, setExpanded] = useState(false);

  // Memoize trade calculations
  const { sells, buys, sellTotal, buyTotal } = useMemo(() => {
    const sellList = [];
    const buyList = [];
    let sellSum = 0;
    let buySum = 0;
    for (const t of trades) {
      if (t.side === 'SELL') {
        sellList.push(t);
        sellSum += Math.abs(t.amountIRR);
      } else {
        buyList.push(t);
        buySum += Math.abs(t.amountIRR);
      }
    }
    return { sells: sellList, buys: buyList, sellTotal: sellSum, buyTotal: buySum };
  }, [trades]);

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
 * AllocationImpactVisual - Shows visual before/after/target for each layer
 * Helps users understand how an action affects their target allocation
 */
function AllocationImpactVisual({ before, after, targetLayerPct }) {
  // Calculate if moving toward or away from target for each layer
  const layerImpacts = useMemo(() => {
    return LAYERS.map(layer => {
      const beforePct = before.layerPct[layer];
      const afterPct = after.layerPct[layer];
      const targetPct = targetLayerPct?.[layer] ?? 50;

      const beforeDiff = Math.abs(beforePct - targetPct);
      const afterDiff = Math.abs(afterPct - targetPct);
      const movingToward = afterDiff < beforeDiff;
      const change = afterPct - beforePct;

      return {
        layer,
        name: LAYER_EXPLANATIONS[layer]?.name || layer,
        beforePct: Math.round(beforePct),
        afterPct: Math.round(afterPct),
        targetPct: Math.round(targetPct),
        movingToward,
        change,
        isOnTarget: afterDiff < 3
      };
    });
  }, [before, after, targetLayerPct]);

  // Overall impact assessment
  const overallImpact = useMemo(() => {
    const improvingCount = layerImpacts.filter(l => l.movingToward).length;
    if (improvingCount === 3) return { label: 'Moves toward target', type: 'positive' };
    if (improvingCount === 0) return { label: 'Moves away from target', type: 'negative' };
    return { label: 'Mixed impact on target', type: 'neutral' };
  }, [layerImpacts]);

  return (
    <div className="allocationImpact">
      <div className="impactHeader">
        <span className="impactTitle">Allocation Impact</span>
        <span className={`impactBadge ${overallImpact.type}`}>{overallImpact.label}</span>
      </div>
      <div className="impactBars">
        {layerImpacts.map(({ layer, name, beforePct, afterPct, targetPct, movingToward, change, isOnTarget }) => (
          <div key={layer} className="impactRow">
            <div className="impactLabel">
              <span className={`layerDot ${layer.toLowerCase()}`}></span>
              <span className="impactLayerName">{name}</span>
            </div>
            <div className="impactBarContainer">
              {/* Target marker line */}
              <div className="targetMarker" style={{ left: `${targetPct}%` }}>
                <div className="targetLine"></div>
                <div className="targetLabel">Target</div>
              </div>
              {/* Before bar (faded) */}
              <div className="beforeBar" style={{ width: `${beforePct}%` }}></div>
              {/* After bar (solid) */}
              <div className={`afterBar ${movingToward ? 'toward' : 'away'}`} style={{ width: `${afterPct}%` }}></div>
            </div>
            <div className="impactValues">
              <span className="beforeValue">{beforePct}%</span>
              <span className={`changeArrow ${movingToward ? 'toward' : 'away'}`}>
                {change > 0 ? '→' : change < 0 ? '→' : '='}
              </span>
              <span className={`afterValue ${isOnTarget ? 'on-target' : ''}`}>{afterPct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * PendingActionModal - Preview and confirm modal for pending actions
 *
 * Simple confirmation for: ADD_FUNDS, PROTECT, BORROW, REPAY
 * Full before/after preview for: TRADE, REBALANCE
 */
function PendingActionModal({ pendingAction, targetLayerPct, dispatch }) {
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

          {/* Full visual allocation impact for TRADE and REBALANCE */}
          {showFullPreview && (
            <AllocationImpactVisual before={before} after={after} targetLayerPct={targetLayerPct} />
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

          {/* Rebalance-specific constraint warning - show if STRUCTURAL or has constraints */}
          {kind === 'REBALANCE' && (
            (boundary === 'STRUCTURAL' && frictionCopy.length > 0) ||
            (rebalanceMeta?.hasLockedCollateral || rebalanceMeta?.insufficientCash || rebalanceMeta?.residualDrift >= 1)
          ) && (
            <div className="rebalanceConstraintWarning">
              <div className="warningIcon">⚠️</div>
              <div className="warningMessages">
                {boundary === 'STRUCTURAL' && frictionCopy.length > 0 ? (
                  frictionCopy.map((msg, i) => (
                    <div key={i} className="warningMessage">{msg}</div>
                  ))
                ) : (
                  <>
                    {rebalanceMeta?.hasLockedCollateral && (
                      <div className="warningMessage">Some assets are locked as collateral for your loans.</div>
                    )}
                    {rebalanceMeta?.insufficientCash && (
                      <div className="warningMessage">Not enough cash to fully balance all layers.</div>
                    )}
                    {rebalanceMeta?.residualDrift >= 1 && (
                      <div className="warningMessage">
                        Remaining drift: {Math.round(rebalanceMeta.residualDrift)}% from target.
                      </div>
                    )}
                  </>
                )}
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
