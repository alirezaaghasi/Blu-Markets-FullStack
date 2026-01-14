import React, { useMemo, useReducer } from 'react';

// ====== BLU MARKETS v9.8 REFACTORED ======
// Architecture: Single reducer + deterministic engine
// All actions flow: PREVIEW_* -> pendingAction -> CONFIRM_PENDING -> ledger
// Rule: Chat can propose, only engine can execute

// CSS imports
import './styles/app.css';

// Engine imports
import { computeSnapshot } from './engine/snapshot.js';
import { computePortfolioStatus } from './engine/portfolioStatus.js';

// Data imports
import questionnaire from './data/questionnaire.fa.json';

// Constants imports
import { STAGES } from './constants/index.js';

// Utility imports
import { formatIRR, formatIRRShort } from './helpers.js';

// Reducer imports
import { reducer, initialState } from './reducers/appReducer.js';

// Component imports
import {
  ActionLogPane,
  ExecutionSummary,
  Tabs,
  ResetConfirmModal,
  HistoryPane,
  PortfolioHome,
  Protection,
  Loans,
  OnboardingRightPanel,
  OnboardingControls,
} from './components/index.js';

// ====== HEADER CONTENT HELPER ======
// Memoized via useMemo in component to avoid repeated computation

function computeHeaderContent(activeTab, state, snapshot) {
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

  // Memoize snapshot computation
  const snapshot = useMemo(() => computeSnapshot(state), [state]);

  // Memoize header content to avoid repeated computation per render
  const headerContent = useMemo(
    () => computeHeaderContent(state.tab, state, snapshot),
    [state.tab, state.protections, state.loans, snapshot]
  );

  // Action handlers
  const onStartTrade = (assetId, side) => dispatch({ type: 'START_TRADE', assetId, side });
  const onStartProtect = (assetId) => dispatch({ type: 'START_PROTECT', assetId });
  const onStartBorrow = (assetId) => dispatch({ type: 'START_BORROW', assetId });
  const onStartRebalance = () => dispatch({ type: 'START_REBALANCE' });

  // Memoize right panel content - narrow dependencies to avoid recomputation
  // when unrelated state fields (actionLog, pendingAction, drafts, etc.) change
  const rightContent = useMemo(() => {
    if (state.stage !== STAGES.ACTIVE) {
      return (
        <OnboardingRightPanel
          stage={state.stage}
          questionIndex={state.questionnaire.index}
          targetLayers={state.targetLayerPct}
          investAmount={state.investAmountIRR}
          dispatch={dispatch}
          questionnaireLength={questionnaire.questions.length}
        />
      );
    }
    if (state.tab === 'PROTECTION') return <Protection protections={state.protections} dispatch={dispatch} />;
    if (state.tab === 'LOANS') return <Loans loans={state.loans} dispatch={dispatch} />;
    if (state.tab === 'HISTORY') return <HistoryPane ledger={state.ledger} />;
    return (
      <PortfolioHome
        state={state}
        snapshot={snapshot}
        onStartTrade={onStartTrade}
        onStartProtect={onStartProtect}
        onStartBorrow={onStartBorrow}
        onStartRebalance={onStartRebalance}
      />
    );
  }, [
    state.stage,
    state.tab,
    state.questionnaire,
    state.targetLayerPct,
    state.investAmountIRR,
    state.protections,
    state.loans,
    state.ledger,
    state.holdings,
    state.cashIRR,
    snapshot,
  ]);

  // Compute loan summary for header (only when loans exist and not on loans tab)
  const showLoansIndicator = state.stage === STAGES.ACTIVE && (state.loans || []).length > 0 && state.tab !== 'LOANS';
  const loansSummary = showLoansIndicator ? {
    count: state.loans.length,
    total: formatIRR(state.loans.reduce((sum, l) => sum + l.amountIRR, 0))
  } : null;

  return (
    <>
      <div className="container">
        {/* Left Panel - Action Log & Controls */}
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
          <div className="body">
            <ActionLogPane actionLog={state.actionLog} />
          </div>
          <div className="footer">
            <OnboardingControls state={state} dispatch={dispatch} questionnaire={questionnaire} />
          </div>
        </div>

        {/* Right Panel - Content */}
        <div className="panel">
          <div className="header">
            <div style={{ flex: 1 }}>
              {state.stage === STAGES.ACTIVE ? (
                <div className="h-title">{headerContent.title}</div>
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
                  {/* Contextual badge based on tab */}
                  {headerContent.badge && (
                    <span className={`headerBadge badge-${headerContent.badge.variant}`}>
                      {headerContent.badge.text}
                    </span>
                  )}

                  {/* Loans indicator (when not on loans tab) */}
                  {loansSummary && (
                    <div className="pill" style={{ color: '#fb923c', borderColor: 'rgba(249,115,22,.3)' }}>
                      <span>Loans ({loansSummary.count})</span>
                      <span>{loansSummary.total}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tabs (only in active stage) */}
          {state.stage === STAGES.ACTIVE && <Tabs tab={state.tab} dispatch={dispatch} />}

          {/* Main content */}
          <div className="body">{rightContent}</div>
        </div>
      </div>

      {/* Modals */}
      {state.showResetConfirm && (
        <ResetConfirmModal
          onConfirm={() => dispatch({ type: 'RESET' })}
          onCancel={() => dispatch({ type: 'HIDE_RESET_CONFIRM' })}
        />
      )}

      {/* Toast notifications */}
      <div className="toastContainer">
        {state.lastAction && <ExecutionSummary lastAction={state.lastAction} dispatch={dispatch} />}
      </div>
    </>
  );
}
