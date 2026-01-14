import React, { useMemo, useReducer, useCallback, Suspense, lazy } from 'react';

// ====== BLU MARKETS v10 ======
// Architecture: Single reducer + deterministic engine
// v10: Advanced risk profiling with pathological user detection
// All actions flow: PREVIEW_* -> pendingAction -> CONFIRM_PENDING -> ledger
// Rule: Chat can propose, only engine can execute

// CSS imports
import './styles/app.css';

// Engine imports
import { computeSnapshot } from './engine/snapshot.js';
import { computePortfolioStatus } from './engine/portfolioStatus.js';

// Hook imports
import { usePrices } from './hooks/usePrices.js';

// Data imports (consolidated to single v2 questionnaire)
import questionnaire from './data/questionnaire.v2.fa.json';

// Constants imports
import { STAGES } from './constants/index.js';

// Utility imports
import { formatIRR, formatIRRShort } from './helpers.js';

// Reducer imports
import { reducer, initialState } from './reducers/appReducer.js';

// Component imports (core - always loaded)
import {
  ActionLogPane,
  ExecutionSummary,
  Tabs,
  ResetConfirmModal,
  PortfolioHome,
  OnboardingRightPanel,
  OnboardingControls,
} from './components/index.js';

// Lazy-loaded tab panels (code-split for better initial load)
const HistoryPane = lazy(() => import('./components/HistoryPane.jsx'));
const Protection = lazy(() => import('./components/Protection.jsx'));
const Loans = lazy(() => import('./components/Loans.jsx'));

// Loading fallback for lazy components
const TabLoadingFallback = () => (
  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
    Loading...
  </div>
);

// ====== HEADER CONTENT HELPER ======
// Memoized via useMemo in component to avoid repeated computation

// Removed unused snapshot parameter to avoid unnecessary useMemo invalidations
function computeHeaderContent(activeTab, protections, loans, loansTotal, portfolioStatus) {
  switch (activeTab) {
    case 'PORTFOLIO': {
      const needsRebalance = portfolioStatus === 'SLIGHTLY_OFF' || portfolioStatus === 'ATTENTION_REQUIRED';
      return {
        title: 'Your Portfolio',
        badge: needsRebalance
          ? { text: '⚠️ Rebalance', variant: 'warning' }
          : { text: '✓ Balanced', variant: 'success' }
      };
    }
    case 'PROTECTION': {
      const protectedCount = protections?.length || 0;
      return {
        title: 'Your Protections',
        badge: protectedCount > 0
          ? { text: `${protectedCount} asset${protectedCount > 1 ? 's' : ''} covered`, variant: 'info' }
          : null
      };
    }
    case 'LOANS': {
      return {
        title: 'Your Loans',
        badge: loans.length > 0
          ? { text: `${loans.length} Active: ${formatIRRShort(loansTotal)}`, variant: 'info' }
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

  // v10: Live price feeds for quantity-based holdings
  const { prices, fxRate, loading: pricesLoading, lastUpdated: pricesUpdatedAt, error: pricesError } = usePrices(30000);

  // Memoize snapshot computation - uses live prices for quantity-based holdings
  const snapshot = useMemo(
    () => computeSnapshot(state.holdings, state.cashIRR, prices, fxRate),
    [state.holdings, state.cashIRR, prices, fxRate]
  );

  // Memoize portfolio status - reused by header and PortfolioHome
  const portfolioStatus = useMemo(
    () => computePortfolioStatus(snapshot.layerPct).status,
    [snapshot.layerPct]
  );

  // Memoize loan total to avoid duplicate reductions
  const loansTotal = useMemo(
    () => (state.loans || []).reduce((sum, l) => sum + l.amountIRR, 0),
    [state.loans]
  );

  // Memoize header content to avoid repeated computation per render
  // Note: Removed snapshot dependency - function doesn't use it
  const headerContent = useMemo(
    () => computeHeaderContent(state.tab, state.protections, state.loans, loansTotal, portfolioStatus),
    [state.tab, state.protections, state.loans, loansTotal, portfolioStatus]
  );

  // Memoized action handlers to prevent unnecessary re-renders of memoized children
  const onStartTrade = useCallback(
    (assetId, side) => dispatch({ type: 'START_TRADE', assetId, side }),
    []
  );
  const onStartProtect = useCallback(
    (assetId) => dispatch({ type: 'START_PROTECT', assetId }),
    []
  );
  const onStartBorrow = useCallback(
    (assetId) => dispatch({ type: 'START_BORROW', assetId }),
    []
  );
  const onStartRebalance = useCallback(
    () => dispatch({ type: 'START_REBALANCE' }),
    []
  );

  // Memoize right panel content - pass only specific state slices to avoid
  // stale UI when unrelated state fields (actionLog, pendingAction, drafts) change
  // Uses Suspense for code-split tab panels
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
    // Lazy-loaded tab panels wrapped in Suspense
    if (state.tab === 'PROTECTION') {
      return (
        <Suspense fallback={<TabLoadingFallback />}>
          <Protection protections={state.protections} dispatch={dispatch} />
        </Suspense>
      );
    }
    if (state.tab === 'LOANS') {
      return (
        <Suspense fallback={<TabLoadingFallback />}>
          <Loans loans={state.loans} holdings={state.holdings} prices={prices} fxRate={fxRate} dispatch={dispatch} />
        </Suspense>
      );
    }
    if (state.tab === 'HISTORY') {
      return (
        <Suspense fallback={<TabLoadingFallback />}>
          <HistoryPane ledger={state.ledger} />
        </Suspense>
      );
    }
    // Pass only specific state slices PortfolioHome needs (not whole state object)
    return (
      <PortfolioHome
        holdings={state.holdings}
        cashIRR={state.cashIRR}
        targetLayerPct={state.targetLayerPct}
        protections={state.protections}
        loans={state.loans}
        snapshot={snapshot}
        portfolioStatus={portfolioStatus}
        onStartTrade={onStartTrade}
        onStartProtect={onStartProtect}
        onStartBorrow={onStartBorrow}
        onStartRebalance={onStartRebalance}
        pricesLoading={pricesLoading}
        pricesUpdatedAt={pricesUpdatedAt}
        pricesError={pricesError}
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
    portfolioStatus,
    pricesLoading,
    pricesUpdatedAt,
    pricesError,
  ]);

  // Compute loan summary for header (only when loans exist and not on loans tab)
  const showLoansIndicator = state.stage === STAGES.ACTIVE && (state.loans || []).length > 0 && state.tab !== 'LOANS';
  const loansSummary = showLoansIndicator ? {
    count: state.loans.length,
    total: formatIRR(loansTotal)
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
            <OnboardingControls state={state} dispatch={dispatch} questionnaire={questionnaire} prices={prices} fxRate={fxRate} />
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
