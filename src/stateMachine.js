import questionnaire from './data/questionnaire.fa.json'
import { buildPortfolio, calcLayerPercents, tradeAsset, rebalanceToTarget } from './engine.js'
import { formatIRR } from './helpers.js'

export const STAGES = {
  PHONE_REQUIRED: 'PHONE_REQUIRED',
  QUESTIONNAIRE: 'QUESTIONNAIRE',
  ALLOCATION_PROPOSED: 'ALLOCATION_PROPOSED',
  AMOUNT_REQUIRED: 'AMOUNT_REQUIRED',
  EXECUTED: 'EXECUTED',
};

export const POST_ACTIONS = {
  NONE: 'NONE',

  ADD_FUNDS: 'ADD_FUNDS',
  ADD_FUNDS_PREVIEW: 'ADD_FUNDS_PREVIEW',

  TRADE: 'TRADE',
  TRADE_PREVIEW: 'TRADE_PREVIEW',

  REBALANCE: 'REBALANCE',
  REBALANCE_PREVIEW: 'REBALANCE_PREVIEW',

  PROTECT: 'PROTECT',
  PROTECT_PREVIEW: 'PROTECT_PREVIEW',

  BORROW: 'BORROW',
  BORROW_PREVIEW: 'BORROW_PREVIEW',
};

const CONSENT_EXACT = questionnaire.consent_exact;

export function initialState() {
  return {
    protectError: null,
    user: {
      stage: STAGES.PHONE_REQUIRED,
      phone: '',
      investAmountIRR: null,
    },

    questionnaire: {
      index: 0,
      answers: {},
    },

    // target allocation set by questionnaire + consent
    targetLayers: null,

    // invested portfolio (holdings) — cash is separate
    portfolio: null,
    cashIRR: 0,

    tab: 'PORTFOLIO',

    protections: [], // { assetId, protectedUntil, premiumIRR }
    loan: null,      // { collateralAssetId, amountIRR, ltv, liquidationIRR }

    postAction: POST_ACTIONS.NONE,

    pendingAmountIRR: null,  // generic amount input
    tradeDraft: null,        // { assetId, side, amountIRR }
    protectDraft: null,      // { assetId, months }
    borrowDraft: null,       // { assetId, ltv, amountIRR }

    preview: null,           // { before:{totalIRR,layers}, after:{totalIRR,layers}, deltas }
    softWarning: null,       // string

    messages: [{ from: 'system', text: 'Enter your phone number.' }],
  };
}

function addMessage(state, from, text) {
  return { ...state, messages: [...state.messages, { from, text }] };
}

function computeTargetLayersFromAnswers(answers) {
  let risk = 0;
  for (const q of questionnaire.questions) {
    const optId = answers[q.id];
    const opt = q.options.find(o => o.id === optId);
    risk += (opt?.risk ?? 0);
  }
  if (risk <= 4) return { foundation: 65, growth: 30, upside: 5 };
  if (risk <= 9) return { foundation: 50, growth: 35, upside: 15 };
  return { foundation: 40, growth: 40, upside: 20 };
}

function exposureSnapshot(portfolio, cashIRR) {
  const { pct, totalIRR } = calcLayerPercents(portfolio?.holdings || [], cashIRR || 0);
  return { totalIRR, layers: pct };
}

function buildPreview(beforePortfolio, beforeCash, afterPortfolio, afterCash) {
  const before = exposureSnapshot(beforePortfolio, beforeCash);
  const after = exposureSnapshot(afterPortfolio, afterCash);
  const deltas = {
    totalIRR: after.totalIRR - before.totalIRR,
    layers: {
      foundation: after.layers.foundation - before.layers.foundation,
      growth: after.layers.growth - before.layers.growth,
      upside: after.layers.upside - before.layers.upside,
    },
  };
  return { before, after, deltas };
}

function getSoftWarning(afterLayersPct) {
  const upside = afterLayersPct?.upside ?? 0;
  const foundation = afterLayersPct?.foundation ?? 0;
  if (upside > 20) return 'This action increases portfolio risk beyond your target range.';
  if (foundation < 40) return 'This action reduces your Foundation buffer below the typical target range.';
  return null;
}

