import React, { useEffect, useMemo, useReducer, useState, useRef } from 'react';

// ====== BLU MARKETS v9.7 REFACTORED ======
// Architecture: Single reducer + deterministic engine
// All actions flow: PREVIEW_* -> pendingAction -> CONFIRM_PENDING -> ledger

// CSS imports
import './styles/app.css';

// Engine imports
import { computeSnapshot } from './engine/snapshot.js';
import { computePortfolioStatus } from './engine/portfolioStatus.js';
import { calcPremiumIRR } from './engine/pricing.js';

// Domain imports
import { ASSET_LAYER } from './state/domain.js';

// Data imports
import questionnaire from './data/questionnaire.fa.json';

// Constants imports
import {
  STAGES,
  LAYER_EXPLANATIONS,
  THRESHOLDS,
  PORTFOLIO_STATUS_LABELS,
  ERROR_MESSAGES,
  COLLATERAL_LTV_BY_LAYER,
} from './constants/index.js';

// Utility imports
import {
  formatIRR,
  formatIRRShort,
  formatTime,
  getAssetDisplayName,
} from './helpers.js';

// Reducer imports
import { reducer, initialState } from './reducers/appReducer.js';

// ====== UI COMPONENTS ======

// Issue 2: DonutChart component for allocation visualization
function DonutChart({ layers, size = 160 }) {
  const total = (layers?.FOUNDATION || 0) + (layers?.GROWTH || 0) + (layers?.UPSIDE || 0);
  if (total === 0) return null;

  const colors = {
    FOUNDATION: '#34d399', // Green
    GROWTH: '#60a5fa',     // Blue
    UPSIDE: '#fbbf24',     // Orange
  };

  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const segments = [];

  ['FOUNDATION', 'GROWTH', 'UPSIDE'].forEach((layer) => {
    const pct = (layers[layer] || 0) / total;
    const length = pct * circumference;

    if (pct > 0) {
      segments.push({
        layer,
        color: colors[layer],
        dasharray: `${length} ${circumference - length}`,
        offset: -currentOffset + circumference * 0.25,
      });
      currentOffset += length;
    }
  });

  return (
    <div className="donutChartContainer">
      <svg viewBox="0 0 120 120" width={size} height={size} className="donutChart">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="12" />
        {segments.map((seg) => (
          <circle
            key={seg.layer}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="12"
            strokeDasharray={seg.dasharray}
            strokeDashoffset={seg.offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.3s ease' }}
          />
        ))}
        <text x="60" y="56" textAnchor="middle" className="donutCenterLabel">Your</text>
        <text x="60" y="72" textAnchor="middle" className="donutCenterLabel">Allocation</text>
      </svg>
    </div>
  );
}

function PortfolioHealthBadge({ snapshot }) {
  if (!snapshot) return null;
  const { status } = computePortfolioStatus(snapshot.layerPct);
  const colorMap = {
    BALANCED: { bg: 'rgba(34,197,94,.15)', border: 'rgba(34,197,94,.3)', color: '#4ade80' },
    SLIGHTLY_OFF: { bg: 'rgba(250,204,21,.15)', border: 'rgba(250,204,21,.3)', color: '#fde047' },
    ATTENTION_REQUIRED: { bg: 'rgba(239,68,68,.15)', border: 'rgba(239,68,68,.3)', color: '#f87171' },
  };
  const colors = colorMap[status] || colorMap.BALANCED;
  return <div className="healthBadge" style={{ background: colors.bg, borderColor: colors.border, color: colors.color }}>{PORTFOLIO_STATUS_LABELS[status]}</div>;
}

function LayerMini({ layer, pct, target }) {
  const info = LAYER_EXPLANATIONS[layer];
  return (
    <div className="mini">
      <div className="layerHeader"><span className={`layerDot ${layer.toLowerCase()}`}></span><span className="tag">{info.name}</span></div>
      <div className="big" style={{ fontSize: 20 }}>{Math.round(pct)}%</div>
      <div className="muted">Target {target}%</div>
    </div>
  );
}

function ActionLogPane({ actionLog }) {
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [actionLog]);
  if (!actionLog || actionLog.length === 0) return <div className="actionLogEmpty"><div className="muted">No actions yet</div></div>;

  // Issue 10: Limit to last 10 actions
  const recentActions = actionLog.slice(-10);

  const renderLogEntry = (entry) => {
    const time = formatTime(entry.timestamp);
    // Fix 6: Add boundary dot indicator for DRIFT/STRUCTURAL
    const boundaryDot = entry.boundary && entry.boundary !== 'SAFE' ? (
      <span className={`logBoundaryDot ${entry.boundary.toLowerCase()}`}></span>
    ) : null;

    if (entry.type === 'REBALANCE') {
      return <span>{boundaryDot}{time}  ⚖️ Rebalanced</span>;
    }
    switch (entry.type) {
      case 'PORTFOLIO_CREATED': return <span>{time}  Started with {formatIRRShort(entry.amountIRR)}</span>;
      case 'ADD_FUNDS': return <span>{boundaryDot}{time}  +{formatIRRShort(entry.amountIRR)} cash</span>;
      case 'TRADE': return <span>{boundaryDot}{time}  {entry.side === 'BUY' ? '+' : '-'}{getAssetDisplayName(entry.assetId)} {formatIRRShort(entry.amountIRR)}</span>;
      case 'BORROW': return <span>{boundaryDot}{time}  💰 Borrowed {formatIRRShort(entry.amountIRR)} against {getAssetDisplayName(entry.assetId)}</span>;
      case 'REPAY': return <span>{boundaryDot}{time}  ✓ Repaid {formatIRRShort(entry.amountIRR)}</span>;
      case 'PROTECT': return <span>{boundaryDot}{time}  ☂️ {getAssetDisplayName(entry.assetId)} protected {entry.months}mo</span>;
      default: return <span>{boundaryDot}{time}  {entry.type}</span>;
    }
  };

  // Fix 6: Add boundary class to log entry for border styling
  const getBoundaryClass = (entry) => {
    if (!entry.boundary || entry.boundary === 'SAFE') return '';
    return entry.boundary.toLowerCase();
  };

  return <div className="actionLog" ref={logRef}>{recentActions.map((entry) => <div key={entry.id} className={`logEntry ${getBoundaryClass(entry)}`}>{renderLogEntry(entry)}</div>)}</div>;
}

