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

const questionnaire = {
  "version": "v9.6",
  "consent_exact": "متوجه ریسک این سبد دارایی شدم و باهاش موافق هستم.",
  "consent_english": "I understand the risk of this portfolio and I agree with it.",
  "questions": [
    { "id": "q_income", "text": "هر ماه می‌دونی چقدر پول قراره بیاد؟", "english": "Do you know how much money is coming in each month?", "options": [
      { "id": "inc_fixed", "text": "آره، حقوقم ثابته", "english": "Yes, my salary is fixed", "risk": 0 },
      { "id": "inc_mostly", "text": "تقریباً، ولی یه کم بالا پایین داره", "english": "Roughly, but it varies a bit", "risk": 1 },
      { "id": "inc_variable", "text": "نه، هر ماه فرق می‌کنه", "english": "No, it's different every month", "risk": 2 }
    ]},
    { "id": "q_buffer", "text": "اگه یه خرج بزرگ غیرمنتظره پیش بیاد، بدون دست زدن به این پول چقدر دووم میاری؟", "english": "If a big unexpected expense came up, how long could you last without touching this money?", "options": [
      { "id": "buf_none", "text": "نمی‌تونم، باید از همین بردارم", "english": "I can't, I'd have to use this", "risk": 0 },
      { "id": "buf_short", "text": "یکی دو ماه، بیشتر نه", "english": "A month or two, no more", "risk": 1 },
      { "id": "buf_long", "text": "چند ماه راحت، جدا پس‌انداز دارم", "english": "Several months easily, I have separate savings", "risk": 2 }
    ]},
    { "id": "q_dependency", "text": "این پول قراره خرج چیزی بشه؟ مثلاً قسط، اجاره، خرج خونه؟", "english": "Is this money meant to cover something?", "options": [
      { "id": "dep_yes", "text": "آره، باهاش خرج ثابت دارم", "english": "Yes, I have fixed expenses with it", "risk": 0 },
      { "id": "dep_partial", "text": "شاید یه بخشیش رو لازم داشته باشم", "english": "I might need part of it", "risk": 1 },
      { "id": "dep_no", "text": "نه، این پول اضافه‌ست", "english": "No, this is extra money", "risk": 2 }
    ]},
    { "id": "q_horizon", "text": "کِی ممکنه این پول رو لازم داشته باشی؟", "english": "When might you need this money?", "options": [
      { "id": "hz_soon", "text": "شاید چند ماه دیگه", "english": "Maybe in a few months", "risk": 0 },
      { "id": "hz_mid", "text": "یکی دو سال دیگه احتمالاً", "english": "Probably in a year or two", "risk": 1 },
      { "id": "hz_long", "text": "فعلاً خبری نیست، بلندمدته", "english": "Nothing soon, it's long-term", "risk": 2 }
    ]},
    { "id": "q_past_behavior", "text": "قبلاً شده چیزی بخری و قیمتش بیفته؟ چیکار کردی؟", "english": "Have you ever bought something and its price dropped?", "options": [
      { "id": "past_sold", "text": "فروختم که بیشتر ضرر نکنم", "english": "Sold it to avoid more loss", "risk": 0 },
      { "id": "past_stressed", "text": "نگهش داشتم ولی کلی استرس داشتم", "english": "Kept it but was very stressed", "risk": 1 },
      { "id": "past_fine", "text": "نگهش داشتم، زیاد فکرم رو درگیر نکرد", "english": "Kept it, didn't think about it much", "risk": 2 },
      { "id": "past_never", "text": "نه، تاحالا برام پیش نیومده", "english": "No, this hasn't happened to me", "risk": 1 }
    ]},
    { "id": "q_check_freq", "text": "وقتی پولت جایی گذاشتی، هر چند وقت یه بار سر می‌زنی ببینی چی شده؟", "english": "How often do you check on your investments?", "options": [
      { "id": "check_daily", "text": "هر روز، بعضی وقتا چند بار", "english": "Every day, sometimes multiple times", "risk": 0 },
      { "id": "check_weekly", "text": "هفته‌ای یه بار، دو بار", "english": "Once or twice a week", "risk": 1 },
      { "id": "check_rarely", "text": "خیلی کم، وقتی یادم بیفته", "english": "Rarely, when I remember", "risk": 2 }
    ]},
    { "id": "q_regret", "text": "کدوم بیشتر ناراحتت می‌کنه؟", "english": "Which bothers you more?", "options": [
      { "id": "regret_loss", "text": "پولم کم شد، ضرر کردم", "english": "My money went down, I lost", "risk": 0 },
      { "id": "regret_both", "text": "هر دو بد هستن، ولی ضرر بدتره", "english": "Both are bad, but losing is worse", "risk": 1 },
      { "id": "regret_miss", "text": "نخریدم و سودش رو از دست دادم", "english": "I didn't buy and missed the gains", "risk": 2 }
    ]},
    { "id": "q_forced_exit", "text": "اگه مجبور بشی همین الان همه‌ی این پول رو نقد کنی، چقدر به‌هم می‌ریزی؟", "english": "If you had to cash out right now?", "options": [
      { "id": "exit_bad", "text": "خیلی، روش حساب باز کردم", "english": "A lot, I'm counting on it", "risk": 0 },
      { "id": "exit_ok", "text": "یه کم اذیت میشم ولی نه خیلی", "english": "A bit annoying but not too much", "risk": 1 },
      { "id": "exit_fine", "text": "هیچی، فقط می‌خوام رشد کنه", "english": "Nothing, I just want it to grow", "risk": 2 }
    ]}
  ]
};