function requireExecuted(state) {
  return state.user.stage === STAGES.EXECUTED && state.portfolio;
}

function minAmountGuard(n) {
  if (!Number.isFinite(n) || n <= 0) return 'Amount must be a positive number.';
  if (n < 1_000_000) return 'Minimum is 1,000,000 IRR (prototype guard).';
  return null;
}

export function reduce(state, event) {
  switch (event.type) {
    case 'RESET':
      return initialState();

    case 'SET_TAB': {
      return { ...state, tab: event.tab };
    }

    case 'SET_PHONE': {
      const phone = String(event.phone || '');
      let s = { ...state, user: { ...state.user, phone } };
      return s;
    }

    case 'SUBMIT_PHONE': {
      const phone = String(state.user.phone || '');
      if (!phone.startsWith('+989') || phone.length !== 13) {
        return addMessage(state, 'system', 'Phone must be in format +989XXXXXXXXX.');
      }
      let s = addMessage(state, 'user', phone);
      s = { ...s, user: { ...s.user, stage: STAGES.QUESTIONNAIRE } };
      s = addMessage(s, 'system', 'Answer a few questions to personalize your portfolio.');
      return s;
    }

    case 'ANSWER_QUESTION': {
      if (state.user.stage !== STAGES.QUESTIONNAIRE) return state;
      const { qId, optionId } = event;
      const answers = { ...state.questionnaire.answers, [qId]: optionId };
      let idx = state.questionnaire.index + 1;

      let s = { ...state, questionnaire: { index: idx, answers } };

      // last question?
      if (idx >= questionnaire.questions.length) {
        const targetLayers = computeTargetLayersFromAnswers(answers);
        s = { ...s, targetLayers, user: { ...s.user, stage: STAGES.ALLOCATION_PROPOSED } };
        s = addMessage(s, 'system', `Suggested target allocation: Foundation ${targetLayers.foundation}% · Growth ${targetLayers.growth}% · Upside ${targetLayers.upside}%.`);
        s = addMessage(s, 'system', 'If you agree, paste the exact consent sentence.');
      }
      return s;
    }

    case 'SUBMIT_CONSENT': {
      if (state.user.stage !== STAGES.ALLOCATION_PROPOSED) return state;
      const text = String(event.text || '');
      let s = addMessage(state, 'user', text);

      if (text !== CONSENT_EXACT) {
        s = addMessage(s, 'system', 'Consent sentence must match exactly.');
        s = addMessage(s, 'system', CONSENT_EXACT);
        return s;
      }

      s = { ...s, user: { ...s.user, stage: STAGES.AMOUNT_REQUIRED } };
      s = addMessage(s, 'system', 'Enter the amount (IRR) you want to invest now.');
      return s;
    }

    case 'SET_INVEST_AMOUNT': {
      if (state.user.stage !== STAGES.AMOUNT_REQUIRED) return state;
      return { ...state, user: { ...state.user, investAmountIRR: event.investAmountIRR ?? event.amountIRR } };
    }

    case 'EXECUTE_PORTFOLIO': {
      if (state.user.stage !== STAGES.AMOUNT_REQUIRED) return state;

      const n = Math.floor(Number(state.user.investAmountIRR) || 0);
      const guard = minAmountGuard(n);
      if (guard) return addMessage(state, 'system', guard);

      const portfolio = buildPortfolio(n, state.targetLayers);
      let s = addMessage(state, 'system', 'Execution complete.');
      s = { ...s, portfolio, cashIRR: 0, user: { ...s.user, stage: STAGES.EXECUTED } };
      s = addMessage(s, 'system', `${n.toLocaleString('en-US')} IRR invested across assets.`);
      return s;
    }

    // ===== Post-onboarding commands =====

    case 'CANCEL_POST_ACTION': {
      if (!requireExecuted(state)) return state;
      return {
        ...state,
        postAction: POST_ACTIONS.NONE,
        pendingAmountIRR: null,
        tradeDraft: null,
        protectDraft: null,
        borrowDraft: null,
        preview: null,
        softWarning: null,
      };
    }

    // ---- Add funds (goes to cash wallet) ----
    case 'START_ADD_FUNDS': {
      if (!requireExecuted(state)) return state;
      let s = addMessage(state, 'user', 'Add funds');
      s = { ...s, postAction: POST_ACTIONS.ADD_FUNDS, pendingAmountIRR: null, preview: null, softWarning: null };
      s = addMessage(s, 'system', 'Enter top-up amount (IRR). Funds will go to cash.');
      return s;
    }

    case 'SET_PENDING_AMOUNT': {
      if (!requireExecuted(state)) return state;
      return { ...state, pendingAmountIRR: event.amountIRR };
    }

    case 'PREVIEW_ADD_FUNDS': {
      if (!requireExecuted(state)) return state;
      const n = Number(state.pendingAmountIRR);
      const guard = minAmountGuard(n);
      if (guard) return addMessage(state, 'system', guard);

      const afterCash = (state.cashIRR || 0) + Math.floor(n);
      const preview = buildPreview(state.portfolio, state.cashIRR, state.portfolio, afterCash);
      const softWarning = getSoftWarning(preview.after.layers);

      let s = { ...state, preview, softWarning, postAction: POST_ACTIONS.ADD_FUNDS_PREVIEW };
      s = addMessage(s, 'system', 'Preview ready. Confirm to add to cash or go back.');
      return s;
    }

    case 'CONFIRM_ADD_FUNDS_FINAL': {
      if (!requireExecuted(state)) return state;
      const n = Number(state.pendingAmountIRR);
      const guard = minAmountGuard(n);
      if (guard) return addMessage(state, 'system', guard);

      const delta = Math.floor(n);
      let s = { ...state, cashIRR: (state.cashIRR || 0) + delta, postAction: POST_ACTIONS.NONE, pendingAmountIRR: null, preview: null, softWarning: null };
      s = addMessage(s, 'system', 'Top-up executed.');
      s = addMessage(s, 'system', `${delta.toLocaleString('en-US')} IRR added to cash.`);
      return s;
    }

    // ---- Trade (buy/sell per asset) ----
    case 'START_TRADE': {
      if (!requireExecuted(state)) return state;
      const assetId = String(event.assetId || '');
      const side = event.side === 'SELL' ? 'SELL' : 'BUY';
      let s = addMessage(state, 'user', side === 'BUY' ? `Buy ${assetId}` : `Sell ${assetId}`);
      s = { ...s, postAction: POST_ACTIONS.TRADE, tradeDraft: { assetId, side, amountIRR: null }, preview: null, softWarning: null };
      s = addMessage(s, 'system', 'Enter amount (IRR).');
      return s;
    }

    case 'SET_TRADE_SIDE': {
      if (!requireExecuted(state)) return state;
      if (!state.tradeDraft) return state;
      const side = event.side === 'SELL' ? 'SELL' : 'BUY';
      return { ...state, tradeDraft: { ...state.tradeDraft, side } };
    }

    case 'SET_TRADE_AMOUNT': {
      if (!requireExecuted(state)) return state;
      if (!state.tradeDraft) return state;
      return { ...state, tradeDraft: { ...state.tradeDraft, amountIRR: event.amountIRR } };
    }

    case 'PREVIEW_TRADE': {
      if (!requireExecuted(state)) return state;
      const d = state.tradeDraft;
      if (!d) return state;

      const n = Number(d.amountIRR);
      const guard = minAmountGuard(n);
      if (guard) return addMessage(state, 'system', guard);

      const after = tradeAsset(state.portfolio, state.cashIRR, d.assetId, d.side, Math.floor(n));
      const preview = buildPreview(state.portfolio, state.cashIRR, after.portfolio, after.cashIRR);
      const softWarning = getSoftWarning(preview.after.layers);

      let s = { ...state, preview, softWarning, postAction: POST_ACTIONS.TRADE_PREVIEW };
      s = addMessage(s, 'system', 'Preview ready. Confirm to execute or go back.');
      return s;
    }

    case 'CONFIRM_TRADE_FINAL': {
      if (!requireExecuted(state)) return state;
      const d = state.tradeDraft;
      if (!d) return state;

      const n = Number(d.amountIRR);
      const guard = minAmountGuard(n);
      if (guard) return addMessage(state, 'system', guard);

      const after = tradeAsset(state.portfolio, state.cashIRR, d.assetId, d.side, Math.floor(n));
      let s = { ...state, portfolio: after.portfolio, cashIRR: after.cashIRR, postAction: POST_ACTIONS.NONE, tradeDraft: null, preview: null, softWarning: null };
      s = addMessage(s, 'system', 'Execution complete.');
      return s;
    }

    // ---- Rebalance (restore target allocation; invests all cash) ----
    case 'START_REBALANCE': {
      if (!requireExecuted(state)) return state;
      let s = addMessage(state, 'user', 'Rebalance');
      s = { ...s, postAction: POST_ACTIONS.REBALANCE, preview: null, softWarning: null };
      s = addMessage(s, 'system', 'Preview rebalance to restore your target allocation?');
      return s;
    }

    case 'PREVIEW_REBALANCE': {
      if (!requireExecuted(state)) return state;
      const total = (state.cashIRR || 0) + (state.portfolio?.totalIRR || 0);
      const afterPortfolio = rebalanceToTarget(total, state.targetLayers);
      const preview = buildPreview(state.portfolio, state.cashIRR, afterPortfolio, 0);
      // rebalance restores integrity; still can warn if extreme, but keep softWarning minimal
      const softWarning = getSoftWarning(preview.after.layers);

      let s = { ...state, preview, softWarning, postAction: POST_ACTIONS.REBALANCE_PREVIEW };
      s = addMessage(s, 'system', 'Preview ready. Confirm to rebalance or go back.');
      return s;
    }

    case 'CONFIRM_REBALANCE_FINAL': {
      if (!requireExecuted(state)) return state;
      const total = (state.cashIRR || 0) + (state.portfolio?.totalIRR || 0);
      const nextPortfolio = rebalanceToTarget(total, state.targetLayers);
      let s = { ...state, portfolio: nextPortfolio, cashIRR: 0, postAction: POST_ACTIONS.NONE, preview: null, softWarning: null };
      s = addMessage(s, 'system', 'Rebalance executed.');
      return s;
    }

    // ---- Protect (deterministic placeholder with real UX) ----
    case 'START_PROTECT': {
      if (!requireExecuted(state)) return state;

      const preferred = event?.assetId || state.portfolio.holdings[0]?.asset;
      if (!preferred) return addMessage(state, 'system', 'No assets available.');

      // If already protected, steer user to the Protection tab instead of duplicating.
      const existing = (state.protections || []).find(p => p.assetId === preferred);
      let s = addMessage(state, 'user', 'Protect');

      if (existing) {
        s = addMessage(s, 'system', `This asset is already protected until ${existing.protectedUntil}.`);
        return s;
      }

      s = { ...s, postAction: POST_ACTIONS.PROTECT, protectDraft: { assetId: preferred, months: 3 }, preview: null, softWarning: null, protectError: null };
      s = addMessage(s, 'system', 'Select an asset and protection duration (1–6 months).');
      return s;
    }

    case 'SET_PROTECT_ASSET': {
      if (!requireExecuted(state)) return state;
      if (!state.protectDraft) return state;
      return { ...state, protectDraft: { ...state.protectDraft, assetId: event.assetId } };
    }

    case 'SET_PROTECT_MONTHS': {
      if (!requireExecuted(state)) return state;
      if (!state.protectDraft) return state;
      return { ...state, protectDraft: { ...state.protectDraft, months: event.months } };
    }

    case 'PREVIEW_PROTECT': {
      if (!requireExecuted(state)) return state;
      const d = state.protectDraft;
      if (!d) return state;

      const months = Math.min(6, Math.max(1, Math.floor(Number(d.months) || 0)));
      const h = state.portfolio.holdings.find(x => x.asset === d.assetId);
      if (!h) return addMessage(state, 'system', 'Asset not found.');
      const premium = Math.floor((h.amountIRR * 0.02 * (months / 3))); // deterministic prototype pricing
      if ((state.cashIRR || 0) < premium) {
        const cash = state.cashIRR || 0;
        const needed = premium - cash;
        const next = addMessage(state, 'system', `Not enough cash to pay premium. Add at least ${formatIRR(needed)} first.`);
        return { ...next, protectError: { neededIRR: needed, premiumIRR: premium, cashIRR: cash } };
      }

      // protection doesn't change allocation; preview is informational only
      const before = exposureSnapshot(state.portfolio, state.cashIRR);
      const after = exposureSnapshot(state.portfolio, (state.cashIRR || 0) - premium);
      const preview = { before, after, deltas: { totalIRR: after.totalIRR - before.totalIRR, layers: { foundation: after.layers.foundation - before.layers.foundation, growth: after.layers.growth - before.layers.growth, upside: after.layers.upside - before.layers.upside } } };
      const softWarning = null;

      let s = { ...state, preview, softWarning, postAction: POST_ACTIONS.PROTECT_PREVIEW };
      s = addMessage(s, 'system', `Premium: ${premium.toLocaleString('en-US')} IRR. Confirm to activate protection.`);
      return s;
    }

    case 'CONFIRM_PROTECT_FINAL': {
      if (!requireExecuted(state)) return state;
      const d = state.protectDraft;
      if (!d) return state;

      const months = Math.min(6, Math.max(1, Math.floor(Number(d.months) || 0)));
      const h = state.portfolio.holdings.find(x => x.asset === d.assetId);
      if (!h) return addMessage(state, 'system', 'Asset not found.');
      const premium = Math.floor((h.amountIRR * 0.02 * (months / 3)));
      if ((state.cashIRR || 0) < premium) {
        const cash = state.cashIRR || 0;
        const needed = premium - cash;
        const next = addMessage(state, 'system', `Not enough cash to pay premium. Add at least ${formatIRR(needed)} first.`);
        return { ...next, protectError: { neededIRR: needed, premiumIRR: premium, cashIRR: cash } };
      }

      const until = new Date();
      until.setMonth(until.getMonth() + months);
      const protectedUntil = until.toISOString().slice(0, 10);

      let s = { ...state, cashIRR: (state.cashIRR || 0) - premium, protections: [...state.protections, { assetId: d.assetId, protectedUntil, premiumIRR: premium }], postAction: POST_ACTIONS.NONE, protectDraft: null, preview: null, softWarning: null };
      s = addMessage(s, 'system', 'Protection activated.');
      return s;
    }

    // ---- Borrow (deterministic placeholder with real UX) ----
    case 'START_BORROW': {
      if (!requireExecuted(state)) return state;

      if (state.loan) {
        let s = addMessage(state, 'user', 'Borrow');
        s = addMessage(s, 'system', 'You already have an active loan. Repay it before taking a new one.');
        return s;
      }

      const preferred = event?.assetId || state.portfolio.holdings[0]?.asset;
      if (!preferred) return addMessage(state, 'system', 'No assets available.');

      let s = addMessage(state, 'user', 'Borrow');
      s = { ...s, postAction: POST_ACTIONS.BORROW, borrowDraft: { assetId: preferred, ltv: 0.5, amountIRR: null }, preview: null, softWarning: null };
      s = addMessage(s, 'system', 'Select collateral asset, LTV, and loan amount (IRR).');
      return s;
    }

    case 'SET_BORROW_ASSET': {
      if (!requireExecuted(state)) return state;
      if (!state.borrowDraft) return state;
      return { ...state, borrowDraft: { ...state.borrowDraft, assetId: event.assetId } };
    }

    case 'SET_BORROW_LTV': {
      if (!requireExecuted(state)) return state;
      if (!state.borrowDraft) return state;
      const ltv = Math.min(0.6, Math.max(0.4, Number(event.ltv) || 0.5));
      return { ...state, borrowDraft: { ...state.borrowDraft, ltv } };
    }

    case 'SET_BORROW_AMOUNT': {
      if (!requireExecuted(state)) return state;
      if (!state.borrowDraft) return state;
      return { ...state, borrowDraft: { ...state.borrowDraft, amountIRR: event.amountIRR } };
    }

    case 'PREVIEW_BORROW': {
      if (!requireExecuted(state)) return state;
      const d = state.borrowDraft;
      if (!d) return state;

      const n = Number(d.amountIRR);
      const guard = minAmountGuard(n);
      if (guard) return addMessage(state, 'system', guard);

      const h = state.portfolio.holdings.find(x => x.asset === d.assetId);
      if (!h) return addMessage(state, 'system', 'Asset not found.');
      if (h.frozen) return addMessage(state, 'system', 'This asset is already frozen as collateral.');

      const maxBorrow = Math.floor(h.amountIRR * d.ltv);
      const req = Math.min(Math.floor(n), maxBorrow);
      if (req <= 0) return addMessage(state, 'system', 'Amount exceeds max borrow for selected LTV.');

      const liquidationIRR = Math.floor(req / d.ltv);
      const before = exposureSnapshot(state.portfolio, state.cashIRR);
      const after = exposureSnapshot(state.portfolio, (state.cashIRR || 0) + req);
      const preview = { before, after, deltas: { totalIRR: after.totalIRR - before.totalIRR, layers: { foundation: after.layers.foundation - before.layers.foundation, growth: after.layers.growth - before.layers.growth, upside: after.layers.upside - before.layers.upside } } };

      let softWarning = null;
      if (h.layer === 'upside' && d.ltv >= 0.6) softWarning = 'Borrowing at high LTV against Upside assets increases liquidation risk.';

      let s = { ...state, preview, softWarning, postAction: POST_ACTIONS.BORROW_PREVIEW };
      s = addMessage(s, 'system', `Max borrow: ${maxBorrow.toLocaleString('en-US')} IRR. Requested: ${req.toLocaleString('en-US')} IRR.`);
      s = addMessage(s, 'system', `Indicative liquidation value: ${liquidationIRR.toLocaleString('en-US')} IRR.`);
      return s;
    }

    case 'CONFIRM_BORROW_FINAL': {
      if (!requireExecuted(state)) return state;
      const d = state.borrowDraft;
      if (!d) return state;

      const n = Number(d.amountIRR);
      const guard = minAmountGuard(n);
      if (guard) return addMessage(state, 'system', guard);

      const holdings = state.portfolio.holdings.map(h => ({ ...h }));
      const h = holdings.find(x => x.asset === d.assetId);
      if (!h) return addMessage(state, 'system', 'Asset not found.');
      if (h.frozen) return addMessage(state, 'system', 'This asset is already frozen as collateral.');

      const maxBorrow = Math.floor(h.amountIRR * d.ltv);
      const req = Math.min(Math.floor(n), maxBorrow);
      if (req <= 0) return addMessage(state, 'system', 'Amount exceeds max borrow for selected LTV.');

      h.frozen = true;
      const liquidationIRR = Math.floor(req / d.ltv);

      const invested = holdings.reduce((s, x) => s + x.amountIRR, 0);
      const nextPortfolio = { ...state.portfolio, holdings, totalIRR: invested };

      let s = { ...state, portfolio: nextPortfolio, cashIRR: (state.cashIRR || 0) + req, loan: { collateralAssetId: d.assetId, amountIRR: req, ltv: d.ltv, liquidationIRR }, postAction: POST_ACTIONS.NONE, borrowDraft: null, preview: null, softWarning: null };
      s = addMessage(s, 'system', 'Loan executed. Cash credited.');
      return s;
    }

    default:
      return state;
  }
}
