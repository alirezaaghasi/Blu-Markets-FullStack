import React, { useEffect, useMemo, useReducer, useState, useRef } from 'react';

// ====== BLU MARKETS v9.6 REFACTORED ======
// Architecture: Single reducer + deterministic engine
// All actions flow: PREVIEW_* -> pendingAction -> CONFIRM_PENDING -> ledger

// Engine imports
import { computeSnapshot } from './engine/snapshot.js';
import { computePortfolioStatus } from './engine/portfolioStatus.js';
import { classifyActionBoundary, frictionCopyForBoundary } from './engine/boundary.js';
import { calcPremiumIRR, calcLiquidationIRR } from './engine/pricing.js';
import {
  validateAddFunds,
  validateTrade,
  validateProtect,
  validateBorrow,
  validateRepay,
  validateRebalance,
} from './engine/validate.js';
import {
  cloneState,
  previewAddFunds,
  previewTrade,
  previewProtect,
  previewBorrow,
  previewRepay,
  previewRebalance,
} from './engine/preview.js';

// Domain imports
import { ASSETS, ASSET_LAYER, LAYER_RANGES } from './state/domain.js';

// Data imports
import questionnaire from './data/questionnaire.fa.json';

// Constants imports
import {
  STAGES,
  LAYER_EXPLANATIONS,
  THRESHOLDS,
  WEIGHTS,
  PORTFOLIO_STATUS_LABELS,
  BOUNDARY_LABELS,
  ERROR_MESSAGES,
} from './constants/index.js';

// Utility imports
import {
  formatIRR,
  formatIRRShort,
  formatTime,
  formatTimestamp,
  getAssetDisplayName,
  uid,
  nowISO,
  computeTargetLayersFromAnswers,
} from './helpers.js';

// Build initial portfolio holdings from investment amount and target allocation
function buildInitialHoldings(totalIRR, targetLayerPct) {
  const holdings = ASSETS.map(assetId => ({ assetId, valueIRR: 0, frozen: false }));

  for (const layer of ['FOUNDATION', 'GROWTH', 'UPSIDE']) {
    const pct = (targetLayerPct[layer] ?? 0) / 100;
    const layerAmount = Math.floor(totalIRR * pct);
    const weights = WEIGHTS[layer] || {};
    let layerAllocated = 0;

    for (const assetId of Object.keys(weights)) {
      const h = holdings.find(x => x.assetId === assetId);
      if (!h) continue;
      const amt = Math.floor(layerAmount * weights[assetId]);
      h.valueIRR = amt;
      layerAllocated += amt;
    }

    // Remainder to last asset in layer
    const remainder = layerAmount - layerAllocated;
    if (remainder > 0) {
      const layerAssets = Object.keys(weights);
      const lastAsset = layerAssets[layerAssets.length - 1];
      const h = holdings.find(x => x.assetId === lastAsset);
      if (h) h.valueIRR += remainder;
    }
  }

  return holdings;
}

// ====== UNIFIED REDUCER ======
// All state transitions go through this single reducer
// Actions flow: PREVIEW_* -> pendingAction -> CONFIRM_PENDING -> ledger

function buildPending(state, kind, payload, validation, afterState) {
  const before = computeSnapshot(state);
  const after = computeSnapshot(afterState);
  const boundary = classifyActionBoundary({
    kind,
    validation,
    before,
    after,
    stressMode: state.stressMode,
  });

  // Extract rebalance meta if present for constraint messaging
  const meta = afterState._rebalanceMeta || {};

  return {
    kind,
    payload,
    before,
    after,
    validation,
    boundary,
    frictionCopy: frictionCopyForBoundary(boundary, kind, meta),
    // R-1: Include rebalance meta for trade details display
    rebalanceMeta: kind === 'REBALANCE' ? meta : null,
  };
}

function initialState() {
  return {
    // Core state from spec
    stage: STAGES.WELCOME,
    phone: null,
    cashIRR: 0,
    holdings: ASSETS.map(a => ({ assetId: a, valueIRR: 0, frozen: false })),
    targetLayerPct: { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 },
    protections: [],
    loan: null,
    ledger: [],
    pendingAction: null,
    stressMode: false,

    // UI state
    questionnaire: { index: 0, answers: {} },
    consentStep: 0,
    consentMessages: [],
    investAmountIRR: null,
    tab: 'PORTFOLIO',
    lastAction: null,
    showResetConfirm: false,
    actionLog: [],

    // Draft state for UI input collection
    tradeDraft: null,
    protectDraft: null,
    borrowDraft: null,
    repayDraft: null,
    addFundsDraft: null,
    rebalanceDraft: null,
  };
}

function addLogEntry(state, type, data = {}) {
  return { ...state, actionLog: [...state.actionLog, { id: Date.now(), timestamp: Date.now(), type, ...data }] };
}

