// ====== BLU MARKETS REDUCER v10 ======
// All state transitions go through this single reducer
// Actions flow: PREVIEW_* -> pendingAction -> CONFIRM_PENDING -> ledger
// v10: New 12-question risk profiling with pathological user detection

import { computeSnapshot } from '../engine/snapshot.js';
import { classifyActionBoundary, frictionCopyForBoundary } from '../engine/boundary.js';
import { calcPremiumIRR } from '../engine/pricing.js';
import { irrToFixedIncomeUnits } from '../engine/fixedIncome.js';
import {
  validateAddFunds,
  validateTrade,
  validateProtect,
  validateBorrow,
  validateRepay,
  validateRebalance,
} from '../engine/validate.js';
import {
  cloneState,
  previewAddFunds,
  previewTrade,
  previewProtect,
  previewBorrow,
  previewRepay,
  previewRebalance,
  calculateRebalanceGap,
} from '../engine/preview.js';

import { ASSETS } from '../state/domain.js';
import questionnaire from '../data/questionnaire.v2.fa.json';
import { STAGES, THRESHOLDS, WEIGHTS, LAYERS } from '../constants/index.js';
import { uid, nowISO } from '../helpers.js';
import { DEFAULT_PRICES, DEFAULT_FX_RATE } from '../constants/index.js';
import { calculateFinalRisk, answersToRichFormat } from '../engine/riskScoring.js';

/**
 * Build initial portfolio holdings from investment amount and target allocation
 * v10: Holdings now store quantities instead of valueIRR
 *
 * @param {number} totalIRR - Total investment amount in IRR
 * @param {Object} targetLayerPct - Target layer percentages
 * @param {Object} prices - Current asset prices in USD (optional)
 * @param {number} fxRate - USD/IRR exchange rate (optional)
 * @param {string} createdAt - ISO timestamp for fixed income accrual (optional)
 */
export function buildInitialHoldings(totalIRR, targetLayerPct, prices = DEFAULT_PRICES, fxRate = DEFAULT_FX_RATE, createdAt = null) {
  const holdings = ASSETS.map(assetId => ({
    assetId,
    quantity: 0,
    purchasedAt: assetId === 'IRR_FIXED_INCOME' ? createdAt : null,
    frozen: false,
  }));

  // Build O(1) lookup map to avoid repeated O(n) find calls
  const holdingsById = Object.fromEntries(holdings.map(h => [h.assetId, h]));

  for (const layer of LAYERS) {
    const pct = (targetLayerPct[layer] ?? 0) / 100;
    const layerAmountIRR = Math.floor(totalIRR * pct);
    const weights = WEIGHTS[layer] || {};
    let layerAllocated = 0;

    for (const assetId of Object.keys(weights)) {
      const h = holdingsById[assetId];
      if (!h) continue;

      const assetAmountIRR = Math.floor(layerAmountIRR * weights[assetId]);
      layerAllocated += assetAmountIRR;

      // Convert IRR to quantity based on asset type
      if (assetId === 'IRR_FIXED_INCOME') {
        h.quantity = irrToFixedIncomeUnits(assetAmountIRR);
      } else {
        // quantity = IRR / (priceUSD × fxRate)
        const priceUSD = prices[assetId] || DEFAULT_PRICES[assetId] || 1;
        h.quantity = assetAmountIRR / (priceUSD * fxRate);
      }
    }

    // Remainder to last asset in layer
    const remainderIRR = layerAmountIRR - layerAllocated;
    if (remainderIRR > 0) {
      const layerAssets = Object.keys(weights);
      const lastAsset = layerAssets[layerAssets.length - 1];
      const h = holdingsById[lastAsset];
      if (h) {
        if (lastAsset === 'IRR_FIXED_INCOME') {
          h.quantity += irrToFixedIncomeUnits(remainderIRR);
        } else {
          const priceUSD = prices[lastAsset] || DEFAULT_PRICES[lastAsset] || 1;
          h.quantity += remainderIRR / (priceUSD * fxRate);
        }
      }
    }
  }

  return holdings;
}