const LAYER_EXPLANATIONS = {
  FOUNDATION: { name: 'Foundation', nameFa: 'پایه', icon: '🛡️', assets: ['USDT', 'Fixed Income'], description: 'Stable assets. Your safety net.', descriptionFa: 'دارایی‌های پایدار. پشتوانه‌ی امنت.' },
  GROWTH: { name: 'Growth', nameFa: 'رشد', icon: '📈', assets: ['Gold', 'BTC', 'QQQ'], description: 'Balanced assets for steady growth.', descriptionFa: 'دارایی‌های متعادل برای رشد تدریجی.' },
  UPSIDE: { name: 'Upside', nameFa: 'رشد بالا', icon: '🚀', assets: ['ETH', 'SOL', 'TON'], description: 'Higher potential, more ups and downs.', descriptionFa: 'پتانسیل بالاتر، بالا و پایین بیشتر.' },
};

const PORTFOLIO_STATUS_LABELS = { BALANCED: 'Balanced', SLIGHTLY_OFF: 'Slightly Off', ATTENTION_REQUIRED: 'Attention Required' };
const BOUNDARY_LABELS = { SAFE: 'Safe', DRIFT: 'Drift', STRUCTURAL: 'Structural', STRESS: 'Stress' };

function formatIRR(n) { return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' IRR'; }
function formatIRRShort(n) {
  const num = Number(n) || 0;
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}
function formatTime(ts) { return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }); }
function formatTimestamp(ts) { return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

const ASSET_DISPLAY_NAMES = {
  'IRR_FIXED_INCOME': 'Fixed Income (IRR)',
  'USDT': 'USDT',
  'GOLD': 'Gold',
  'BTC': 'Bitcoin',
  'ETH': 'Ethereum',
  'QQQ': 'QQQ',
  'SOL': 'Solana',
  'TON': 'Toncoin',
};
function getAssetDisplayName(assetId) { return ASSET_DISPLAY_NAMES[assetId] || assetId; }

const THRESHOLDS = { MIN_AMOUNT_IRR: 1_000_000 };

// Asset weights for initial portfolio distribution
const WEIGHTS = {
  FOUNDATION: { IRR_FIXED_INCOME: 0.55, USDT: 0.45 },
  GROWTH: { GOLD: 0.20, BTC: 0.50, QQQ: 0.30 },
  UPSIDE: { ETH: 0.40, SOL: 0.35, TON: 0.25 },
};

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

const STAGES = {
  WELCOME: 'WELCOME',
  ONBOARDING_PHONE: 'ONBOARDING_PHONE',
  ONBOARDING_QUESTIONNAIRE: 'ONBOARDING_QUESTIONNAIRE',
  ONBOARDING_RESULT: 'ONBOARDING_RESULT',
  AMOUNT_REQUIRED: 'AMOUNT_REQUIRED',
  ACTIVE: 'ACTIVE',
};

function uid() {
  return `${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function computeTargetLayersFromAnswers(answers) {
  let risk = 0;
  for (const q of questionnaire.questions) {
    const opt = q.options.find(o => o.id === answers[q.id]);
    risk += (opt?.risk ?? 0);
  }
  if (risk <= 5) return { FOUNDATION: 65, GROWTH: 30, UPSIDE: 5 };
  if (risk <= 10) return { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 };
  return { FOUNDATION: 40, GROWTH: 40, UPSIDE: 20 };
}

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

  return {
    kind,
    payload,
    before,
    after,
    validation,
    boundary,
    frictionCopy: frictionCopyForBoundary(boundary),
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
        const targetLayerPct = computeTargetLayersFromAnswers(answers);
        s = { ...s, targetLayerPct, stage: STAGES.ONBOARDING_RESULT };
      }
      return s;
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
        rebalanceDraft: { mode: 'HOLDINGS_PLUS_CASH' },
        pendingAction: null,
      };
    }

    case 'PREVIEW_REBALANCE': {
      if (state.stage !== STAGES.ACTIVE) return state;
      const payload = { mode: state.rebalanceDraft?.mode || 'HOLDINGS_PLUS_CASH' };
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
      next = addLogEntry(next, p.kind, p.payload);

      return next;
    }

    default:
      return state;
  }
}

// ====== UI COMPONENTS ======

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

  const renderLogEntry = (entry) => {
    const time = formatTime(entry.timestamp);
    if (entry.type === 'REBALANCE') {
      return <span>{time}  ⚖️ Rebalanced</span>;
    }
    switch (entry.type) {
      case 'PORTFOLIO_CREATED': return `${time}  Started with ${formatIRRShort(entry.amountIRR)}`;
      case 'ADD_FUNDS': return `${time}  +${formatIRRShort(entry.amountIRR)} cash`;
      case 'TRADE': return `${time}  ${entry.side === 'BUY' ? '+' : '-'}${getAssetDisplayName(entry.assetId)} ${formatIRRShort(entry.amountIRR)}`;
      case 'BORROW': return `${time}  💰 Borrowed ${formatIRRShort(entry.amountIRR)}`;
      case 'REPAY': return `${time}  ✓ Repaid ${formatIRRShort(entry.amountIRR)}`;
      case 'PROTECT': return `${time}  ☂️ ${getAssetDisplayName(entry.assetId)} protected ${entry.months}mo`;
      default: return `${time}  ${entry.type}`;
    }
  };

  return <div className="actionLog" ref={logRef}>{actionLog.map((entry) => <div key={entry.id} className="logEntry">{renderLogEntry(entry)}</div>)}</div>;
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
        <h1 className="welcomeTitle">Blu Markets</h1>
        <p className="welcomeMotto">Markets, but mindful</p>
        <p className="welcomeTagline">Your wealth, your pace, your future.</p>
        <button className="btn primary welcomeCta" onClick={() => dispatch({ type: 'START_ONBOARDING' })}>Get Started</button>
      </div>
    );
  }
  if (stage === STAGES.ONBOARDING_PHONE) {
    return (
      <div className="onboardingPanel">
        <div className="welcomeCard">
          <div className="welcomeIcon">🏦</div>
          <h2>Welcome</h2>
          <p>A calm approach to building wealth.</p>
          <div className="welcomeFeatures">
            {['FOUNDATION', 'GROWTH', 'UPSIDE'].map(layer => {
              const info = LAYER_EXPLANATIONS[layer];
              return <div key={layer} className="featureItem"><span className={`layerDot ${layer.toLowerCase()}`}></span><span>{`${info.name} — ${info.description.split('.')[0]}`}</span></div>;
            })}
          </div>
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
          <h3>Your Allocation</h3>
          <div className="allocationViz">
            {['FOUNDATION', 'GROWTH', 'UPSIDE'].map(layer => {
              const info = LAYER_EXPLANATIONS[layer];
              const pct = targetLayers?.[layer] || 0;
              return <div key={layer} className={`allocationBar ${layer.toLowerCase()}`} style={{ flex: pct }}><span className="barIcon">{info.icon}</span><span className="barPct">{pct}%</span></div>;
            })}
          </div>
          <div className="allocationDetails">
            {['FOUNDATION', 'GROWTH', 'UPSIDE'].map(layer => {
              const info = LAYER_EXPLANATIONS[layer];
              const pct = targetLayers?.[layer] || 0;
              return <div key={layer} className="detailRow"><div className="detailHeader"><span className={`layerDot ${layer.toLowerCase()}`} style={{ marginRight: 8 }}></span><span className="detailName">{info.name}</span><span className="detailPct">{pct}%</span></div><div className="detailAssets">{info.assets.join(' · ')}</div></div>;
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
          <h3>Investment Preview</h3>
          {hasInput ? (
            <>
              <div className="investTotal">
                <div className="portfolioValue">{formatIRR(amount)}</div>
                {!isValid && <div className="investWarning">Minimum: {formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}</div>}
              </div>
              {isValid && <div className="investBreakdown">
                {['FOUNDATION', 'GROWTH', 'UPSIDE'].map(layer => {
                  const info = LAYER_EXPLANATIONS[layer];
                  const pct = targetLayers?.[layer] || 0;
                  return <div key={layer} className="breakdownRow"><div className="breakdownLeft"><span className={`layerDot ${layer.toLowerCase()}`} style={{ marginRight: 8 }}></span><span>{info.name}</span></div><div className="breakdownRight"><span className="breakdownAmount">{formatIRR(Math.floor(amount * pct / 100))}</span></div></div>;
                })}
              </div>}
            </>
          ) : (
            <div className="investPlaceholder">
              <div className="muted">Enter an amount to see your allocation</div>
              <div className="investMinHint">Minimum: {formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}</div>
            </div>
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

function HistoryPane({ ledger }) {
  const [expanded, setExpanded] = useState({});
  if (!ledger || ledger.length === 0) return <div className="card"><h3>Action History</h3><div className="muted">No actions yet.</div></div>;

  const getActionIcon = (entry) => {
    const type = entry.type.replace('_COMMIT', '');
    if (type === 'TRADE') return entry.details?.payload?.side === 'BUY' ? '+' : '-';
    const icons = { 'PORTFOLIO_CREATED': '✓', 'ADD_FUNDS': '+', 'REBALANCE': '⟲', 'PROTECT': '☂️', 'BORROW': '💰', 'REPAY': '✓' };
    return icons[type] || '•';
  };

  const formatLedgerAction = (entry) => {
    const type = entry.type.replace('_COMMIT', '');
    const payload = entry.details?.payload;
    switch (type) {
      case 'PORTFOLIO_CREATED': return 'Portfolio Created';
      case 'ADD_FUNDS': return 'Funds Added';
      case 'TRADE': return `${payload?.side === 'BUY' ? 'Bought' : 'Sold'} ${getAssetDisplayName(payload?.assetId)}`;
      case 'REBALANCE': return 'Rebalanced';
      case 'PROTECT': return `Protected ${getAssetDisplayName(payload?.assetId)} (${payload?.months}mo)`;
      case 'BORROW': return `Borrowed`;
      case 'REPAY': return 'Loan Repaid';
      default: return type;
    }
  };

  return (
    <div className="card">
      <h3>Action History</h3>
      <div className="ledgerList">
        {[...ledger].reverse().map((entry) => (
          <div key={entry.id} className="ledgerEntry">
            <div className="ledgerHeader" onClick={() => setExpanded(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))} style={{ cursor: 'pointer' }}>
              <span className="ledgerIcon">{getActionIcon(entry)}</span>
              <span className="ledgerAction">{formatLedgerAction(entry)}</span>
              <span className="ledgerTime">{formatTimestamp(new Date(entry.tsISO).getTime())}</span>
              <span className="ledgerExpand">{expanded[entry.id] ? '−' : '+'}</span>
            </div>
            {entry.details?.boundary && <div className="ledgerBoundary"><span className={`healthPill small ${entry.details.boundary.toLowerCase()}`}>{BOUNDARY_LABELS[entry.details.boundary]}</span></div>}
          </div>
        ))}
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
        <h3>Holdings</h3>
        <div className="list">
          {state.holdings.map((h) => {
            const layer = ASSET_LAYER[h.assetId];
            const info = LAYER_EXPLANATIONS[layer];
            const protDays = getProtectionDays(h.assetId);
            const isEmpty = h.valueIRR === 0;
            return (
              <div key={h.assetId} className={`item ${isEmpty ? 'assetEmpty' : ''}`} style={{ alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div className="asset">{getAssetDisplayName(h.assetId)}</div>
                  <div className="muted">
                    {info.icon} {info.name}
                    {protDays !== null ? ` · ☂️ Protected (${protDays}d)` : ''}
                    {h.frozen ? ` · 🔒 ${formatIRRShort(h.valueIRR)} IRR locked` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 150 }}>
                  <div className="asset">{formatIRR(h.valueIRR)}</div>
                  <div className="assetActions">
                    <button className="btn tiny" onClick={() => onStartTrade(h.assetId, 'BUY')}>Buy</button>
                    <button className="btn tiny" disabled={h.frozen || isEmpty} onClick={() => onStartTrade(h.assetId, 'SELL')}>Sell</button>
                    <button className="btn tiny" disabled={isEmpty} onClick={() => onStartProtect?.(h.assetId)}>Protect</button>
                    <button className="btn tiny" disabled={h.frozen || isEmpty} onClick={() => onStartBorrow?.(h.assetId)}>Borrow</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
            return (
              <div key={p.id || idx} className="item protectionItem">
                <div style={{ flex: 1 }}>
                  <div className="asset">☂️ {getAssetDisplayName(p.assetId)}</div>
                  <div className="muted"><span className={`layerDot ${layer.toLowerCase()}`} style={{ marginRight: 6 }}></span>{info?.name} · {daysLeft} days left</div>
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

  const { kind, payload, before, after, validation, boundary, frictionCopy } = pendingAction;
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
          {validation.errors.map((e, i) => <div key={i} className="validationError">{e}</div>)}
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

          {frictionCopy.length > 0 && (
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
    return (
      <div>
        <div className="consentCard">
          <div className="consentHeader">Confirm allocation</div>
          <div className="consentInstruction">Type the following sentence exactly:</div>
          <div className="consentSentence">
            <div className="sentenceFa">{questionnaire.consent_exact}</div>
            <div className="sentenceEn">{questionnaire.consent_english}</div>
          </div>
          <input className="input" type="text" dir="rtl" placeholder="Type consent here..." value={consentText} onChange={(e) => setConsentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && isConsentMatch) dispatch({ type: 'SUBMIT_CONSENT', text: consentText }); }} />
          <button className="btn primary" style={{ marginTop: 10, width: '100%' }} disabled={!isConsentMatch} onClick={() => dispatch({ type: 'SUBMIT_CONSENT', text: consentText })}>Confirm</button>
        </div>
      </div>
    );
  }

  if (state.stage === STAGES.AMOUNT_REQUIRED) {
    const amount = Number(state.investAmountIRR) || 0;
    const isValid = amount >= THRESHOLDS.MIN_AMOUNT_IRR;
    return (
      <div>
        <div className="muted" style={{ marginBottom: 10 }}>Investment amount (IRR)</div>
        <div className="row">
          <input className="input" type="number" placeholder={formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)} value={state.investAmountIRR || ''} onChange={(e) => dispatch({ type: 'SET_INVEST_AMOUNT', amountIRR: e.target.value })} />
          <button className="btn primary" onClick={() => dispatch({ type: 'EXECUTE_PORTFOLIO' })} disabled={!isValid}>Create Portfolio</button>
        </div>
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
        .stack{display:flex;flex-direction:column;gap:0}
        .portfolioValue{font-size:28px;font-weight:600;color:var(--text-primary)}
        .welcomeScreen{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px 24px}
        .welcomeLogo{width:64px;height:64px;background:var(--accent);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:white;margin-bottom:24px}
        .welcomeTitle{font-size:28px;font-weight:600;color:var(--text-primary);margin:0 0 8px 0}
        .welcomeMotto{font-size:16px;color:var(--text-secondary);margin:0 0 8px 0;font-weight:400}
        .welcomeTagline{font-size:13px;color:var(--text-muted);margin:0 0 32px 0}
        .welcomeCta{padding:12px 40px;font-size:14px}
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
              <div className="h-title">{state.stage === STAGES.ACTIVE ? 'Portfolio' : 'Getting Started'}</div>
              <div className="h-sub">{state.stage === STAGES.ACTIVE ? `Cash: ${formatIRR(state.cashIRR || 0)}` : 'Complete the steps'}</div>
            </div>
            <div className="rightMeta">
              {state.stage === STAGES.ACTIVE && (
                <>
                  <PortfolioHealthBadge snapshot={snapshot} />
                  {state.loan && <div className="pill" style={{ color: '#fb923c', borderColor: 'rgba(249,115,22,.3)' }}><span>Loan</span><span>{formatIRR(state.loan.amountIRR)}</span></div>}
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
