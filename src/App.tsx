import { useMemo, useReducer, useCallback, Suspense, lazy, useEffect } from 'react';
import type { AssetId, TradeSide } from './types';

// ====== BLU MARKETS v10 ======
// Architecture: Single reducer + deterministic engine
// v10: Advanced risk profiling with pathological user detection
// All actions flow: PREVIEW_* -> pendingAction -> CONFIRM_PENDING -> ledger
// Rule: Chat can propose, only engine can execute

// CSS imports
import './styles/app.css';

// Engine imports
import { computeSnapshot } from './engine/snapshot';
import { computePortfolioStatus } from './engine/portfolioStatus';

// Hook imports
import { usePrices } from './hooks/usePrices';

// Constants imports
import { STAGES } from './constants/index';

// Empty snapshot for onboarding stage (avoid computation when not needed)
const EMPTY_SNAPSHOT = {
  holdingsIRR: 0,
  cashIRR: 0,
  totalIRR: 0,
  layerIRR: { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
  layerPct: { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
  holdingsIRRByAsset: {},
};

// Utility imports
import { formatIRR, formatIRRShort } from './helpers';

// Reducer imports
import { reducer, initialState } from './reducers/appReducer';

// Questionnaire metadata only - full questionnaire is loaded lazily in onboarding components
// This avoids bundling the full JSON for users who skip onboarding
import { QUESTIONNAIRE_LENGTH } from './data/questionnaireMetadata';

// Component imports (core - minimal for initial render)
import {
  ActionLogPane,
  Tabs,
  OnboardingControls,
} from './components/index';

// Lazy-loaded components (code-split for smaller initial bundle)
// Tab panels
const HistoryPane = lazy(() => import('./components/HistoryPane'));
const Protection = lazy(() => import('./components/Protection'));
const Loans = lazy(() => import('./components/Loans'));
const PortfolioHome = lazy(() => import('./components/PortfolioHome'));

// Stage-specific components (only load what's needed)
const OnboardingRightPanel = lazy(() => import('./components/onboarding/OnboardingRightPanel'));

// Modals (rarely used, defer loading)
const ResetConfirmModal = lazy(() => import('./components/ResetConfirmModal'));
const ExecutionSummary = lazy(() => import('./components/ExecutionSummary'));

// Loading fallback for lazy components (uses CSS class to avoid inline style allocation)
const TabLoadingFallback = () => (
  <div className="tabLoadingFallback">Loading...</div>
);

// Minimal fallback for modals (invisible)
const ModalFallback = () => null;

// ====== HEADER CONTENT HELPER ======
// Memoized via useMemo in component to avoid repeated computation

// Removed unused snapshot parameter to avoid unnecessary useMemo invalidations
function computeHeaderContent(
  activeTab: string,
  protections: Array<{ endTimeMs?: number; endISO?: string }>,
  loans: Array<{ amountIRR: number }>,
  loansTotal: number,
  portfolioStatus: string
) {
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
      // Filter to only count active protections using pre-computed endTimeMs (avoid Date parsing)
      const nowMs = Date.now();
      const activeProtections = (protections || []).filter(p => {
        // Use pre-computed endTimeMs if available, fallback to Date parsing for legacy data
        const endMs = p.endTimeMs ?? (p.endISO ? new Date(p.endISO).getTime() : Infinity);
        return endMs >= nowMs;
      });
      const protectedCount = activeProtections.length;
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
  // Enable polling during AMOUNT_REQUIRED so portfolio is created with live prices
  // (avoids mismatch between creation prices and display prices)
  // Also enable during PORTFOLIO_CREATED to show accurate values on summary
  const isPricePollingEnabled = state.stage === STAGES.ACTIVE || state.stage === STAGES.AMOUNT_REQUIRED || state.stage === STAGES.PORTFOLIO_CREATED;
  const { prices, fxRate, loading: pricesLoading, lastUpdated: pricesUpdatedAt, error: pricesError } = usePrices(30000, isPricePollingEnabled);

  // Prefetch likely next tabs after mount to reduce latency on tab switch
  useEffect(() => {
    if (state.stage === STAGES.ACTIVE) {
      // Prefetch Protection and Loans tabs after a short delay
      const timer = setTimeout(() => {
        import('./components/Protection');
        import('./components/Loans');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.stage]);

  // Memoize snapshot computation - uses live prices for quantity-based holdings
  // Optimization: Skip computation during onboarding when holdings are empty
  const snapshot = useMemo(() => {
    if (state.stage !== STAGES.ACTIVE && state.holdings.length === 0) {
      return EMPTY_SNAPSHOT;
    }
    return computeSnapshot(state.holdings, state.cashIRR, prices, fxRate);
  }, [state.stage, state.holdings, state.cashIRR, prices, fxRate]);

  // Memoize portfolio status - reused by header and PortfolioHome
  // Pass targetLayerPct to compare against user's actual target, not fixed ranges
  const portfolioStatus = useMemo(
    () => computePortfolioStatus(snapshot.layerPct, state.targetLayerPct).status,
    [snapshot.layerPct, state.targetLayerPct]
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
    (assetId: AssetId, side?: TradeSide) => dispatch({ type: 'START_TRADE', assetId, side }),
    []
  );
  const onStartProtect = useCallback(
    (assetId: AssetId) => dispatch({ type: 'START_PROTECT', assetId }),
    []
  );
  const onStartBorrow = useCallback(
    (assetId: AssetId) => dispatch({ type: 'START_BORROW', assetId }),
    []
  );
  const onStartRebalance = useCallback(
    () => dispatch({ type: 'START_REBALANCE' }),
    []
  );

  // Memoize onboarding content separately (only depends on onboarding state)
  const onboardingContent = useMemo(() => (
    <Suspense fallback={<TabLoadingFallback />}>
      <OnboardingRightPanel
        stage={state.stage}
        questionIndex={state.questionnaire.index}
        targetLayers={state.targetLayerPct}
        investAmount={state.investAmountIRR}
        dispatch={dispatch}
        questionnaireLength={QUESTIONNAIRE_LENGTH}
      />
    </Suspense>
  ), [state.stage, state.questionnaire.index, state.targetLayerPct, state.investAmountIRR]);

  // Memoize portfolio tab content (most frequently used)
  const portfolioContent = useMemo(() => (
    <Suspense fallback={<TabLoadingFallback />}>
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
    </Suspense>
  ), [state.holdings, state.cashIRR, state.targetLayerPct, state.protections, state.loans, snapshot, portfolioStatus, pricesLoading, pricesUpdatedAt, pricesError, onStartTrade, onStartProtect, onStartBorrow, onStartRebalance]);

  // Memoize history content separately (only depends on ledger)
  const historyContent = useMemo(() => (
    <Suspense fallback={<TabLoadingFallback />}>
      <HistoryPane ledger={state.ledger} />
    </Suspense>
  ), [state.ledger]);

  // Memoize protection tab content separately (only depends on protections)
  const protectionContent = useMemo(() => (
    <Suspense fallback={<TabLoadingFallback />}>
      <Protection protections={state.protections} dispatch={dispatch} />
    </Suspense>
  ), [state.protections]);

  // Memoize loans tab content separately (only depends on loans and holdings)
  const loansContent = useMemo(() => (
    <Suspense fallback={<TabLoadingFallback />}>
      <Loans loans={state.loans} holdings={state.holdings} dispatch={dispatch} />
    </Suspense>
  ), [state.loans, state.holdings]);

  // Select right panel content based on stage and tab
  // Optimization: Each tab's content is memoized separately with minimal deps
  // The switch only depends on stage and tab - content memos handle their own deps
  const rightContent = useMemo(() => {
    if (state.stage !== STAGES.ACTIVE) {
      return onboardingContent;
    }
    switch (state.tab) {
      case 'PROTECTION':
        return protectionContent;
      case 'LOANS':
        return loansContent;
      case 'HISTORY':
        return historyContent;
      default:
        return portfolioContent;
    }
  }, [state.stage, state.tab, onboardingContent, portfolioContent, historyContent, protectionContent, loansContent]);

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
            <div className="headerFlexGrow">
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
            <OnboardingControls state={state} dispatch={dispatch} prices={prices} fxRate={fxRate} />
          </div>
        </div>

        {/* Right Panel - Content */}
        <div className="panel">
          <div className="header">
            <div className="headerFlexGrow">
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
                    <div className="pill pill-loans">
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

      {/* Modals (lazy-loaded) */}
      {state.showResetConfirm && (
        <Suspense fallback={<ModalFallback />}>
          <ResetConfirmModal
            onConfirm={() => dispatch({ type: 'RESET' })}
            onCancel={() => dispatch({ type: 'HIDE_RESET_CONFIRM' })}
          />
        </Suspense>
      )}

      {/* Toast notifications (lazy-loaded) */}
      <div className="toastContainer">
        {state.lastAction && (
          <Suspense fallback={<ModalFallback />}>
            <ExecutionSummary lastAction={state.lastAction} dispatch={dispatch} />
          </Suspense>
        )}
      </div>
    </>
  );
}