function buildPending(state, kind, payload, validation, afterState) {
  const before = computeSnapshot(state.holdings, state.cashIRR);
  const after = computeSnapshot(afterState.holdings, afterState.cashIRR);
  const boundary = classifyActionBoundary({
    kind,
    validation,
    before,
    after,
    stressMode: state.stressMode,
    targetLayerPct: state.targetLayerPct,
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

export function initialState() {
  return {
    // Core state from spec
    stage: STAGES.WELCOME,
    phone: null,
    cashIRR: 0,
    // v10: Holdings store quantities instead of valueIRR
    holdings: ASSETS.map(a => ({
      assetId: a,
      quantity: 0,
      purchasedAt: null,  // Used for IRR_FIXED_INCOME accrual
      frozen: false,
    })),
    targetLayerPct: { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 },
    protections: [],
    loans: [],
    ledger: [],
    pendingAction: null,
    stressMode: false,

    // UI state
    questionnaire: { index: 0, answers: {} },
    profileResult: null,  // v10: Risk profile result from questionnaire
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

// Max entries to keep in actionLog to prevent unbounded memory growth
const MAX_ACTION_LOG_SIZE = 50;

function addLogEntry(state, type, data = {}) {
  const now = Date.now();
  const newLog = [...state.actionLog, { id: now, timestamp: now, type, ...data }];
  // Cap log size to prevent unbounded growth
  const cappedLog = newLog.length > MAX_ACTION_LOG_SIZE
    ? newLog.slice(-MAX_ACTION_LOG_SIZE)
    : newLog;
  return { ...state, actionLog: cappedLog };
}

export function reducer(state, action) {
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
      // v10: Store option index for new scoring system
      const question = questionnaire.questions[state.questionnaire.index];
      const optionIndex = question.options.findIndex(o => o.id === action.optionId);
      const answers = { ...state.questionnaire.answers, [action.qId]: optionIndex };
      let idx = state.questionnaire.index + 1;
      let s = { ...state, questionnaire: { index: idx, answers } };

      if (idx >= questionnaire.questions.length) {
        // v10: Use new risk scoring engine
        const richAnswers = answersToRichFormat(answers, questionnaire);
        const profileResult = calculateFinalRisk(richAnswers, questionnaire);
        const targetLayerPct = profileResult.allocation;
        s = { ...s, targetLayerPct, profileResult, stage: STAGES.ONBOARDING_RESULT };
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

      // v10: Pass creation timestamp for fixed income accrual
      // Prices can be passed via action if available from usePrices hook
      const prices = action.prices || DEFAULT_PRICES;
      const fxRate = action.fxRate || DEFAULT_FX_RATE;
      const createdAt = nowISO();

      const holdings = buildInitialHoldings(n, state.targetLayerPct, prices, fxRate, createdAt);
      let s = { ...state, holdings, cashIRR: 0, stage: STAGES.ACTIVE };

      // Create ledger entry
      const entry = {
        id: uid(),
        tsISO: createdAt,
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
      // v10: Include prices and fxRate for quantity-based trade execution
      const prices = action.prices || DEFAULT_PRICES;
      const fxRate = action.fxRate || DEFAULT_FX_RATE;
      const payload = {
        side: state.tradeDraft.side,
        assetId: state.tradeDraft.assetId,
        amountIRR: Number(state.tradeDraft.amountIRR),
        prices,
        fxRate,
      };
      const validation = validateTrade(payload, state);
      const afterState = validation.ok ? previewTrade(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'TRADE', payload, validation, afterState) };
    }

    // ====== PROTECT ======
    case 'START_PROTECT': {
      if (state.stage !== STAGES.ACTIVE) return state;
      // v10: Check quantity instead of valueIRR
      const assetId = action.assetId || state.holdings.find(h => h.quantity > 0)?.assetId;
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
      // v10: Include prices and fxRate for quantity-based value computation
      const prices = action.prices || DEFAULT_PRICES;
      const fxRate = action.fxRate || DEFAULT_FX_RATE;
      const payload = {
        assetId: state.protectDraft.assetId,
        months: Number(state.protectDraft.months),
        prices,
        fxRate,
      };
      const validation = validateProtect(payload, state);
      const afterState = validation.ok ? previewProtect(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'PROTECT', payload, validation, afterState) };
    }

    // ====== BORROW ======
    case 'START_BORROW': {
      if (state.stage !== STAGES.ACTIVE) return state;
      // v10: Check quantity instead of valueIRR
      const available = state.holdings.filter(h => !h.frozen && h.quantity > 0);
      if (available.length === 0) return state;
      const assetId = action.assetId || available[0].assetId;
      return {
        ...state,
        borrowDraft: { assetId, amountIRR: null },
        pendingAction: null,
      };
    }

    case 'SET_BORROW_ASSET': {
      if (!state.borrowDraft) return state;
      return { ...state, borrowDraft: { ...state.borrowDraft, assetId: action.assetId } };
    }

    case 'SET_BORROW_AMOUNT': {
      if (!state.borrowDraft) return state;
      return { ...state, borrowDraft: { ...state.borrowDraft, amountIRR: action.amountIRR } };
    }

    case 'PREVIEW_BORROW': {
      if (state.stage !== STAGES.ACTIVE || !state.borrowDraft) return state;
      // v10: Include prices and fxRate for quantity-based value computation
      const prices = action.prices || DEFAULT_PRICES;
      const fxRate = action.fxRate || DEFAULT_FX_RATE;
      const payload = {
        assetId: state.borrowDraft.assetId,
        amountIRR: Number(state.borrowDraft.amountIRR),
        prices,
        fxRate,
      };
      const validation = validateBorrow(payload, state);
      const afterState = validation.ok ? previewBorrow(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'BORROW', payload, validation, afterState) };
    }

    // ====== REPAY ======
    case 'START_REPAY': {
      if (state.stage !== STAGES.ACTIVE) return state;
      const loans = state.loans || [];
      if (loans.length === 0) return state;
      // Select the loan to repay (passed via action or default to first loan)
      const loanId = action.loanId || loans[0].id;
      const loan = loans.find((l) => l.id === loanId);
      if (!loan) return state;
      return {
        ...state,
        repayDraft: { loanId: loan.id, amountIRR: loan.amountIRR },
        pendingAction: null,
      };
    }

    case 'PREVIEW_REPAY': {
      if (state.stage !== STAGES.ACTIVE || !state.repayDraft) return state;
      const payload = { loanId: state.repayDraft.loanId, amountIRR: state.repayDraft.amountIRR };
      const validation = validateRepay(payload, state);
      const afterState = validation.ok ? previewRepay(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, 'REPAY', payload, validation, afterState) };
    }

    // ====== REBALANCE ======
    case 'START_REBALANCE': {
      if (state.stage !== STAGES.ACTIVE) return state;
      // Calculate rebalance gap to determine if locked assets prevent full rebalancing
      const prices = action.prices || DEFAULT_PRICES;
      const fxRate = action.fxRate || DEFAULT_FX_RATE;
      const gapAnalysis = calculateRebalanceGap(state, prices, fxRate);

      return {
        ...state,
        rebalanceDraft: {
          mode: 'HOLDINGS_ONLY',
          useCash: false,  // User opt-in for using cash
          useCashAmount: 0,
          gapAnalysis,  // Store gap analysis for UI display
        },
        pendingAction: null,
      };
    }

    case 'SET_REBALANCE_USE_CASH': {
      if (!state.rebalanceDraft) return state;
      const useCash = Boolean(action.useCash);
      const gapAnalysis = state.rebalanceDraft.gapAnalysis;

      // Calculate how much cash to use
      let useCashAmount = 0;
      if (useCash && gapAnalysis) {
        if (gapAnalysis.cashSufficient) {
          // Use exactly what's needed for perfect balance
          useCashAmount = gapAnalysis.cashNeededForPerfectBalance;
        } else {
          // Use all available cash to get as close as possible
          useCashAmount = gapAnalysis.currentCash;
        }
      }

      return {
        ...state,
        rebalanceDraft: {
          ...state.rebalanceDraft,
          useCash,
          useCashAmount,
        },
      };
    }

    case 'PREVIEW_REBALANCE': {
      if (state.stage !== STAGES.ACTIVE) return state;
      // v10: Include prices and fxRate for quantity-based rebalance execution
      const prices = action.prices || DEFAULT_PRICES;
      const fxRate = action.fxRate || DEFAULT_FX_RATE;

      // Determine mode and cash usage based on user selection
      const draft = state.rebalanceDraft || {};
      const useCash = draft.useCash && draft.useCashAmount > 0;

      const payload = {
        mode: useCash ? 'SMART' : 'HOLDINGS_ONLY',
        prices,
        fxRate,
        useCashAmount: useCash ? draft.useCashAmount : 0,
      };

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
          // v10: Get notionalIRR from computed snapshot, not holding directly
          const notionalIRR = p.after.holdingsIRRByAsset[holding.assetId] || 0;

          const premium = calcPremiumIRR({
            assetId: holding.assetId,
            notionalIRR,
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
              notionalIRR,
              premiumIRR: premium,
              durationMonths: p.payload.months,
              startISO,
              endISO,
            },
          ];
        }
      }

      // Reuse after snapshot from preview instead of recomputing
      // (state is deterministic, so after snapshot is identical)
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
          after: p.after,
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
      next.lastAction = {
        type: p.kind,
        timestamp: Date.now(),
        ...p.payload,
        // Include boundary and rebalanceMeta for accurate toast messaging
        boundary: p.boundary,
        rebalanceMeta: p.rebalanceMeta,
      };
      // Fix 6: Include boundary in action log for indicators
      next = addLogEntry(next, p.kind, { ...p.payload, boundary: p.boundary });

      // G-3: Portfolio Gravity - return to Portfolio Home after any action
      next.tab = 'PORTFOLIO';

      return next;
    }

    // ====== CANCEL PROTECTION ======
    case 'CANCEL_PROTECTION': {
      if (state.stage !== STAGES.ACTIVE) return state;
      const protectionId = action.protectionId;
      const protection = state.protections.find(p => p.id === protectionId);
      if (!protection) return state;

      // Remove protection (no refund - premium was for the coverage period)
      const newProtections = state.protections.filter(p => p.id !== protectionId);

      // Create ledger entry
      const entry = {
        id: uid(),
        tsISO: nowISO(),
        type: 'PROTECTION_CANCELLED_COMMIT',
        details: {
          protectionId,
          assetId: protection.assetId,
        },
      };

      let next = {
        ...state,
        protections: newProtections,
        ledger: [...state.ledger, entry],
        lastAction: { type: 'PROTECTION_CANCELLED', timestamp: Date.now(), assetId: protection.assetId },
      };
      next = addLogEntry(next, 'PROTECTION_CANCELLED', { assetId: protection.assetId });

      return next;
    }

    default:
      return state;
  }
}