function reducer(state, action) {
  switch (action.type) {
    // ====== GLOBAL ======
    case 'RESET':
      return initialState();

    case 'SHOW_RESET_CONFIRM':
      return { ...state, showResetConfirm: true };

    case 'HIDE_RESET_CONFIRM':
      return { ...state, showResetConfirm: false };

    case 'SET_TAB':
      return { ...state, tab: action.tab };

    case 'SET_STRESS_MODE':
      return { ...state, stressMode: Boolean(action.payload?.on) };

    case 'DISMISS_LAST_ACTION':
      return { ...state, lastAction: null };

    // ====== ONBOARDING ======
    case 'START_ONBOARDING':
      return { ...state, stage: STAGES.ONBOARDING_PHONE };

    case 'SET_PHONE': {
      const phone = String(action.phone || '').trim();
      return { ...state, phone };
    }

    case 'SUBMIT_PHONE': {
      const phone = String(state.phone || '').trim();
      if (!phone.startsWith('+989') || phone.length !== 13) return state;
      return { ...state, stage: STAGES.ONBOARDING_QUESTIONNAIRE };
    }

    case 'ANSWER_QUESTION': {
      if (state.stage !== STAGES.ONBOARDING_QUESTIONNAIRE) return state;
      const answers = { ...state.questionnaire.answers, [action.qId]: action.optionId };
      let idx = state.questionnaire.index + 1;
      let s = { ...state, questionnaire: { index: idx, answers } };

      if (idx >= questionnaire.questions.length) {
        const targetLayerPct = computeTargetLayersFromAnswers(questionnaire, answers);
        s = { ...s, targetLayerPct, stage: STAGES.ONBOARDING_RESULT };
      }
      return s;
    }

    case 'ADVANCE_CONSENT': {
      if (state.stage !== STAGES.ONBOARDING_RESULT) return state;
      const nextStep = state.consentStep + 1;
      const newMessages = [...state.consentMessages, action.message];
      return { ...state, consentStep: nextStep, consentMessages: newMessages };
    }

    case 'SUBMIT_CONSENT': {
      if (state.stage !== STAGES.ONBOARDING_RESULT) return state;
      if (String(action.text || '') !== questionnaire.consent_exact) return state;
      return { ...state, stage: STAGES.AMOUNT_REQUIRED };
    }

    case 'SET_INVEST_AMOUNT': {
      if (state.stage !== STAGES.AMOUNT_REQUIRED) return state;
      return { ...state, investAmountIRR: action.amountIRR };
    }

    case 'EXECUTE_PORTFOLIO': {
      if (state.stage !== STAGES.AMOUNT_REQUIRED) return state;
      const n = Math.floor(Number(state.investAmountIRR) || 0);
      if (n < THRESHOLDS.MIN_AMOUNT_IRR) return state;

      const holdings = buildInitialHoldings(n, state.targetLayerPct);
      let s = { ...state, holdings, cashIRR: 0, stage: STAGES.ACTIVE };

      // Create ledger entry
      const entry = {
        id: uid(),
        tsISO: nowISO(),
        type: 'PORTFOLIO_CREATED_COMMIT',
        details: { amountIRR: n, targetLayerPct: state.targetLayerPct },
      };
      s = { ...s, ledger: [entry], lastAction: { type: 'PORTFOLIO_CREATED', timestamp: Date.now() } };
      s = addLogEntry(s, 'PORTFOLIO_CREATED', { amountIRR: n });
      return s;
    }

    // ====== CANCEL PENDING ======
    case 'CANCEL_PENDING':
      return {
        ...state,
        pendingAction: null,
        tradeDraft: null,
        protectDraft: null,
        borrowDraft: null,
        repayDraft: null,
        addFundsDraft: null,
        rebalanceDraft: null,
      };

    // ====== ADD FUNDS ======
    case 'START_ADD_FUNDS': {
      if (state.stage !== STAGES.ACTIVE) return state;
      return { ...state, addFundsDraft: { amountIRR: null }, pendingAction: null };
    }

    case 'SET_ADD_FUNDS_AMOUNT': {
      if (!state.addFundsDraft) return state;
      return { ...state, addFundsDraft: { ...state.addFundsDraft, amountIRR: action.amountIRR } };
    }

    case 'PREVIEW_ADD_FUNDS': {
      if (state.stage !== STAGES.ACTIVE) return state;
      const amountIRR = Number(state.addFundsDraft?.amountIRR || action.payload?.amountIRR);
      const payload = { amountIRR };
      const validation = validateAddFunds(payload);
      const afterState = validation.ok ? previewAddFunds(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'ADD_FUNDS', payload, validation, afterState) };
    }

    // ====== TRADE ======
    case 'START_TRADE': {
      if (state.stage !== STAGES.ACTIVE) return state;
      return {
        ...state,
        tradeDraft: { assetId: action.assetId, side: action.side || 'BUY', amountIRR: null },
        pendingAction: null,
      };
    }

    case 'SET_TRADE_SIDE': {
      if (!state.tradeDraft) return state;
      return { ...state, tradeDraft: { ...state.tradeDraft, side: action.side } };
    }

    case 'SET_TRADE_AMOUNT': {
      if (!state.tradeDraft) return state;
      return { ...state, tradeDraft: { ...state.tradeDraft, amountIRR: action.amountIRR } };
    }

    case 'PREVIEW_TRADE': {
      if (state.stage !== STAGES.ACTIVE || !state.tradeDraft) return state;
      const payload = {
        side: state.tradeDraft.side,
        assetId: state.tradeDraft.assetId,
        amountIRR: Number(state.tradeDraft.amountIRR),
      };
      const validation = validateTrade(payload, state);
      const afterState = validation.ok ? previewTrade(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'TRADE', payload, validation, afterState) };
    }

    // ====== PROTECT ======
    case 'START_PROTECT': {
      if (state.stage !== STAGES.ACTIVE) return state;
      const assetId = action.assetId || state.holdings.find(h => h.valueIRR > 0)?.assetId;
      if (!assetId) return state;
      return {
        ...state,
        protectDraft: { assetId, months: 3 },
        pendingAction: null,
      };
    }

    case 'SET_PROTECT_ASSET': {
      if (!state.protectDraft) return state;
      return { ...state, protectDraft: { ...state.protectDraft, assetId: action.assetId } };
    }

    case 'SET_PROTECT_MONTHS': {
      if (!state.protectDraft) return state;
      return { ...state, protectDraft: { ...state.protectDraft, months: action.months } };
    }

    case 'PREVIEW_PROTECT': {
      if (state.stage !== STAGES.ACTIVE || !state.protectDraft) return state;
      const payload = {
        assetId: state.protectDraft.assetId,
        months: Number(state.protectDraft.months),
      };
      const validation = validateProtect(payload, state);
      const afterState = validation.ok ? previewProtect(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'PROTECT', payload, validation, afterState) };
    }

    // ====== BORROW ======
    case 'START_BORROW': {
      if (state.stage !== STAGES.ACTIVE) return state;
      const available = state.holdings.filter(h => !h.frozen && h.valueIRR > 0);
      if (available.length === 0) return state;
      const assetId = action.assetId || available[0].assetId;
      return {
        ...state,
        borrowDraft: { assetId, ltv: 0.5, amountIRR: null },
        pendingAction: null,
      };
    }

    case 'SET_BORROW_ASSET': {
      if (!state.borrowDraft) return state;
      return { ...state, borrowDraft: { ...state.borrowDraft, assetId: action.assetId } };
    }

    case 'SET_BORROW_LTV': {
      if (!state.borrowDraft) return state;
      return { ...state, borrowDraft: { ...state.borrowDraft, ltv: Number(action.ltv) } };
    }

    case 'SET_BORROW_AMOUNT': {
      if (!state.borrowDraft) return state;
      return { ...state, borrowDraft: { ...state.borrowDraft, amountIRR: action.amountIRR } };
    }

    case 'PREVIEW_BORROW': {
      if (state.stage !== STAGES.ACTIVE || !state.borrowDraft) return state;
      const payload = {
        assetId: state.borrowDraft.assetId,
        amountIRR: Number(state.borrowDraft.amountIRR),
        ltv: Number(state.borrowDraft.ltv),
      };
      const validation = validateBorrow(payload, state);
      const afterState = validation.ok ? previewBorrow(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'BORROW', payload, validation, afterState) };
    }

    // ====== REPAY ======
    case 'START_REPAY': {
      if (state.stage !== STAGES.ACTIVE || !state.loan) return state;
      return {
        ...state,
        repayDraft: { amountIRR: state.loan.amountIRR },
        pendingAction: null,
      };
    }

    case 'PREVIEW_REPAY': {
      if (state.stage !== STAGES.ACTIVE || !state.loan) return state;
      const payload = { amountIRR: state.loan.amountIRR };
      const validation = validateRepay(payload, state);
      const afterState = validation.ok ? previewRepay(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'REPAY', payload, validation, afterState) };
    }

    // ====== REBALANCE ======
    case 'START_REBALANCE': {
      if (state.stage !== STAGES.ACTIVE) return state;
      return {
        ...state,
        rebalanceDraft: { mode: 'HOLDINGS_ONLY' },  // Fixed: Don't use cash wallet
        pendingAction: null,
      };
    }

    case 'PREVIEW_REBALANCE': {
      if (state.stage !== STAGES.ACTIVE) return state;
      const payload = { mode: state.rebalanceDraft?.mode || 'HOLDINGS_ONLY' };
      const validation = validateRebalance(payload);
      const afterState = validation.ok ? previewRebalance(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'REBALANCE', payload, validation, afterState) };
    }

    // ====== CONFIRM PENDING ======
    case 'CONFIRM_PENDING': {
      const p = state.pendingAction;
      if (!p || !p.validation.ok) return state;

      let next = cloneState(state);

      // Commit by replaying deterministic preview
      if (p.kind === 'ADD_FUNDS') next = previewAddFunds(next, p.payload);
      if (p.kind === 'TRADE') next = previewTrade(next, p.payload);
      if (p.kind === 'BORROW') next = previewBorrow(next, p.payload);
      if (p.kind === 'REPAY') next = previewRepay(next, p.payload);
      if (p.kind === 'REBALANCE') next = previewRebalance(next, p.payload);

      if (p.kind === 'PROTECT') {
        const holding = next.holdings.find(h => h.assetId === p.payload.assetId);
        if (holding) {
          const premium = calcPremiumIRR({
            assetId: holding.assetId,
            notionalIRR: holding.valueIRR,
            months: p.payload.months,
          });
          next.cashIRR -= premium;

          const startISO = new Date().toISOString().slice(0, 10);
          const end = new Date();
          end.setMonth(end.getMonth() + p.payload.months);
          const endISO = end.toISOString().slice(0, 10);

          next.protections = [
            ...next.protections,
            {
              id: uid(),
              assetId: holding.assetId,
              notionalIRR: holding.valueIRR,
              premiumIRR: premium,
              startISO,
              endISO,
            },
          ];
        }
      }

      const entry = {
        id: uid(),
        tsISO: nowISO(),
        type: `${p.kind}_COMMIT`,
        details: {
          kind: p.kind,
          payload: p.payload,
          boundary: p.boundary,
          validation: p.validation,
          before: p.before,
          after: computeSnapshot(next),
          // Issue 9: Store friction copy for ledger display
          frictionCopy: p.frictionCopy || [],
        },
      };

      next.pendingAction = null;
      next.tradeDraft = null;
      next.protectDraft = null;
      next.borrowDraft = null;
      next.repayDraft = null;
      next.addFundsDraft = null;
      next.rebalanceDraft = null;
      next.ledger = [...next.ledger, entry];
      next.lastAction = { type: p.kind, timestamp: Date.now(), ...p.payload };
      // Fix 6: Include boundary in action log for indicators
      next = addLogEntry(next, p.kind, { ...p.payload, boundary: p.boundary });

      // G-3: Portfolio Gravity - return to Portfolio Home after any action
      next.tab = 'PORTFOLIO';

      return next;
    }

    default:
      return state;
  }
}

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
        {/* Fix 5: Loan health indicator */}
        {state.loan && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>💰 Active Loan</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{formatIRR(state.loan.amountIRR)}</span>
            </div>
            <div className="loanHealthIndicator">
              <div className="loanHealthBar">
                <div
                  className={`loanHealthFill ${
                    (state.loan.amountIRR / state.loan.liquidationIRR) > 0.75 ? 'critical' :
                    (state.loan.amountIRR / state.loan.liquidationIRR) > 0.6 ? 'warning' : 'healthy'
                  }`}
                  style={{ width: `${Math.min(100, (state.loan.amountIRR / state.loan.liquidationIRR) * 100)}%` }}
                />
              </div>
              <span className={`loanHealthText ${
                (state.loan.amountIRR / state.loan.liquidationIRR) > 0.75 ? 'critical' :
                (state.loan.amountIRR / state.loan.liquidationIRR) > 0.6 ? 'warning' : 'healthy'
              }`}>
                {Math.round((state.loan.amountIRR / state.loan.liquidationIRR) * 100)}%
              </span>
            </div>
          </div>
        )}
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

