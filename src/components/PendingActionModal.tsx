import React, { useState, useMemo, Dispatch } from 'react';
import { formatIRR, formatIRRShort, getAssetDisplayName } from '../helpers';
import { ERROR_MESSAGES, SPREAD_BY_LAYER, DEFAULT_PRICES, DEFAULT_FX_RATE, LOAN_INTEREST_RATE } from '../constants/index';
import { LAYERS, LAYER_EXPLANATIONS } from '../constants/index';
import { ASSET_LAYER } from '../state/domain';
import { calcLiquidationIRR } from '../engine/pricing';
import type { Layer, PendingAction, TargetLayerPct, PortfolioSnapshot, RebalanceTrade, AppAction, AssetId } from '../types';

/**
 * Get spread percentage for an asset based on its layer
 * Disclosed on trade confirmation per Business Review decision
 */
function getSpreadPercent(assetId: string): number {
  const layer = ASSET_LAYER[assetId] as keyof typeof SPREAD_BY_LAYER;
  return ((SPREAD_BY_LAYER as Record<string, number>)[layer] || 0.003) * 100;  // Convert to percentage
}

interface RebalanceTradesSectionProps {
  trades: RebalanceTrade[];
  cashDeployed: number;
}

/**
 * Issue 9: Collapsible rebalance trades section with summary
 */