function ExecutionSummary({ lastAction, dispatch }) {
  useEffect(() => {
    if (lastAction) {
      const timer = setTimeout(() => dispatch({ type: 'DISMISS_LAST_ACTION' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [lastAction, dispatch]);
  if (!lastAction) return null;

  const formatSummary = () => {
    switch (lastAction.type) {
      case 'PORTFOLIO_CREATED': return '✓ Portfolio created';
      case 'ADD_FUNDS': return `✓ +${formatIRRShort(lastAction.amountIRR)} cash added`;
      case 'TRADE': return `✓ ${lastAction.side === 'BUY' ? 'Bought' : 'Sold'} ${getAssetDisplayName(lastAction.assetId)}`;
      case 'BORROW': return `✓ Borrowed ${formatIRRShort(lastAction.amountIRR)}`;
      case 'REPAY': return '✓ Loan repaid';
      case 'PROTECT': return `✓ ${getAssetDisplayName(lastAction.assetId)} protected`;
      case 'REBALANCE': return '✓ Rebalanced successfully';
      default: return `✓ ${lastAction.type}`;
    }
  };
  return <div className="toast success">{formatSummary()}</div>;
}

function ResetConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="modalOverlay">
      <div className="modal">
        <div className="modalHeader">Reset Portfolio?</div>
        <div className="modalBody"><p className="modalMessage">This will reset your portfolio and start over. All holdings, protections, and loans will be cleared.</p></div>
        <div className="modalFooter"><button className="btn" onClick={onCancel}>Cancel</button><button className="btn danger" onClick={onConfirm}>Yes, Reset</button></div>
      </div>
    </div>
  );
}

function PhoneForm({ state, dispatch }) {
  const isValid = (state.phone || '').startsWith('+989') && (state.phone || '').length === 13;
  return (
    <div>
      <div className="muted" style={{ marginBottom: 10 }}>Sign in</div>
      <div className="row">
        <input className="input" type="tel" placeholder="+989XXXXXXXXX" value={state.phone || ''} onChange={(e) => dispatch({ type: 'SET_PHONE', phone: e.target.value })} />
        <button className="btn primary" onClick={() => dispatch({ type: 'SUBMIT_PHONE' })} disabled={!isValid}>Continue</button>
      </div>
      {state.phone && !isValid && <div className="validationError">+989XXXXXXXXX</div>}
    </div>
  );
}

function OnboardingRightPanel({ stage, questionIndex, targetLayers, investAmount, dispatch }) {
  if (stage === STAGES.WELCOME) {
    return (
      <div className="welcomeScreen">
        <div className="welcomeLogo">B</div>
        <h1 className="welcomeTitle">Welcome</h1>
        <p className="welcomeMotto">Markets, but mindful.</p>
        <div className="welcomeValues">
          <p>Your decisions matter here.</p>
          <p>Build wealth without losing control.</p>
          <p>Take risk without risking everything.</p>
        </div>
        <button className="btn primary welcomeCta" onClick={() => dispatch({ type: 'START_ONBOARDING' })}>Continue</button>
      </div>
    );
  }
  if (stage === STAGES.ONBOARDING_PHONE) {
    return (
      <div className="onboardingPanel">
        <div className="welcomeCard">
          <div className="welcomeIcon">🏦</div>
          <h2>Let's get started</h2>
          <p>Enter your phone number to begin.</p>
        </div>
      </div>
    );
  }
  if (stage === STAGES.ONBOARDING_QUESTIONNAIRE) {
    const progress = (questionIndex / questionnaire.questions.length) * 100;
    return (
      <div className="onboardingPanel">
        <div className="progressCard">
          <h3>Building Your Profile</h3>
          <div className="bigProgress">
            <svg viewBox="0 0 100 100" className="progressRing">
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="6" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="6" strokeDasharray={`${progress * 2.83} 283`} strokeLinecap="round" transform="rotate(-90 50 50)" />
            </svg>
            <div className="progressText">{questionIndex}/{questionnaire.questions.length}</div>
          </div>
        </div>
        <div className="layerPreviewCard">
          <h4>The Three Layers</h4>
          {['FOUNDATION', 'GROWTH', 'UPSIDE'].map(layer => {
            const info = LAYER_EXPLANATIONS[layer];
            return <div key={layer} className="layerPreviewRow"><span className={`layerDot ${layer.toLowerCase()}`} style={{ marginTop: 4 }}></span><div><div className="layerPreviewName">{info.name}</div><div className="layerPreviewDesc">{info.description}</div></div></div>;
          })}
        </div>
      </div>
    );
  }
  if (stage === STAGES.ONBOARDING_RESULT) {
    return (
      <div className="onboardingPanel">
        <div className="allocationPreviewCard">
          {/* Issue 2: Replace allocation bar with donut chart */}
          <DonutChart layers={targetLayers} size={140} />

          <div className="allocationLegend">
            {['FOUNDATION', 'GROWTH', 'UPSIDE'].map((layer) => {
              const info = LAYER_EXPLANATIONS[layer];
              const pct = targetLayers?.[layer] || 0;
              return (
                <div key={layer} className="legendRow">
                  <div className="legendLeft">
                    <span className={`layerDot ${layer.toLowerCase()}`}></span>
                    <span className="legendName">{info.name}</span>
                  </div>
                  <span className="legendPct">{pct}%</span>
                </div>
              );
            })}
          </div>

          <div className="allocationAssets">
            {['FOUNDATION', 'GROWTH', 'UPSIDE'].map((layer) => {
              const info = LAYER_EXPLANATIONS[layer];
              return (
                <div key={layer} className="assetRow">
                  <span className={`layerDot ${layer.toLowerCase()}`}></span>
                  <span className="assetList">{info.assets.join(' · ')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
  if (stage === STAGES.AMOUNT_REQUIRED) {
    const amount = Number(investAmount) || 0;
    const isValid = amount >= THRESHOLDS.MIN_AMOUNT_IRR;
    const hasInput = amount > 0;
    return (
      <div className="onboardingPanel">
        <div className="investPreviewCard">
          <h3>INVESTMENT PREVIEW</h3>

          {/* Issue 3: Show placeholder preview when no amount entered */}
          {!hasInput ? (
            <div className="previewPlaceholder">
              <div className="placeholderTotal">
                <div className="placeholderValue">--- IRR</div>
                <div className="placeholderLabel">Your portfolio value</div>
              </div>

              <div className="placeholderBreakdown">
                {['FOUNDATION', 'GROWTH', 'UPSIDE'].map((layer) => {
                  const info = LAYER_EXPLANATIONS[layer];
                  return (
                    <div key={layer} className="placeholderRow">
                      <div className="placeholderLeft">
                        <span className={`layerDot ${layer.toLowerCase()} faded`}></span>
                        <span className="placeholderName">{info.name}</span>
                      </div>
                      <span className="placeholderAmount">---</span>
                    </div>
                  );
                })}
              </div>

              <div className="placeholderHint">
                Select an amount to see your allocation
              </div>
            </div>
          ) : (
            <>
              <div className="investTotal">
                <div className="portfolioValue">{formatIRR(amount)}</div>
                {!isValid && <div className="investWarning">Minimum: {formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}</div>}
              </div>
              {isValid && (
                <>
                  {/* Fix 4: Mini donut chart in investment preview */}
                  <div className="investPreviewDonut">
                    <DonutChart layers={targetLayers} size={100} />
                  </div>
                  <div className="investBreakdown">
                    {['FOUNDATION', 'GROWTH', 'UPSIDE'].map((layer) => {
                      const info = LAYER_EXPLANATIONS[layer];
                      const pct = targetLayers?.[layer] || 0;
                      const layerAmount = Math.floor(amount * pct / 100);
                      return (
                        <div key={layer} className="breakdownRow">
                          <div className="breakdownLeft">
                            <span className={`layerDot ${layer.toLowerCase()}`}></span>
                            <span>{info.name}</span>
                          </div>
                          <span className="breakdownAmount">{formatIRR(layerAmount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
}

function Tabs({ tab, dispatch }) {
  return (
    <div className="tabs" style={{ padding: '0 14px 10px' }}>
      {['PORTFOLIO', 'PROTECTION', 'LOANS', 'HISTORY'].map((t) => {
        const labels = { PORTFOLIO: 'Portfolio', PROTECTION: 'Protection', LOANS: 'Loans', HISTORY: 'History' };
        return <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_TAB', tab: t })}>{labels[t]}</div>;
      })}
    </div>
  );
}

// Issue 12: Helper to group entries by date
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

// Issue 12: Format time only (since date is in header)
function formatTimeOnly(timestamp) {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function HistoryPane({ ledger }) {
  const [expanded, setExpanded] = useState({});

  // Issue 9: Empty state with rich placeholder
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
    const icons = { 'PORTFOLIO_CREATED': '✓', 'ADD_FUNDS': '+', 'REBALANCE': '⚖️', 'PROTECT': '☂️', 'BORROW': '💰', 'REPAY': '✓' };
    return icons[type] || '•';
  };

  const getIconClass = (entry) => {
    const type = entry.type.replace('_COMMIT', '');
    if (type === 'TRADE') return entry.details?.payload?.side === 'BUY' ? 'trade-buy' : 'trade-sell';
    const classes = { 'PORTFOLIO_CREATED': 'action-success', 'ADD_FUNDS': 'funds-add', 'REBALANCE': 'action-rebalance', 'PROTECT': 'action-protect', 'BORROW': 'action-loan', 'REPAY': 'action-success' };
    return classes[type] || '';
  };

  // Issue 7 & 8: Format action text with amounts
  const formatLedgerAction = (entry) => {
    const type = entry.type.replace('_COMMIT', '');
    const payload = entry.details?.payload;
    switch (type) {
      case 'PORTFOLIO_CREATED': return 'Portfolio Created';
      case 'ADD_FUNDS': return 'Funds Added';
      case 'TRADE': return `${payload?.side === 'BUY' ? 'Bought' : 'Sold'} ${getAssetDisplayName(payload?.assetId)}`;
      case 'REBALANCE': return 'Rebalanced';
      case 'PROTECT': return `Protected ${getAssetDisplayName(payload?.assetId)} (${payload?.months}mo)`;
      // Issue 8: Borrowed format
      case 'BORROW': return `Borrowed ${formatIRRShort(payload?.amountIRR)} IRR against ${getAssetDisplayName(payload?.assetId)}`;
      case 'REPAY': return 'Loan Repaid';
      default: return type;
    }
  };

  // Issue 7: Get amount for entry
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
      case 'REBALANCE': return null; // No amount for rebalance
      default: return null;
    }
  };

  // Issue 9 & 11: Check if entry has expandable details
  const hasDetails = (entry) => {
    const boundary = entry.details?.boundary;
    const before = entry.details?.before;
    const after = entry.details?.after;
    // Has details if boundary is not SAFE or if there's a status change
    return (boundary && boundary !== 'SAFE') || (before && after);
  };

  // Issue 12: Group entries by date
  const grouped = groupByDate([...ledger].reverse());

  return (
    <div className="card">
      <h3>Action History</h3>
      {/* Issue 9: Ledger intro text */}
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

              // Get boundary class for ledger entry styling
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
                    {/* Issue 7: Show amount */}
                    {amount && <span className="ledgerAmount">{formatIRR(amount)}</span>}
                    {/* Issue 12: Show time only (date in header) */}
                    <span className="ledgerTime">{formatTimeOnly(entry.tsISO)}</span>
                    {/* Issue 11: Only show expand if details exist */}
                    {showExpand && <span className="ledgerExpand">{isExpanded ? '−' : '+'}</span>}
                  </div>
                  {/* Issue 9: Status badges in expandable details with portfolio impact */}
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
                              <span>🛡️{Math.round(entry.details.before.layerPct.FOUNDATION)}% 📈{Math.round(entry.details.before.layerPct.GROWTH)}% 🚀{Math.round(entry.details.before.layerPct.UPSIDE)}%</span>
                            </div>
                            <div className="changeRow">
                              <span className="changeLabel">After:</span>
                              <span>🛡️{Math.round(entry.details.after.layerPct.FOUNDATION)}% 📈{Math.round(entry.details.after.layerPct.GROWTH)}% 🚀{Math.round(entry.details.after.layerPct.UPSIDE)}%</span>
                            </div>
                          </div>
                          {/* Issue 9: Show constraint notes for rebalance entries */}
                          {entry.type.replace('_COMMIT', '') === 'REBALANCE' && entry.details?.frictionCopy?.length > 0 && (
                            <div className="impactConstraints">
                              {entry.details.frictionCopy.map((msg, i) => (
                                <div key={i} className="constraintNote">{msg}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="ledgerId">ID: {entry.id}</div>
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

// Issue 6 & 7: HoldingRow component with overflow menu and layer-colored border
function HoldingRow({ holding, layerInfo, layer, protDays, onStartTrade, onStartProtect, onStartBorrow }) {
  const [showOverflow, setShowOverflow] = useState(false);
  const isEmpty = holding.valueIRR === 0;

  // Close overflow when clicking outside
  useEffect(() => {
    if (showOverflow) {
      const handleClick = () => setShowOverflow(false);
      setTimeout(() => document.addEventListener('click', handleClick), 0);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showOverflow]);

  return (
    <div className={`holdingRow layer-${layer.toLowerCase()} ${isEmpty ? 'assetEmpty' : ''}`}>
      <div className="holdingInfo">
        <div className="holdingName">{getAssetDisplayName(holding.assetId)}</div>
        <div className="holdingLayer">
          <span className={`layerDot ${layer.toLowerCase()}`}></span>
          {layerInfo.name}
          {protDays !== null ? ` · ☂️ Protected (${protDays}d)` : ''}
          {holding.frozen ? ` · 🔒 Locked` : ''}
        </div>
      </div>

      <div className="holdingValue">{formatIRR(holding.valueIRR)}</div>

      <div className="holdingActions">
        <button className="btn small" onClick={() => onStartTrade(holding.assetId, 'BUY')}>Buy</button>
        <button className="btn small" disabled={holding.frozen || isEmpty} onClick={() => onStartTrade(holding.assetId, 'SELL')}>Sell</button>

        <div className="overflowContainer">
          <button className="btn small overflowTrigger" onClick={(e) => { e.stopPropagation(); setShowOverflow(!showOverflow); }}>⋯</button>

          {showOverflow && (
            <div className="overflowMenu" onClick={(e) => e.stopPropagation()}>
              <button
                className="overflowItem"
                onClick={() => { onStartProtect?.(holding.assetId); setShowOverflow(false); }}
                disabled={isEmpty}
              >
                <span className="overflowIcon">☂️</span>
                Protect
              </button>
              <button
                className="overflowItem"
                onClick={() => { onStartBorrow?.(holding.assetId); setShowOverflow(false); }}
                disabled={isEmpty || holding.frozen}
              >
                <span className="overflowIcon">💰</span>
                Borrow
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PortfolioHome({ state, snapshot, onStartTrade, onStartProtect, onStartBorrow }) {
  if (snapshot.holdingsIRR === 0 && state.cashIRR === 0) {
    return <div className="card"><h3>Portfolio</h3><div className="muted">Complete onboarding to create your portfolio.</div></div>;
  }

  const getProtectionDays = (assetId) => {
    const p = (state.protections || []).find(x => x.assetId === assetId);
    if (!p) return null;
    const now = Date.now();
    const until = new Date(p.endISO).getTime();
    return Math.max(0, Math.ceil((until - now) / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="stack">
      <div className="portfolioValueCard">
        <div className="portfolioValueLabel">PORTFOLIO VALUE</div>
        <div className="portfolioValueAmount">{formatIRR(snapshot.totalIRR)}</div>
        <div className="portfolioBreakdown">
          <div className="breakdownCard">
            <div className="breakdownCardIcon">📊</div>
            <div className="breakdownCardLabel">Invested</div>
            <div className="breakdownCardValue">{formatIRR(snapshot.holdingsIRR)}</div>
          </div>
          <div className="breakdownCard">
            <div className="breakdownCardIcon">💵</div>
            <div className="breakdownCardLabel">Cash</div>
            <div className="breakdownCardValue">{formatIRR(snapshot.cashIRR)}</div>
          </div>
        </div>
        {/* Fix 5: Loan health indicator - shows summary when loans exist */}
        {(state.loans || []).length > 0 && (() => {
          const loans = state.loans || [];
          const totalLoanAmount = loans.reduce((sum, l) => sum + l.amountIRR, 0);
          // Find the most critical loan (highest LTV ratio)
          const mostCriticalLoan = loans.reduce((worst, loan) => {
            const ratio = loan.amountIRR / loan.liquidationIRR;
            const worstRatio = worst ? worst.amountIRR / worst.liquidationIRR : 0;
            return ratio > worstRatio ? loan : worst;
          }, null);
          const criticalRatio = mostCriticalLoan ? mostCriticalLoan.amountIRR / mostCriticalLoan.liquidationIRR : 0;
          return (
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>💰 Active Loans ({loans.length})</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{formatIRR(totalLoanAmount)}</span>
              </div>
              <div className="loanHealthIndicator">
                <div className="loanHealthBar">
                  <div
                    className={`loanHealthFill ${
                      criticalRatio > 0.75 ? 'critical' :
                      criticalRatio > 0.6 ? 'warning' : 'healthy'
                    }`}
                    style={{ width: `${Math.min(100, criticalRatio * 100)}%` }}
                  />
                </div>
                <span className={`loanHealthText ${
                  criticalRatio > 0.75 ? 'critical' :
                  criticalRatio > 0.6 ? 'warning' : 'healthy'
                }`}>
                  {Math.round(criticalRatio * 100)}%
                </span>
              </div>
            </div>
          );
        })()}
      </div>
      <div className="card">
        <div className="sectionTitle">ASSET ALLOCATION</div>
        <div className="grid3">
          {['FOUNDATION', 'GROWTH', 'UPSIDE'].map(layer => (
            <LayerMini key={layer} layer={layer} pct={snapshot.layerPct[layer]} target={state.targetLayerPct[layer]} />
          ))}
        </div>
      </div>
      <div className="card">
        <h3>HOLDINGS</h3>
        {/* Fix 7: Group holdings by layer with section headers */}
        {['FOUNDATION', 'GROWTH', 'UPSIDE'].map(layer => {
          const layerHoldings = state.holdings.filter(h => ASSET_LAYER[h.assetId] === layer);
          if (layerHoldings.length === 0) return null;
          const layerInfo = LAYER_EXPLANATIONS[layer];
          return (
            <div key={layer} className="layerSection">
              <div className="layerSectionHeader">
                <span className={`layerDot ${layer.toLowerCase()}`}></span>
                <span className="layerSectionTitle">{layerInfo.name} Assets</span>
                <span className="layerSectionCount">{layerHoldings.length}</span>
              </div>
              <div className="holdingsList">
                {layerHoldings.map((h) => {
                  const protDays = getProtectionDays(h.assetId);
                  return (
                    <HoldingRow
                      key={h.assetId}
                      holding={h}
                      layerInfo={layerInfo}
                      layer={layer}
                      protDays={protDays}
                      onStartTrade={onStartTrade}
                      onStartProtect={onStartProtect}
                      onStartBorrow={onStartBorrow}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Protection({ protections }) {
  const list = protections || [];
  const getDaysRemaining = (endISO) => {
    const now = Date.now();
    const until = new Date(endISO).getTime();
    return Math.max(0, Math.ceil((until - now) / (1000 * 60 * 60 * 24)));
  };

  // Fix 9: Calculate progress percentage for protection
  const getProgressPct = (startISO, endISO) => {
    const now = Date.now();
    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();
    const totalDuration = end - start;
    const elapsed = now - start;
    const remaining = Math.max(0, 100 - (elapsed / totalDuration) * 100);
    return Math.min(100, Math.max(0, remaining));
  };

  return (
    <div className="card">
      <h3>Active Protections</h3>
      {list.length === 0 ? (
        <div className="muted">No assets protected.</div>
      ) : (
        <div className="list">
          {list.map((p, idx) => {
            const layer = ASSET_LAYER[p.assetId];
            const info = LAYER_EXPLANATIONS[layer];
            const daysLeft = getDaysRemaining(p.endISO);
            const progressPct = getProgressPct(p.startISO || p.tsISO, p.endISO);
            const totalDays = p.durationMonths ? p.durationMonths * 30 : 90; // Estimate if not stored
            return (
              <div key={p.id || idx} className="item protectionItem">
                <div style={{ flex: 1 }}>
                  <div className="asset">☂️ {getAssetDisplayName(p.assetId)}</div>
                  <div className="muted"><span className={`layerDot ${layer.toLowerCase()}`} style={{ marginRight: 6 }}></span>{info?.name}</div>
                  {/* Fix 9: Progress bar for protection days */}
                  <div className="protectionProgress">
                    <div className="protectionProgressBar">
                      <div className="protectionProgressFill" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="protectionProgressText">
                      <span>{daysLeft} days remaining</span>
                      <span>{Math.round(progressPct)}% left</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="asset">{formatIRR(p.premiumIRR)}</div>
                  <div className="muted">Premium paid</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Loans({ loans, dispatch }) {
  const loanList = loans || [];

  if (loanList.length === 0) {
    return <div className="card"><h3>Active Loans</h3><div className="muted">No active loans.</div></div>;
  }

  const getLoanStatus = (loan) => {
    const ltvPercent = (loan.amountIRR / loan.liquidationIRR) * 100;
    if (ltvPercent > 75) return { level: 'critical', message: '🔴 Liquidation risk — repay or add collateral' };
    if (ltvPercent > 60) return { level: 'warning', message: '⚠️ Monitor collateral' };
    return null;
  };

  const totalLoanAmount = loanList.reduce((sum, l) => sum + l.amountIRR, 0);

  return (
    <div className="card">
      <h3>Active Loans ({loanList.length})</h3>
      {loanList.length > 1 && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total borrowed: </span>
          <span style={{ fontWeight: 600 }}>{formatIRR(totalLoanAmount)}</span>
        </div>
      )}
      <div className="list">
        {loanList.map((loan) => {
          const status = getLoanStatus(loan);
          return (
            <div key={loan.id} className="item loanItem" style={{ marginBottom: 12, padding: '12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="loanAmount">{formatIRR(loan.amountIRR)}</div>
                  <div className="loanDetails">Collateral: {getAssetDisplayName(loan.collateralAssetId)}</div>
                  <div className="loanUsage">LTV: {Math.round(loan.ltv * 100)}%</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="liquidationValue">{formatIRR(loan.liquidationIRR)}</div>
                  <div className="muted">Liquidation</div>
                </div>
              </div>
              {status && (
                <div className={`loanStatus loanStatus${status.level.charAt(0).toUpperCase() + status.level.slice(1)}`} style={{ marginBottom: 8 }}>
                  {status.message}
                </div>
              )}
              <button className="btn primary" style={{ width: '100%' }} onClick={() => dispatch({ type: 'START_REPAY', loanId: loan.id })}>Repay</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionCard({ title, children }) {
  return <div className="actionCard"><div className="actionTitle">{title}</div>{children}</div>;
}

function PendingActionModal({ pendingAction, dispatch }) {
  if (!pendingAction) return null;

  const { kind, payload, before, after, validation, boundary, frictionCopy, rebalanceMeta } = pendingAction;
  const isValid = validation.ok;

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

          {/* R-1: Show executed trades for rebalance */}
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

          {/* Fix 8: Styled rebalance no trades empty state */}
          {kind === 'REBALANCE' && rebalanceMeta && (!rebalanceMeta.trades || rebalanceMeta.trades.length === 0) && (
            <div className="rebalanceNoTrades">
              <div className="noTradesIcon">✓</div>
              <div className="noTradesText">Portfolio is balanced</div>
              <div className="noTradesHint">No trades needed — you're already at target allocation</div>
            </div>
          )}

          {/* Issue 8: Rebalance-specific constraint warning */}
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

          {/* Standard friction copy for non-rebalance actions */}
          {!(kind === 'REBALANCE' && boundary === 'STRUCTURAL') && frictionCopy.length > 0 && (
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

function OnboardingControls({ state, dispatch }) {
  const [consentText, setConsentText] = useState('');
  const isConsentMatch = consentText === questionnaire.consent_exact;

  if (state.stage === STAGES.WELCOME) return <div className="muted" style={{ textAlign: 'center', padding: 8 }}>Begin your mindful journey</div>;

  if (state.stage === STAGES.ONBOARDING_PHONE) return <PhoneForm state={state} dispatch={dispatch} />;

  if (state.stage === STAGES.ONBOARDING_QUESTIONNAIRE) {
    const idx = state.questionnaire.index;
    if (idx >= questionnaire.questions.length) return null;
    const q = questionnaire.questions[idx];
    return (
      <div>
        <div className="questionnaireHeader"><span className="muted">{idx + 1}/{questionnaire.questions.length}</span></div>
        <div className="q-card">
          <div className="q-title">{q.text}</div>
          <div className="q-english">{q.english}</div>
          <div className="q-options">
            {q.options.map((opt) => (
              <button key={opt.id} className="opt" onClick={() => dispatch({ type: 'ANSWER_QUESTION', qId: q.id, optionId: opt.id })}>
                {opt.text}
                <div className="opt-english">{opt.english}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state.stage === STAGES.ONBOARDING_RESULT) {
    // Render recommendation message with colored layer dots
    const renderRecommendationMessage = () => (
      <div className="recommendationMessage">
        <p>Based on your answers, here's your recommended allocation:</p>
        <div className="recommendationLayers">
          <div className="recommendationLayer">
            <span className="layerDot foundation"></span>
            <span>Foundation ({state.targetLayerPct.FOUNDATION}%) — Stable assets</span>
          </div>
          <div className="recommendationLayer">
            <span className="layerDot growth"></span>
            <span>Growth ({state.targetLayerPct.GROWTH}%) — Balanced growth</span>
          </div>
          <div className="recommendationLayer">
            <span className="layerDot upside"></span>
            <span>Upside ({state.targetLayerPct.UPSIDE}%) — Higher potential</span>
          </div>
        </div>
        <p>This balances protection with growth.</p>
      </div>
    );

    const CONSENT_STEPS = [
      {
        id: 'recommendation',
        message: null, // Will use custom renderer
        renderMessage: renderRecommendationMessage,
        button: 'Continue'
      },
      {
        id: 'risk',
        message: `With this allocation:\n\n📈 Good year: +15-25%\n📉 Bad quarter: -10-15%\n⏱️ Recovery: typically 3-6 months\n\nMarkets are uncertain. This is not a guarantee.`,
        button: 'I understand'
      },
      {
        id: 'control',
        message: `You're always in control:\n\n✓ Adjust allocation anytime\n✓ Protect assets against drops\n✓ Borrow without selling\n✓ Exit to cash whenever`,
        button: 'Continue'
      },
      {
        id: 'consent',
        message: `Ready to start? Type this to confirm:`,
        consentRequired: true
      }
    ];

    const currentStep = state.consentStep;
    const step = CONSENT_STEPS[currentStep];
    const isConsentStep = currentStep >= CONSENT_STEPS.length - 1;

    // Render a stored message (may be string or needs special handling for recommendation)
    const renderStoredMessage = (msg, idx) => {
      // Check if this is the recommendation message marker
      if (msg === '__RECOMMENDATION__') {
        return (
          <div key={idx} className="chatMessage bot">
            <div className="messageContent">{renderRecommendationMessage()}</div>
          </div>
        );
      }
      return (
        <div key={idx} className="chatMessage bot">
          <div className="messageContent">{msg}</div>
        </div>
      );
    };

    return (
      <div className="consentFlow">
        <div className="chatMessages">
          {state.consentMessages.map((msg, i) => renderStoredMessage(msg, i))}
          {step && !isConsentStep && (
            <div className="chatMessage bot">
              <div className="messageContent">
                {step.renderMessage ? step.renderMessage() : step.message}
              </div>
            </div>
          )}
        </div>
        <div className="chatInputArea">
          {!isConsentStep && step ? (
            <button className="btn primary" style={{ width: '100%' }} onClick={() => dispatch({ type: 'ADVANCE_CONSENT', message: step.renderMessage ? '__RECOMMENDATION__' : step.message })}>{step.button}</button>
          ) : null}

          {/* Issue 1: Consent input always visible once we reach consent step */}
          {isConsentStep && (
            <div className="consentInputSection">
              <div className="consentPrompt">Ready to start? Type this to confirm:</div>
              <div className="consentTextFarsi">{questionnaire.consent_exact}</div>
              <div className="consentTextEnglish">{questionnaire.consent_english}</div>

              <input
                type="text"
                className="consentInput"
                placeholder="Type the Farsi sentence above to confirm..."
                value={consentText}
                onChange={(e) => setConsentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && isConsentMatch) dispatch({ type: 'SUBMIT_CONSENT', text: consentText }); }}
                dir="rtl"
              />

              <button
                className={`btn primary ${isConsentMatch ? '' : 'disabled'}`}
                onClick={() => dispatch({ type: 'SUBMIT_CONSENT', text: consentText })}
                disabled={!isConsentMatch}
                style={{ width: '100%' }}
              >
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state.stage === STAGES.AMOUNT_REQUIRED) {
    const amount = Number(state.investAmountIRR) || 0;
    const isValid = amount >= THRESHOLDS.MIN_AMOUNT_IRR;
    const presetAmounts = [10_000_000, 50_000_000, 100_000_000, 500_000_000];
    const formatPreset = (val) => {
      if (val >= 1_000_000_000) return `${val / 1_000_000_000}B`;
      if (val >= 1_000_000) return `${val / 1_000_000}M`;
      return val.toLocaleString();
    };
    return (
      <div>
        <div className="investHeader">
          <h3>Let's bring your portfolio to life.</h3>
          <p className="muted">How much would you like to start with?</p>
        </div>
        {/* Issue 5: Quick amount buttons with selected state */}
        <div className="quickAmounts">
          {presetAmounts.map(preset => (
            <button
              key={preset}
              className={`quickAmountBtn ${amount === preset ? 'selected' : ''}`}
              onClick={() => dispatch({ type: 'SET_INVEST_AMOUNT', amountIRR: preset })}
            >
              {formatPreset(preset)}
            </button>
          ))}
        </div>
        <div className="customAmount">
          <input className="input" type="text" placeholder="Or enter custom amount" value={amount ? amount.toLocaleString() : ''} onChange={(e) => { const val = parseInt(e.target.value.replace(/,/g, ''), 10); if (!isNaN(val)) dispatch({ type: 'SET_INVEST_AMOUNT', amountIRR: val }); else if (e.target.value === '') dispatch({ type: 'SET_INVEST_AMOUNT', amountIRR: null }); }} />
        </div>
        <p className="investReassurance">You can add more anytime. No lock-in.</p>
        {/* Issue 4: Dynamic button text based on state */}
        <button
          className={`btn primary ${isValid ? '' : 'disabled'}`}
          style={{ width: '100%' }}
          onClick={() => dispatch({ type: 'EXECUTE_PORTFOLIO' })}
          disabled={!isValid}
        >
          {isValid ? 'Start Investing' : 'Enter amount to start'}
        </button>
      </div>
    );
  }

  // ACTIVE stage - show drafts or pendingAction
  if (state.pendingAction) {
    return <PendingActionModal pendingAction={state.pendingAction} dispatch={dispatch} />;
  }

  // Draft forms
  if (state.addFundsDraft) {
    return (
      <ActionCard title="Add Funds">
        <input className="input" type="number" placeholder="Amount (IRR)" value={state.addFundsDraft.amountIRR || ''} onChange={(e) => dispatch({ type: 'SET_ADD_FUNDS_AMOUNT', amountIRR: e.target.value })} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_ADD_FUNDS' })} disabled={!state.addFundsDraft.amountIRR}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  if (state.tradeDraft) {
    return (
      <ActionCard title={`${state.tradeDraft.side === 'BUY' ? 'Buy' : 'Sell'} ${getAssetDisplayName(state.tradeDraft.assetId)}`}>
        <div className="row" style={{ gap: 8 }}>
          <button className={`chip ${state.tradeDraft.side === 'BUY' ? 'primary' : ''}`} onClick={() => dispatch({ type: 'SET_TRADE_SIDE', side: 'BUY' })}>Buy</button>
          <button className={`chip ${state.tradeDraft.side === 'SELL' ? 'primary' : ''}`} onClick={() => dispatch({ type: 'SET_TRADE_SIDE', side: 'SELL' })}>Sell</button>
        </div>
        <input className="input" style={{ marginTop: 8 }} type="number" placeholder="Amount (IRR)" value={state.tradeDraft.amountIRR ?? ''} onChange={(e) => dispatch({ type: 'SET_TRADE_AMOUNT', amountIRR: e.target.value })} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_TRADE' })} disabled={!state.tradeDraft.amountIRR}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  if (state.protectDraft) {
    const h = state.holdings.find(x => x.assetId === state.protectDraft.assetId);
    const premium = h ? calcPremiumIRR({ assetId: h.assetId, notionalIRR: h.valueIRR, months: state.protectDraft.months }) : 0;
    return (
      <ActionCard title="☂️ Protect Asset">
        <div className="row" style={{ gap: 8 }}>
          <select className="input" value={state.protectDraft.assetId || ''} onChange={(e) => dispatch({ type: 'SET_PROTECT_ASSET', assetId: e.target.value })}>
            {state.holdings.filter(h => h.valueIRR > 0).map((h) => {
              const layer = ASSET_LAYER[h.assetId];
              const info = LAYER_EXPLANATIONS[layer];
              return <option key={h.assetId} value={h.assetId}>{info.icon} {getAssetDisplayName(h.assetId)}</option>;
            })}
          </select>
          <select className="input" value={state.protectDraft.months ?? 3} onChange={(e) => dispatch({ type: 'SET_PROTECT_MONTHS', months: Number(e.target.value) })} style={{ width: 100 }}>
            {[1, 2, 3, 4, 5, 6].map((m) => <option key={m} value={m}>{m} mo</option>)}
          </select>
        </div>
        <div className="premiumHint">Premium: {formatIRR(premium)}</div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_PROTECT' })}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  if (state.borrowDraft) {
    const h = state.holdings.find(x => x.assetId === state.borrowDraft.assetId);
    const layer = h ? ASSET_LAYER[h.assetId] : 'UPSIDE';
    const layerLtv = COLLATERAL_LTV_BY_LAYER[layer] || 0.3;
    const maxBorrow = h ? Math.floor(h.valueIRR * layerLtv) : 0;
    const layerInfo = LAYER_EXPLANATIONS[layer];
    return (
      <ActionCard title="💰 Borrow">
        <select className="input" value={state.borrowDraft.assetId || ''} onChange={(e) => dispatch({ type: 'SET_BORROW_ASSET', assetId: e.target.value })}>
          {state.holdings.filter(h => !h.frozen && h.valueIRR > 0).map((h) => {
            const assetLayer = ASSET_LAYER[h.assetId];
            const info = LAYER_EXPLANATIONS[assetLayer];
            const ltv = COLLATERAL_LTV_BY_LAYER[assetLayer] || 0.3;
            return <option key={h.assetId} value={h.assetId}>{info.icon} {getAssetDisplayName(h.assetId)} ({Math.round(ltv * 100)}% LTV)</option>;
          })}
        </select>
        <div className="borrowLtvInfo" style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{layerInfo?.icon} {layerInfo?.name} assets: </span>
          <span style={{ fontWeight: 600 }}>{Math.round(layerLtv * 100)}% max LTV</span>
        </div>
        <input className="input" style={{ marginTop: 8 }} type="number" placeholder="Loan amount (IRR)" value={state.borrowDraft.amountIRR ?? ''} onChange={(e) => dispatch({ type: 'SET_BORROW_AMOUNT', amountIRR: e.target.value })} />
        <div className="borrowHint">Max: {formatIRR(maxBorrow)}</div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_BORROW' })} disabled={!state.borrowDraft.amountIRR}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  if (state.repayDraft) {
    const loan = (state.loans || []).find(l => l.id === state.repayDraft.loanId);
    const loanAmount = loan?.amountIRR || state.repayDraft.amountIRR || 0;
    return (
      <ActionCard title="Repay Loan">
        <div className="repayDetails">
          <div className="repayRow"><span>Loan:</span><span>{formatIRR(loanAmount)}</span></div>
          {loan && <div className="repayRow"><span>Collateral:</span><span>{getAssetDisplayName(loan.collateralAssetId)}</span></div>}
          <div className="repayRow"><span>Cash:</span><span>{formatIRR(state.cashIRR || 0)}</span></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_REPAY' })} disabled={(state.cashIRR || 0) < loanAmount}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  if (state.rebalanceDraft) {
    return (
      <ActionCard title="Rebalance">
        <div className="muted">Reallocate assets to target. Cash will be deployed to underweight layers.</div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_REBALANCE' })}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  // Main action buttons
  return (
    <div>
      <div className="footerActions">
        <div className="footerRowPrimary">
          <button className="btn primary" onClick={() => dispatch({ type: 'START_ADD_FUNDS' })}>Add Funds</button>
          <button className="btn" onClick={() => dispatch({ type: 'START_REBALANCE' })}>Rebalance</button>
          <button className="btn" onClick={() => dispatch({ type: 'START_PROTECT' })}>☂️ Protect</button>
          <button className="btn" onClick={() => dispatch({ type: 'START_BORROW' })}>💰 Borrow</button>
        </div>
        <div className="footerRowSecondary">
          <button className="btn resetBtn" onClick={() => dispatch({ type: 'SHOW_RESET_CONFIRM' })}>↺ Reset</button>
        </div>
      </div>
    </div>
  );
}

// Issue 6: Contextual header based on tab
function getHeaderContent(activeTab, state, snapshot) {
  switch (activeTab) {
    case 'PORTFOLIO': {
      const { status } = computePortfolioStatus(snapshot.layerPct);
      const needsRebalance = status === 'SLIGHTLY_OFF' || status === 'ATTENTION_REQUIRED';
      return {
        title: 'Your Portfolio',
        badge: needsRebalance
          ? { text: '⚠️ Rebalance', variant: 'warning' }
          : { text: '✓ Balanced', variant: 'success' }
      };
    }
    case 'PROTECTION': {
      const protectedCount = state.protections?.length || 0;
      return {
        title: 'Your Protections',
        badge: protectedCount > 0
          ? { text: `${protectedCount} asset${protectedCount > 1 ? 's' : ''} covered`, variant: 'info' }
          : null
      };
    }
    case 'LOANS': {
      const loans = state.loans || [];
      const totalLoan = loans.reduce((sum, l) => sum + l.amountIRR, 0);
      return {
        title: 'Your Loans',
        badge: loans.length > 0
          ? { text: `${loans.length} Active: ${formatIRRShort(totalLoan)}`, variant: 'info' }
          : null
      };
    }
    case 'HISTORY':
      return {
        title: 'Your History',
        badge: null
      };
    default:
      return { title: 'Portfolio', badge: null };
  }
}

// ====== MAIN APP ======
export default function App() {
  const [state, dispatch] = useReducer(reducer, null, initialState);

  const snapshot = useMemo(() => computeSnapshot(state), [state]);

  const onStartTrade = (assetId, side) => dispatch({ type: 'START_TRADE', assetId, side });
  const onStartProtect = (assetId) => dispatch({ type: 'START_PROTECT', assetId });
  const onStartBorrow = (assetId) => dispatch({ type: 'START_BORROW', assetId });

  const right = useMemo(() => {
    if (state.stage !== STAGES.ACTIVE) {
      return <OnboardingRightPanel stage={state.stage} questionIndex={state.questionnaire.index} targetLayers={state.targetLayerPct} investAmount={state.investAmountIRR} dispatch={dispatch} />;
    }
    if (state.tab === 'PROTECTION') return <Protection protections={state.protections} />;
    if (state.tab === 'LOANS') return <Loans loans={state.loans} dispatch={dispatch} />;
    if (state.tab === 'HISTORY') return <HistoryPane ledger={state.ledger} />;
    return <PortfolioHome state={state} snapshot={snapshot} onStartTrade={onStartTrade} onStartProtect={onStartProtect} onStartBorrow={onStartBorrow} />;
  }, [state, snapshot]);

  return (
    <>
      <div className="container">
        <div className="panel">
          <div className="header">
            <div className="logo">B</div>
            <div style={{ flex: 1 }}>
              <div className="h-title">Blu Markets</div>
              <div className="h-motto">Markets, but mindful</div>
            </div>
            <div className="rightMeta">
              {state.phone && <div className="pill">{state.phone}</div>}
            </div>
          </div>
          <div className="body"><ActionLogPane actionLog={state.actionLog} /></div>
          <div className="footer"><OnboardingControls state={state} dispatch={dispatch} /></div>
        </div>
        <div className="panel">
          <div className="header">
            <div style={{ flex: 1 }}>
              {/* Issue 6: Contextual header based on tab */}
              {state.stage === STAGES.ACTIVE ? (
                <>
                  <div className="h-title">{getHeaderContent(state.tab, state, snapshot).title}</div>
                </>
              ) : (
                <>
                  <div className="h-title">Getting Started</div>
                  <div className="h-sub">Complete the steps</div>
                </>
              )}
            </div>
            <div className="rightMeta">
              {state.stage === STAGES.ACTIVE && (
                <>
                  {/* Issue 6: Show contextual badge based on tab */}
                  {getHeaderContent(state.tab, state, snapshot).badge && (
                    <span className={`headerBadge badge-${getHeaderContent(state.tab, state, snapshot).badge.variant}`}>
                      {getHeaderContent(state.tab, state, snapshot).badge.text}
                    </span>
                  )}
                  {(state.loans || []).length > 0 && state.tab !== 'LOANS' && <div className="pill" style={{ color: '#fb923c', borderColor: 'rgba(249,115,22,.3)' }}><span>Loans ({state.loans.length})</span><span>{formatIRR(state.loans.reduce((sum, l) => sum + l.amountIRR, 0))}</span></div>}
                  {/* S-1: Stress mode toggle - explicit and reversible */}
                  <button
                    className={`stressModeToggle ${state.stressMode ? 'active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_STRESS_MODE', payload: { on: !state.stressMode } })}
                    title={state.stressMode ? 'Click to disable stress mode' : 'Click to enable stress mode (adds extra confirmation for actions)'}
                  >
                    {state.stressMode ? '🔴 Stress' : '⚪ Stress'}
                  </button>
                </>
              )}
            </div>
          </div>
          {state.stage === STAGES.ACTIVE && <Tabs tab={state.tab} dispatch={dispatch} />}
          <div className="body">{right}</div>
        </div>
      </div>
      {state.showResetConfirm && <ResetConfirmModal onConfirm={() => dispatch({ type: 'RESET' })} onCancel={() => dispatch({ type: 'HIDE_RESET_CONFIRM' })} />}
      <div className="toastContainer">{state.lastAction && <ExecutionSummary lastAction={state.lastAction} dispatch={dispatch} />}</div>
    </>
  );
}