function Loans({ loan, dispatch }) {
  if (!loan) {
    return <div className="card"><h3>Active Loan</h3><div className="muted">No active loans.</div></div>;
  }

  const getLoanStatus = () => {
    const ltvPercent = (loan.amountIRR / loan.liquidationIRR) * 100;
    if (ltvPercent > 75) return { level: 'critical', message: '🔴 Liquidation risk — repay or add collateral' };
    if (ltvPercent > 60) return { level: 'warning', message: '⚠️ Monitor collateral' };
    return null;
  };

  const status = getLoanStatus();

  return (
    <div className="card">
      <h3>Active Loan</h3>
      <div className="list">
        <div className="item loanItem">
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
          <div className={`loanStatus loanStatus${status.level.charAt(0).toUpperCase() + status.level.slice(1)}`}>
            {status.message}
          </div>
        )}
        <button className="btn primary" style={{ width: '100%', marginTop: 10 }} onClick={() => dispatch({ type: 'START_REPAY' })}>Repay Loan</button>
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
    const maxBorrow = h ? Math.floor(h.valueIRR * state.borrowDraft.ltv) : 0;
    return (
      <ActionCard title="💰 Borrow">
        <div className="row" style={{ gap: 8 }}>
          <select className="input" value={state.borrowDraft.assetId || ''} onChange={(e) => dispatch({ type: 'SET_BORROW_ASSET', assetId: e.target.value })}>
            {state.holdings.filter(h => !h.frozen && h.valueIRR > 0).map((h) => {
              const layer = ASSET_LAYER[h.assetId];
              const info = LAYER_EXPLANATIONS[layer];
              return <option key={h.assetId} value={h.assetId}>{info.icon} {getAssetDisplayName(h.assetId)}</option>;
            })}
          </select>
          <select className="input" value={state.borrowDraft.ltv ?? 0.5} onChange={(e) => dispatch({ type: 'SET_BORROW_LTV', ltv: e.target.value })} style={{ width: 100 }}>
            <option value={0.3}>30% LTV</option>
            <option value={0.4}>40% LTV</option>
            <option value={0.5}>50% LTV</option>
            <option value={0.6}>60% LTV</option>
            <option value={0.7}>70% LTV</option>
          </select>
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
    return (
      <ActionCard title="Repay Loan">
        <div className="repayDetails">
          <div className="repayRow"><span>Loan:</span><span>{formatIRR(state.loan?.amountIRR || 0)}</span></div>
          <div className="repayRow"><span>Cash:</span><span>{formatIRR(state.cashIRR || 0)}</span></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_REPAY' })} disabled={(state.cashIRR || 0) < (state.loan?.amountIRR || 0)}>Preview</button>
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
      const totalLoan = state.loan?.amountIRR || 0;
      return {
        title: 'Your Loans',
        badge: totalLoan > 0
          ? { text: `Active: ${formatIRRShort(totalLoan)}`, variant: 'info' }
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
    if (state.tab === 'LOANS') return <Loans loan={state.loan} dispatch={dispatch} />;
    if (state.tab === 'HISTORY') return <HistoryPane ledger={state.ledger} />;
    return <PortfolioHome state={state} snapshot={snapshot} onStartTrade={onStartTrade} onStartProtect={onStartProtect} onStartBorrow={onStartBorrow} />;
  }, [state, snapshot]);

  return (
    <>
      <style>{`
        /* ===== BLU MARKETS v9.6 REFACTORED - FINANCIAL UI ===== */
        :root {
          --bg-primary: #0f1419;
          --bg-secondary: #151c24;
          --bg-tertiary: #1c252e;
          --bg-elevated: #232d38;
          --accent: #3d7fff;
          --accent-muted: rgba(61, 127, 255, 0.12);
          --accent-border: rgba(61, 127, 255, 0.25);
          --text-primary: #e6edf3;
          --text-secondary: #8b949e;
          --text-muted: #656d76;
          --border: rgba(255, 255, 255, 0.08);
          --border-hover: rgba(255, 255, 255, 0.12);
          --success: #3fb950;
          --warning: #d29922;
          --danger: #f85149;
          --shadow-sm: 0 1px 2px rgba(0,0,0,0.2);
          --shadow-md: 0 2px 8px rgba(0,0,0,0.25);
          --font-farsi: 'Vazirmatn', system-ui, sans-serif;
          --farsi-line-height: 1.8;
          --farsi-letter-spacing: 0.01em;
        }
        *{box-sizing:border-box}
        html,body{height:100%;margin:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg-primary);color:var(--text-primary);font-size:14px;line-height:1.5}
        ::-webkit-scrollbar{width:8px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:var(--bg-elevated);border-radius:4px;border:2px solid var(--bg-secondary)}
        ::-webkit-scrollbar-thumb:hover{background:var(--text-muted)}
        .container{height:100vh;display:grid;grid-template-columns:400px 1fr;gap:1px;background:var(--border)}
        .panel{background:var(--bg-secondary);overflow:hidden;display:flex;flex-direction:column;min-height:0}
        .header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:12px}
        .logo{width:28px;height:28px;border-radius:6px;background:var(--accent);display:grid;place-items:center;font-weight:600;color:white;font-size:12px}
        .h-title{font-weight:600;font-size:15px;color:var(--text-primary)}
        .h-sub{font-size:12px;color:var(--text-muted);margin-top:2px}
        .h-motto{font-size:11px;color:var(--text-muted);margin-top:2px;font-weight:400;letter-spacing:0.01em}
        .rightMeta{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
        .pill{display:inline-flex;gap:6px;align-items:center;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-tertiary);font-weight:500;font-size:11px;color:var(--text-secondary)}
        .body{padding:16px;overflow:auto;flex:1;min-height:0}
        .footer{padding:14px 16px;border-top:1px solid var(--border);background:var(--bg-tertiary)}
        .row{display:flex;gap:8px;flex-wrap:wrap}
        .btn{appearance:none;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-primary);padding:10px 16px;border-radius:8px;font-weight:500;cursor:pointer;font-size:13px;transition:background 0.15s,border-color 0.15s}
        .btn:hover{background:var(--bg-elevated);border-color:var(--border-hover)}
        .btn.primary{background:var(--accent);border-color:var(--accent);color:white}
        .btn.primary:hover{background:#5a93ff;border-color:#5a93ff}
        .btn.danger{background:transparent;border-color:var(--danger);color:var(--danger)}
        .btn.danger:hover{background:rgba(248,81,73,0.1)}
        .btn:disabled{background:var(--bg-tertiary);color:var(--text-muted);border-color:var(--border);cursor:not-allowed;opacity:0.6}
        .btn.tiny{padding:6px 12px;font-size:12px;border-radius:6px}
        .btn.tiny:hover{background:var(--accent-muted);border-color:var(--accent-border);color:var(--accent)}
        .btn.tiny:disabled{opacity:.35;cursor:not-allowed;background:transparent;border-color:transparent;color:var(--text-muted)}
        .input{width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-weight:400;outline:none;font-size:14px;transition:border-color 0.15s}
        .input:focus{border-color:var(--accent)}
        .input::placeholder{color:var(--text-muted)}
        .card{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px}
        .card h3{margin:0 0 12px 0;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted)}
        .big{font-size:24px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--text-primary)}
        .muted{color:var(--text-secondary);font-size:12px}
        .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .mini{border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--bg-secondary)}
        .tag{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.03em;font-weight:500}
        .list{display:flex;flex-direction:column;gap:8px}
        .item{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-secondary);transition:border-color 0.15s}
        .item:hover{border-color:var(--border-hover)}
        .item.assetEmpty{opacity:0.5}
        .item.assetEmpty .asset{color:var(--text-muted)}
        .asset{font-weight:500;font-size:14px}
        .assetActions{display:flex;justify-content:flex-end;gap:6px;margin-top:6px;flex-wrap:wrap}
        .tabs{display:flex;gap:4px;background:var(--bg-primary);padding:4px;border-radius:12px;border:1px solid var(--border)}
        .tab{flex:1;padding:10px 14px;border-radius:8px;border:none;background:transparent;font-weight:500;cursor:pointer;font-size:13px;color:var(--text-muted);transition:all 0.2s}
        .tab:hover:not(.active){color:var(--text-primary);background:var(--bg-tertiary)}
        .tab.active{color:white;background:linear-gradient(135deg,#6366f1,#8b5cf6);box-shadow:0 4px 12px rgba(139,92,246,0.3);font-weight:600}
        .chip{padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);font-weight:500;font-size:12px;cursor:pointer;transition:border-color 0.15s}
        .chip:hover{border-color:var(--border-hover)}
        .chip.primary{background:var(--accent);border-color:var(--accent);color:white}
        @media(max-width:980px){.container{grid-template-columns:1fr}.panel{min-height:48vh}}
        .healthBadge{display:inline-flex;align-items:center;padding:5px 10px;border-radius:6px;border:1px solid;font-size:11px;font-weight:500}
        .healthPill{padding:3px 8px;border-radius:4px;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.02em}
        .healthPill.small{padding:2px 6px;font-size:9px}
        .healthPill.safe{background:rgba(63,185,80,.12);color:var(--success);border:1px solid rgba(63,185,80,.2)}
        .healthPill.drift{background:rgba(210,153,34,.12);color:var(--warning);border:1px solid rgba(210,153,34,.2)}
        .healthPill.structural{background:rgba(210,153,34,.2);color:var(--warning);border:1px solid rgba(210,153,34,.3)}
        .healthPill.stress{background:rgba(248,81,73,.12);color:var(--danger);border:1px solid rgba(248,81,73,.2)}
        .layerHeader{display:flex;align-items:center;gap:6px;margin-bottom:4px}
        .layerDot{width:6px;height:6px;border-radius:50%;display:inline-block}
        .layerDot.foundation{background:var(--success)}
        .layerDot.growth{background:var(--accent)}
        .layerDot.upside{background:var(--warning)}
        .actionLog{display:flex;flex-direction:column;gap:0;font-family:ui-monospace,'SF Mono',monospace;font-size:11px;line-height:1.7}
        .actionLogEmpty{padding:20px;text-align:center}
        .logEntry{padding:6px 0;color:var(--text-secondary);border-bottom:1px solid var(--border)}
        .logEntry:last-child{border-bottom:none}
        .portfolioValueCard{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:12px}
        .portfolioValueLabel{font-size:12px;font-weight:600;color:var(--text-muted);letter-spacing:0.05em;margin-bottom:8px}
        .portfolioValueAmount{font-size:32px;font-weight:700;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:16px}
        .portfolioBreakdown{display:flex;gap:12px}
        .breakdownCard{flex:1;background:var(--bg-primary);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
        .breakdownCardIcon{font-size:16px;margin-bottom:4px}
        .breakdownCardLabel{font-size:12px;color:var(--text-muted);margin-bottom:4px}
        .breakdownCardValue{font-size:16px;font-weight:600;color:var(--text-primary)}
        .sectionTitle{font-size:12px;font-weight:600;color:var(--text-muted);letter-spacing:0.05em;margin-bottom:12px}
        .footerActions{display:flex;flex-direction:column;gap:10px}
        .footerRowPrimary{display:flex;gap:8px;flex-wrap:wrap}
        .footerRowSecondary{display:flex;gap:8px}
        .resetBtn{color:var(--text-muted);opacity:0.6}
        .resetBtn:hover{color:var(--danger);border-color:var(--danger);background:rgba(248,81,73,0.08);opacity:1}
        .toastContainer{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;z-index:900;pointer-events:none}
        .toast{background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:14px 24px;font-size:14px;font-weight:500;color:var(--text-primary);box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:toastIn 0.3s ease,toastOut 0.3s ease 3.7s forwards;pointer-events:auto}
        .toast.success{border-left:3px solid var(--success)}
        @keyframes toastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastOut{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-20px)}}
        .questionnaireHeader{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .q-card{border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--bg-tertiary)}
        .q-title{font-family:var(--font-farsi);font-weight:500;margin-bottom:6px;line-height:var(--farsi-line-height);font-size:15px;direction:rtl;text-align:right;letter-spacing:var(--farsi-letter-spacing)}
        .q-english{font-size:11px;color:var(--text-muted);margin-bottom:10px;font-style:italic;text-align:left;direction:ltr}
        .q-options{display:flex;flex-direction:column;gap:8px}
        .opt{appearance:none;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);padding:12px 14px;border-radius:8px;font-weight:400;cursor:pointer;text-align:right;direction:rtl;font-family:var(--font-farsi);line-height:var(--farsi-line-height);letter-spacing:var(--farsi-letter-spacing);transition:border-color 0.15s,background 0.15s}
        .opt:hover{border-color:var(--accent-border);background:var(--bg-tertiary)}
        .opt-english{font-size:10px;color:var(--text-muted);margin-top:4px;text-align:left;direction:ltr;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
        .consentCard{border:1px solid var(--border);border-radius:12px;padding:16px;background:var(--bg-tertiary)}
        .consentHeader{font-weight:600;margin-bottom:8px;font-size:14px}
        .consentInstruction{font-size:12px;color:var(--text-secondary);margin-bottom:10px}
        .consentSentence{background:var(--bg-primary);border-radius:8px;padding:12px;margin-bottom:12px;border:1px solid var(--border)}
        .sentenceFa{font-family:var(--font-farsi);font-weight:500;font-size:14px;line-height:var(--farsi-line-height);direction:rtl;text-align:right;letter-spacing:var(--farsi-letter-spacing)}
        .sentenceEn{font-size:11px;color:var(--text-muted);margin-top:6px;font-style:italic;text-align:left;direction:ltr}
        .consentCard input[dir="rtl"]{font-family:var(--font-farsi);text-align:right;line-height:var(--farsi-line-height);letter-spacing:var(--farsi-letter-spacing)}
        .actionCard{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:14px}
        .actionTitle{font-weight:500;font-size:12px;margin-bottom:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.03em}
        .previewPanel{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:14px}
        .previewTitle{font-weight:500;font-size:12px;margin-bottom:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.03em}
        .previewCard{border:1px solid var(--border);border-radius:10px;padding:14px;background:var(--bg-secondary)}
        .previewGrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .previewLabel{font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px}
        .previewLayers{font-size:13px;font-weight:500}
        .previewTotal{font-size:12px;color:var(--text-secondary);margin-top:4px}
        .projectedBoundary{display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
        .projectedLabel{font-size:11px;color:var(--text-muted)}
        .validationDisplay{margin-top:10px}
        .validationError{padding:10px 12px;border-radius:8px;background:rgba(248,81,73,.08);border:1px solid rgba(248,81,73,.2);color:var(--danger);font-size:12px;margin-bottom:6px}
        .validationWarning{padding:10px 12px;border-radius:8px;background:rgba(210,153,34,.08);border:1px solid rgba(210,153,34,.2);color:var(--warning);font-size:12px;margin-bottom:6px}
        .ledgerList{display:flex;flex-direction:column;gap:8px}
        .ledgerEntry{border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--bg-secondary);transition:border-color 0.15s}
        .ledgerEntry:hover{border-color:var(--border-hover)}
        .ledgerHeader{display:flex;align-items:center;gap:8px}
        .ledgerIcon{font-size:12px;width:20px;font-weight:700}
        .ledgerAction{font-weight:500;font-size:13px;flex:1}
        .ledgerTime{color:var(--text-muted);font-size:11px}
        .ledgerExpand{color:var(--text-muted);font-size:14px;width:20px;text-align:center}
        .ledgerBoundary{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}
        .borrowHint,.premiumHint{font-size:11px;color:var(--text-secondary);margin-top:6px;padding:8px 10px;background:var(--bg-primary);border-radius:6px;border:1px solid var(--border)}
        .loanItem{background:var(--bg-secondary);border:1px solid rgba(210,153,34,.3);border-left:3px solid var(--warning)}
        .loanAmount{font-size:20px;font-weight:600}
        .loanDetails{font-size:12px;color:var(--text-secondary);margin-top:4px}
        .loanUsage{font-size:12px;color:var(--text-muted);margin-top:4px}
        .liquidationValue{font-size:16px;font-weight:500;color:var(--warning)}
        .loanStatus{margin-top:12px;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:500}
        .loanStatusWarning{background:rgba(245,158,11,0.15);color:#fbbf24}
        .loanStatusCritical{background:rgba(239,68,68,0.15);color:#f87171}
        .repayDetails{background:var(--bg-primary);border-radius:10px;padding:12px;border:1px solid var(--border)}
        .repayRow{display:flex;justify-content:space-between;font-size:12px;padding:4px 0}
        .modalOverlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:1000}
        .modal{background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:400px;width:90%;box-shadow:var(--shadow-md)}
        .modalHeader{font-weight:600;font-size:18px;color:var(--text-primary);margin-bottom:12px}
        .modalBody{margin-bottom:20px}
        .modalMessage{margin:0;font-size:14px;color:var(--text-secondary);line-height:1.5}
        .modalFooter{display:flex;gap:12px;justify-content:flex-end}
        .onboardingPanel{height:100%;display:flex;flex-direction:column;gap:12px}
        .welcomeCard{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:14px;padding:24px;text-align:center}
        .welcomeIcon{font-size:48px;margin-bottom:14px}
        .welcomeCard h2{margin:0 0 8px 0;font-weight:600;font-size:18px;color:var(--text-primary)}
        .welcomeCard p{color:var(--text-secondary);margin:0 0 16px 0;font-size:13px}
        .welcomeFeatures{text-align:left}
        .featureItem{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
        .featureItem:last-child{border-bottom:none}
        .progressCard{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:14px;padding:20px;text-align:center}
        .progressCard h3{margin:0 0 16px 0;font-size:14px;font-weight:500}
        .bigProgress{position:relative;width:100px;height:100px;margin:0 auto 16px}
        .progressRing{width:100%;height:100%}
        .progressText{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-weight:600;font-size:18px}
        .layerPreviewCard{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:14px}
        .layerPreviewCard h4{margin:0 0 12px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);font-weight:500}
        .layerPreviewRow{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
        .layerPreviewRow:last-child{margin-bottom:0}
        .layerPreviewName{font-weight:500;font-size:12px}
        .layerPreviewDesc{font-size:11px;color:var(--text-secondary)}
        .allocationPreviewCard{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:14px}
        .allocationPreviewCard h3{margin:0 0 14px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);font-weight:500}
        .allocationViz{display:flex;gap:2px;height:40px;margin-bottom:16px;border-radius:6px;overflow:hidden}
        .allocationBar{display:flex;flex-direction:column;align-items:center;justify-content:center}
        .allocationBar.foundation{background:var(--success)}
        .allocationBar.growth{background:var(--accent)}
        .allocationBar.upside{background:var(--warning)}
        .barIcon{font-size:14px}
        .barPct{font-size:11px;font-weight:500}
        .allocationDetails{display:flex;flex-direction:column;gap:10px}
        .detailHeader{display:flex;align-items:center;gap:8px}
        .detailName{font-weight:500;font-size:12px;flex:1}
        .detailPct{font-weight:500;font-size:12px}
        .detailAssets{font-size:11px;color:var(--text-muted);margin-left:14px;margin-top:2px}
        .investPreviewCard{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:14px}
        .investPreviewCard h3{margin:0 0 14px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);font-weight:500}
        .investTotal{text-align:center;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)}
        .investBreakdown{display:flex;flex-direction:column;gap:8px}
        .breakdownRow{display:flex;justify-content:space-between;align-items:center}
        .breakdownLeft{display:flex;align-items:center;gap:8px}
        .breakdownAmount{font-weight:500;font-size:13px}
        .breakdownRight{text-align:right}
        .investPlaceholder{padding:30px;text-align:center}
        .investWarning{font-size:12px;color:var(--warning);margin-top:6px}
        .investMinHint{font-size:11px;color:var(--text-muted);margin-top:8px}
        .protectionItem{background:var(--bg-secondary);border:1px solid var(--accent-border);border-left:3px solid var(--accent)}
        .consentFlow{display:flex;flex-direction:column;min-height:280px;max-height:400px}
        .chatMessages{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;margin-bottom:12px}
        .chatMessage.bot{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:14px}
        .messageContent{white-space:pre-line;line-height:1.7;font-size:13px}
        .chatInputArea{margin-top:auto;flex-shrink:0}
        .welcomeValues{display:flex;flex-direction:column;gap:8px;margin-bottom:32px}
        .welcomeValues p{font-size:15px;color:var(--text-secondary);margin:0}
        .stack{display:flex;flex-direction:column;gap:0}
        .portfolioValue{font-size:28px;font-weight:600;color:var(--text-primary)}
        .welcomeScreen{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px 24px}
        .welcomeLogo{width:64px;height:64px;background:var(--accent);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:white;margin-bottom:24px}
        .welcomeTitle{font-size:28px;font-weight:600;color:var(--text-primary);margin:0 0 8px 0}
        .welcomeMotto{font-size:16px;color:var(--text-secondary);margin:0 0 8px 0;font-weight:400}
        .welcomeTagline{font-size:13px;color:var(--text-muted);margin:0 0 32px 0}
        .welcomeCta{padding:12px 40px;font-size:14px}
        /* Issue 6: Header badge styles */
        .headerBadge{padding:6px 12px;border-radius:6px;font-size:13px;font-weight:500}
        .badge-success{background:rgba(52,211,153,0.15);color:#34d399;border:1px solid rgba(52,211,153,0.3)}
        .badge-warning{background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3)}
        .badge-info{background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3)}
        /* Issue 12: History date grouping styles */
        .historyList{display:flex;flex-direction:column;gap:0}
        .historyGroup{margin-bottom:24px}
        .historyGroup:last-child{margin-bottom:0}
        .historyDateHeader{font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:8px}
        /* Issue 7: Amount display in history */
        .ledgerAmount{font-weight:500;font-size:12px;color:var(--text-secondary);margin-left:auto;margin-right:8px}
        /* Issue 9: Expandable details styles */
        .historyEntryDetails{padding:12px 16px 12px 40px;background:var(--bg-secondary);border-radius:0 0 8px 8px;margin-top:-4px;border:1px solid var(--border);border-top:none}
        .statusChange{display:flex;align-items:center;gap:8px;margin-bottom:8px}
        .statusLabel{font-size:11px;color:var(--text-muted)}
        .layerChange{display:flex;flex-direction:column;gap:4px}
        .changeRow{display:flex;align-items:center;gap:8px;font-size:12px}
        .changeLabel{font-size:11px;color:var(--text-muted);min-width:50px}
        /* Icon classes for history entries */
        .ledgerIcon.trade-buy{color:var(--success)}
        .ledgerIcon.trade-sell{color:var(--danger)}
        .ledgerIcon.action-success{color:var(--success)}
        .ledgerIcon.funds-add{color:var(--success)}
        .ledgerIcon.action-rebalance{color:var(--accent)}
        .ledgerIcon.action-protect{color:var(--accent)}
        .ledgerIcon.action-loan{color:var(--warning)}
        /* Issue 1: Consent input section styles */
        .consentInputSection{background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:16px}
        .consentPrompt{font-size:14px;font-weight:500;color:var(--text-primary);margin-bottom:12px}
        .consentTextFarsi{font-size:16px;font-weight:500;color:var(--text-primary);text-align:right;direction:rtl;padding:12px;background:var(--bg-primary);border-radius:8px;margin-bottom:4px;font-family:var(--font-farsi);line-height:var(--farsi-line-height)}
        .consentTextEnglish{font-size:12px;color:var(--text-muted);font-style:italic;margin-bottom:16px}
        .consentInput{width:100%;padding:12px 14px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;direction:rtl;text-align:right;margin-bottom:16px;font-family:var(--font-farsi);line-height:var(--farsi-line-height);outline:none;transition:border-color 0.15s}
        .consentInput:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(61,127,255,0.1)}
        .consentInput::placeholder{color:var(--text-muted);direction:ltr;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
        /* Issue 2: Donut chart styles */
        .donutChartContainer{display:flex;justify-content:center;margin-bottom:20px}
        .donutChart{transform:rotate(-90deg)}
        .donutCenterLabel{font-size:10px;fill:var(--text-secondary);font-weight:500;transform:rotate(90deg);transform-origin:60px 60px}
        .allocationLegend{display:flex;flex-direction:column;gap:10px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)}
        .legendRow{display:flex;justify-content:space-between;align-items:center}
        .legendLeft{display:flex;align-items:center;gap:8px}
        .legendName{font-size:14px;font-weight:500;color:var(--text-primary)}
        .legendPct{font-size:14px;font-weight:600;color:var(--text-primary)}
        .allocationAssets{display:flex;flex-direction:column;gap:6px}
        .assetRow{display:flex;align-items:center;gap:8px}
        .assetList{font-size:12px;color:var(--text-muted)}
        /* Issue 3: Placeholder preview styles */
        .previewPlaceholder{opacity:0.5}
        .placeholderTotal{text-align:center;padding:20px 0;border-bottom:1px solid var(--border);margin-bottom:16px}
        .placeholderValue{font-size:24px;font-weight:600;color:var(--text-muted);letter-spacing:2px}
        .placeholderLabel{font-size:12px;color:var(--text-muted);margin-top:4px}
        .placeholderBreakdown{display:flex;flex-direction:column;gap:12px;margin-bottom:20px}
        .placeholderRow{display:flex;justify-content:space-between;align-items:center}
        .placeholderLeft{display:flex;align-items:center;gap:8px}
        .placeholderName{font-size:13px;color:var(--text-muted)}
        .placeholderAmount{font-size:13px;font-weight:500;color:var(--text-muted);letter-spacing:1px}
        .layerDot.faded{opacity:0.4}
        .placeholderHint{text-align:center;font-size:12px;color:var(--text-muted);padding:12px;background:var(--bg-primary);border-radius:8px}
        /* Issue 5: Quick amount button styles */
        .quickAmounts{display:flex;gap:8px;margin-bottom:12px}
        .quickAmountBtn{padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-secondary);font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s ease}
        .quickAmountBtn:hover{border-color:var(--accent);color:var(--text-primary)}
        .quickAmountBtn.selected{background:var(--accent);border-color:var(--accent);color:white}
        /* Issue 6 & 7: Holdings row styles */
        .holdingsList{display:flex;flex-direction:column;gap:8px}
        .holdingRow{display:flex;align-items:center;padding:14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;margin-bottom:0;border-left-width:3px;border-left-style:solid;gap:12px}
        .holdingRow.layer-foundation{border-left-color:#34d399}
        .holdingRow.layer-growth{border-left-color:#60a5fa}
        .holdingRow.layer-upside{border-left-color:#fbbf24}
        .holdingRow.assetEmpty{opacity:0.5}
        .holdingInfo{flex:1;min-width:0}
        .holdingName{font-weight:500;font-size:14px;color:var(--text-primary)}
        .holdingLayer{font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;margin-top:2px}
        .holdingValue{font-weight:500;font-size:14px;color:var(--text-primary);text-align:right;min-width:100px}
        .holdingActions{display:flex;gap:6px;align-items:center}
        .btn.small{padding:6px 12px;font-size:12px;border-radius:6px}
        .overflowContainer{position:relative}
        .overflowTrigger{padding:6px 10px;font-size:14px;letter-spacing:1px}
        .overflowMenu{position:absolute;top:100%;right:0;margin-top:4px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-md);min-width:140px;z-index:100;overflow:hidden}
        .overflowItem{display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;border:none;background:none;color:var(--text-primary);font-size:13px;cursor:pointer;text-align:left}
        .overflowItem:hover{background:var(--bg-tertiary)}
        .overflowItem:disabled{opacity:0.4;cursor:not-allowed}
        .overflowIcon{font-size:14px}
        /* Issue 8: Rebalance constraint warning styles */
        .rebalanceConstraintWarning{display:flex;gap:12px;padding:14px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:10px;margin-top:12px}
        .warningIcon{font-size:20px;flex-shrink:0}
        .warningMessages{display:flex;flex-direction:column;gap:6px}
        .warningMessage{font-size:13px;color:var(--text-primary);line-height:1.4}
        .warningMessage:first-child{font-weight:500}
        /* Issue 9: Enhanced ledger styles */
        .ledgerIntro{font-size:12px;color:var(--text-muted);margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)}
        .emptyLedger{text-align:center;padding:40px 20px}
        .emptyIcon{font-size:32px;margin-bottom:12px;opacity:0.5}
        .emptyText{font-size:14px;color:var(--text-secondary);margin-bottom:4px}
        .emptySubtext{font-size:12px;color:var(--text-muted)}
        .ledgerEntry.structural{border-left:3px solid #f59e0b}
        .ledgerEntry.stress{border-left:3px solid #ef4444}
        .boundaryPill{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.03em}
        .boundaryPill.safe{background:rgba(52,211,153,0.15);color:#34d399}
        .boundaryPill.drift{background:rgba(96,165,250,0.15);color:#60a5fa}
        .boundaryPill.structural{background:rgba(251,191,36,0.15);color:#fbbf24}
        .boundaryPill.stress{background:rgba(248,113,113,0.15);color:#f87171}
        .ledgerImpact{padding:12px;background:var(--bg-primary);border-radius:8px;margin-top:12px}
        .impactRow{display:flex;justify-content:space-between;font-size:13px;padding:4px 0}
        .impactLabel{color:var(--text-secondary)}
        .impactValue{font-weight:500;color:var(--text-primary)}
        .impactConstraints{margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
        .constraintNote{font-size:12px;color:var(--warning);padding:2px 0}
        .ledgerId{font-size:10px;color:var(--text-muted);margin-top:12px;font-family:ui-monospace,'SF Mono',monospace}
        /* S-1: Stress mode toggle styles */
        .stressModeToggle{padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-muted);font-size:11px;font-weight:500;cursor:pointer;transition:all 0.15s}
        .stressModeToggle:hover{border-color:var(--border-hover);color:var(--text-secondary)}
        .stressModeToggle.active{background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.3);color:#f87171}
        /* R-1: Rebalance trades preview styles */
        .rebalanceTradesCard{background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;margin-top:12px}
        .rebalanceTradesHeader{font-size:11px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:10px}
        .rebalanceTradesList{display:flex;flex-direction:column;gap:8px}
        .rebalanceTradeRow{display:flex;align-items:center;gap:8px;font-size:13px}
        .tradeName{flex:1;color:var(--text-primary)}
        .tradeAmount{font-weight:500}
        .tradeAmount.buy{color:var(--success)}
        .tradeAmount.sell{color:var(--danger)}
        .rebalanceCashSummary{margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;color:var(--text-secondary)}
        .rebalanceNoTrades{padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;margin-top:12px;font-size:12px;color:var(--text-muted);text-align:center}
        /* Fix 1: Recommendation message with colored dots */
        .recommendationMessage p{margin:0 0 12px 0;font-size:13px}
        .recommendationMessage p:last-child{margin:12px 0 0 0}
        .recommendationLayers{display:flex;flex-direction:column;gap:8px;padding:12px;background:var(--bg-primary);border-radius:8px;margin-bottom:4px}
        .recommendationLayer{display:flex;align-items:center;gap:10px;font-size:13px}
        .recommendationLayer .layerDot{width:8px;height:8px}
        /* Fix 3: Empty holding row distinct styling */
        .holdingRow.assetEmpty{background:repeating-linear-gradient(45deg,var(--bg-secondary),var(--bg-secondary) 10px,rgba(255,255,255,0.02) 10px,rgba(255,255,255,0.02) 20px)}
        .holdingRow.assetEmpty .holdingName{color:var(--text-muted)}
        .holdingRow.assetEmpty .holdingValue{color:var(--text-muted)}
        /* Fix 4: Investment preview with mini donut */
        .investPreviewDonut{display:flex;justify-content:center;margin-bottom:16px}
        /* Fix 5: Loan health indicator */
        .loanHealthIndicator{display:flex;align-items:center;gap:8px;margin-top:4px}
        .loanHealthBar{flex:1;height:6px;background:var(--bg-primary);border-radius:3px;overflow:hidden}
        .loanHealthFill{height:100%;border-radius:3px;transition:width 0.3s,background 0.3s}
        .loanHealthFill.healthy{background:var(--success)}
        .loanHealthFill.warning{background:var(--warning)}
        .loanHealthFill.critical{background:var(--danger)}
        .loanHealthText{font-size:11px;font-weight:500;min-width:40px;text-align:right}
        .loanHealthText.healthy{color:var(--success)}
        .loanHealthText.warning{color:var(--warning)}
        .loanHealthText.critical{color:var(--danger)}
        /* Fix 6: Action log boundary indicator */
        .logEntry.drift{border-left:2px solid var(--warning);padding-left:8px;margin-left:-2px}
        .logEntry.structural{border-left:2px solid var(--danger);padding-left:8px;margin-left:-2px}
        .logBoundaryDot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px}
        .logBoundaryDot.drift{background:var(--warning)}
        .logBoundaryDot.structural{background:var(--danger)}
        /* Fix 7: Holdings grouped by layer */
        .layerSection{margin-bottom:16px}
        .layerSection:last-child{margin-bottom:0}
        .layerSectionHeader{display:flex;align-items:center;gap:8px;padding:8px 0;margin-bottom:8px;border-bottom:1px solid var(--border)}
        .layerSectionTitle{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted)}
        .layerSectionCount{font-size:10px;color:var(--text-muted);background:var(--bg-primary);padding:2px 6px;border-radius:4px}
        /* Fix 8: Rebalance no trades prominent */
        .rebalanceNoTrades{padding:16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;margin-top:12px;text-align:center}
        .rebalanceNoTrades .noTradesIcon{font-size:24px;margin-bottom:8px;opacity:0.5}
        .rebalanceNoTrades .noTradesText{font-size:13px;color:var(--text-secondary)}
        .rebalanceNoTrades .noTradesHint{font-size:11px;color:var(--text-muted);margin-top:4px}
        /* Fix 9: Protection progress bar */
        .protectionProgress{margin-top:8px}
        .protectionProgressBar{height:4px;background:var(--bg-primary);border-radius:2px;overflow:hidden}
        .protectionProgressFill{height:100%;background:var(--accent);border-radius:2px;transition:width 0.3s}
        .protectionProgressText{display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:4px}
      `}</style>
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
                  {state.loan && state.tab !== 'LOANS' && <div className="pill" style={{ color: '#fb923c', borderColor: 'rgba(249,115,22,.3)' }}><span>Loan</span><span>{formatIRR(state.loan.amountIRR)}</span></div>}
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