function RebalanceTradesSection({ trades, cashDeployed }: RebalanceTradesSectionProps) {
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
          {trades.map((trade: RebalanceTrade, i: number) => (
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

interface AllocationImpactVisualProps {
  before: PortfolioSnapshot;
  after: PortfolioSnapshot;
  targetLayerPct: TargetLayerPct;
}

/**
 * AllocationImpactVisual - Shows visual before/after/target for each layer
 * Helps users understand how an action affects their target allocation
 */
function AllocationImpactVisual({ before, after, targetLayerPct }: AllocationImpactVisualProps) {
  // Calculate if moving toward or away from target for each layer
  const layerImpacts = useMemo(() => {
    return (LAYERS as Layer[]).map((layer: Layer) => {
      const beforePct = before.layerPct[layer];
      const afterPct = after.layerPct[layer];
      const targetPct = targetLayerPct?.[layer] ?? 50;

      const beforeDiff = Math.abs(beforePct - targetPct);
      const afterDiff = Math.abs(afterPct - targetPct);
      const movingToward = afterDiff < beforeDiff;
      const change = afterPct - beforePct;

      return {
        layer,
        name: (LAYER_EXPLANATIONS as Record<string, { name: string }>)[layer]?.name || layer,
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

interface PendingActionModalProps {
  pendingAction: PendingAction | null;
  targetLayerPct: TargetLayerPct;
  dispatch: Dispatch<AppAction>;
}

/**
 * PendingActionModal - Preview and confirm modal for pending actions
 *
 * Simple confirmation for: ADD_FUNDS, PROTECT, BORROW, REPAY
 * Full before/after preview for: TRADE, REBALANCE
 */
function PendingActionModal({ pendingAction, targetLayerPct, dispatch }: PendingActionModalProps) {
  if (!pendingAction) return null;

  const { kind, payload, before, after, validation, boundary, frictionCopy, rebalanceMeta } = pendingAction;
  const isValid = validation.ok;

  // Type-safe payload access
  const payloadAny = payload as unknown as Record<string, unknown>;

  // Only TRADE and REBALANCE affect allocation — show full preview for these
  const showFullPreview = kind === 'TRADE' || kind === 'REBALANCE';

  const getTitle = () => {
    switch (kind) {
      case 'ADD_FUNDS': return 'Add Funds';
      case 'TRADE': return `${payloadAny.side === 'BUY' ? 'Buy' : 'Sell'} ${getAssetDisplayName(payloadAny.assetId as string)}`;
      case 'PROTECT': return `Protect ${getAssetDisplayName(payloadAny.assetId as string)}`;
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
              <span className="summaryValue">{formatIRR(payloadAny.amountIRR as number)}</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">New cash balance</span>
              <span className="summaryValue">{formatIRR(after.cashIRR)}</span>
            </div>
          </div>
        );

      case 'PROTECT':
        const premiumPaid = before.cashIRR - after.cashIRR;
        const protectMeta = validation.meta || {};
        const coverageIRR = protectMeta.notionalIRR as number || 0;
        const protectMonths = payloadAny.months as number;
        const protectAssetId = payloadAny.assetId as AssetId;

        // Calculate dates
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + protectMonths);
        const durationDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        // Get strike price in USD (from default prices)
        const strikePriceUSD = (DEFAULT_PRICES as Record<string, number>)[protectAssetId] || 0;

        // Premium as percentage of coverage
        const premiumPct = coverageIRR > 0 ? (premiumPaid / coverageIRR * 100) : 0;

        // Format dates
        const formatDate = (d: Date) => d.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        });

        return (
          <div className="simpleSummary">
            <div className="protectionContractHeader">Protection Contract</div>

            <div className="summaryRow">
              <span className="summaryLabel">Asset</span>
              <span className="summaryValue">{getAssetDisplayName(protectAssetId)}</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Coverage</span>
              <span className="summaryValue">{formatIRR(coverageIRR)}</span>
            </div>
            {strikePriceUSD > 0 && (
              <div className="summaryRow">
                <span className="summaryLabel">Strike price</span>
                <span className="summaryValue">${strikePriceUSD.toLocaleString()} / {protectAssetId}</span>
              </div>
            )}
            <div className="summaryRow">
              <span className="summaryLabel">Duration</span>
              <span className="summaryValue">{durationDays} days</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Start</span>
              <span className="summaryValue">{formatDate(startDate)}</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Expires</span>
              <span className="summaryValue">{formatDate(endDate)}</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Premium</span>
              <span className="summaryValue">{formatIRR(premiumPaid)} ({premiumPct.toFixed(1)}%)</span>
            </div>

            <div className="protectionExplanation">
              If {getAssetDisplayName(protectAssetId)} falls below the strike price during
              coverage, you receive the difference up to the coverage amount.
            </div>
          </div>
        );

      case 'BORROW':
        // Loan model: interest accrues, liquidation when collateral < debt
        const loanAmount = payloadAny.amountIRR as number;
        const durationMonths = payloadAny.durationMonths as number || 3;
        // Get quantity from payload (passed from PREVIEW_BORROW)
        const quantity = payloadAny.collateralQuantity as number || 0;
        // Liquidation happens when collateral value <= loan amount (at creation, no interest yet)
        const liquidationPriceIRR = quantity > 0 ? loanAmount / quantity : 0;
        // Calculate maturity date
        const maturityDate = new Date();
        maturityDate.setMonth(maturityDate.getMonth() + durationMonths);
        const maturityStr = maturityDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        // Calculate total payable (principal + interest)
        const interestAmount = Math.floor(loanAmount * (LOAN_INTEREST_RATE / 12) * durationMonths);
        const totalPayable = loanAmount + interestAmount;
        const collateralAssetName = getAssetDisplayName(payloadAny.assetId as string);

        return (
          <div className="simpleSummary">
            <div className="summaryRow">
              <span className="summaryLabel">Loan amount</span>
              <span className="summaryValue">{formatIRR(loanAmount)}</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Duration</span>
              <span className="summaryValue">{durationMonths} months</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Maturity date</span>
              <span className="summaryValue">{maturityStr}</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Interest rate</span>
              <span className="summaryValue">{Math.round(LOAN_INTEREST_RATE * 100)}% annual</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Total payable</span>
              <span className="summaryValue">{formatIRR(totalPayable)}</span>
            </div>
            <div className="summaryRow">
              <span className="summaryLabel">Collateral</span>
              <span className="summaryValue">{collateralAssetName} 🔒</span>
            </div>
            <div className="summaryRow liquidationPriceRow">
              <span className="summaryLabel">Liquidation price</span>
              <span className="summaryValue warningText">{formatIRRShort(liquidationPriceIRR)} IRR / {payloadAny.assetId as string}</span>
            </div>
          </div>
        );

      case 'REPAY':
        return (
          <div className="simpleSummary">
            <div className="summaryRow">
              <span className="summaryLabel">Repay amount</span>
              <span className="summaryValue">{formatIRR(payloadAny.amountIRR as number)}</span>
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
          {validation.errors.map((e: string, i: number) => (
            <div key={i} className="validationError">
              {(ERROR_MESSAGES as Record<string, string>)[e] || e}
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
            (rebalanceMeta?.hasLockedCollateral || rebalanceMeta?.insufficientCash || (rebalanceMeta?.residualDrift ?? 0) >= 1)
          ) && (
            <div className="rebalanceConstraintWarning">
              <div className="warningIcon">⚠️</div>
              <div className="warningMessages">
                {boundary === 'STRUCTURAL' && frictionCopy.length > 0 ? (
                  frictionCopy.map((msg: string, i: number) => (
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
                    {(rebalanceMeta?.residualDrift ?? 0) >= 1 && (
                      <div className="warningMessage">
                        Remaining drift: {Math.round(rebalanceMeta?.residualDrift ?? 0)}% from target.
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
              {frictionCopy.map((msg: string, i: number) => <div key={i} className="validationWarning">{msg}</div>)}
            </div>
          )}

          {/* Spread disclosure for TRADE - per Business Review decision */}
          {kind === 'TRADE' && (
            <div className="spreadDisclosure">
              Price includes {getSpreadPercent(payloadAny.assetId as string).toFixed(2)}% spread
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
