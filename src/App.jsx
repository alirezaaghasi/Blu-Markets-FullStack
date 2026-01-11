import React, { useEffect, useMemo, useReducer, useState } from 'react';

// ====== QUESTIONNAIRE DATA ======
const questionnaire = {
  "version": "v7.3",
  "consent_exact": "متوجه ریسک این سبد دارایی شدم و باهاش موافق هستم.",
  "questions": [
    {
      "id": "q_income",
      "text": "درآمد ماهانه‌ات چقدر قابل‌پیش‌بینیه؟",
      "options": [
        { "id": "inc_stable", "text": "کاملاً ثابت", "risk": 0 },
        { "id": "inc_some", "text": "تا حدی ثابت", "risk": 1 },
        { "id": "inc_var", "text": "متغیره (فریلنس/کسب‌وکار)", "risk": 2 }
      ]
    },
    {
      "id": "q_buffer",
      "text": "بدون فروش سرمایه‌گذاری‌هات تا چند ماه می‌تونی خرج غیرمنتظره رو مدیریت کنی؟",
      "options": [
        { "id": "buf_1", "text": "کمتر از ۱ ماه", "risk": 0 },
        { "id": "buf_3", "text": "۱ تا ۳ ماه", "risk": 1 },
        { "id": "buf_6", "text": "بیش از ۶ ماه", "risk": 2 }
      ]
    },
    {
      "id": "q_drawdown",
      "text": "اگر ارزش سبدت ۲۰٪ افت کنه، احتمالاً چیکار می‌کنی؟",
      "options": [
        { "id": "dd_sell", "text": "می‌فروشم", "risk": 0 },
        { "id": "dd_hold_scared", "text": "استرس می‌گیرم ولی صبر می‌کنم", "risk": 1 },
        { "id": "dd_hold_check", "text": "صبر می‌کنم و منطقی بررسی می‌کنم", "risk": 2 }
      ]
    },
    {
      "id": "q_horizon",
      "text": "افق زمانی این پول چقدره؟",
      "options": [
        { "id": "hz_short", "text": "کمتر از ۶ ماه", "risk": 0 },
        { "id": "hz_mid", "text": "۶ ماه تا ۲ سال", "risk": 1 },
        { "id": "hz_long", "text": "بیش از ۳ سال", "risk": 2 }
      ]
    },
    {
      "id": "q_experience",
      "text": "تجربه‌ات از دارایی‌های نوسانی چقدره؟",
      "options": [
        { "id": "ex_none", "text": "تقریباً هیچ", "risk": 0 },
        { "id": "ex_some", "text": "متوسط", "risk": 1 },
        { "id": "ex_high", "text": "زیاد", "risk": 2 }
      ]
    },
    {
      "id": "q_sleep",
      "text": "با کدوم جمله بیشتر موافقی؟",
      "options": [
        { "id": "sl_calm", "text": "آرامش مهم‌تر از سود بالاست", "risk": 0 },
        { "id": "sl_mix", "text": "تعادل بین آرامش و رشد", "risk": 1 },
        { "id": "sl_up", "text": "رشد مهم‌تره حتی با نوسان", "risk": 2 }
      ]
    },
    {
      "id": "q_goal",
      "text": "هدف اصلی‌ات از سرمایه‌گذاری چیه؟",
      "options": [
        { "id": "g_preserve", "text": "حفظ ارزش پول", "risk": 0 },
        { "id": "g_grow", "text": "رشد متعادل", "risk": 1 },
        { "id": "g_moon", "text": "رشد بالاتر با ریسک بیشتر", "risk": 2 }
      ]
    }
  ]
};

// ====== HELPERS ======
function formatIRR(n) {
  const x = Math.round(Number(n) || 0).toString();
  return x.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' IRR';
}

// ====== ENGINE ======
const WEIGHTS = {
  foundation: { IRR_FIXED_INCOME: 0.55, USDT: 0.45 },
  growth: { GOLD: 0.20, BTC: 0.30, ETH: 0.20, QQQ: 0.30 },
  upside: { SOL: 0.55, TON: 0.45 },
};

function buildPortfolio(totalIRR, layers) {
  const holdings = [];
  let allocated = 0;

  for (const layer of ['foundation', 'growth', 'upside']) {
    const pct = (layers[layer] ?? 0) / 100;
    const layerAmount = Math.floor(totalIRR * pct);

    const weights = WEIGHTS[layer] || {};
    const assets = Object.keys(weights);
    let layerAllocated = 0;

    for (const asset of assets) {
      const w = weights[asset] ?? 0;
      const amt = Math.floor(layerAmount * w);
      if (amt <= 0) continue;
      holdings.push({ asset, layer, amountIRR: amt, frozen: false });
      layerAllocated += amt;
    }

    const remainder = layerAmount - layerAllocated;
    if (remainder > 0 && holdings.length) {
      for (let i = holdings.length - 1; i >= 0; i--) {
        if (holdings[i].layer === layer) {
          holdings[i].amountIRR += remainder;
          break;
        }
      }
    }

    allocated += layerAmount;
  }

  const invested = holdings.reduce((s, h) => s + h.amountIRR, 0);
  return { totalIRR: invested, layers, holdings };
}

function calcLayerPercents(holdings, cashIRR) {
  const sums = { foundation: Math.max(0, cashIRR || 0), growth: 0, upside: 0 };
  for (const h of holdings || []) sums[h.layer] = (sums[h.layer] || 0) + (h.amountIRR || 0);

  const total = sums.foundation + sums.growth + sums.upside;
  const pct = {
    foundation: total ? Math.round((sums.foundation / total) * 100) : 0,
    growth: total ? Math.round((sums.growth / total) * 100) : 0,
    upside: total ? Math.round((sums.upside / total) * 100) : 0,
  };
  return { sums, pct, totalIRR: total };
}

function tradeAsset(portfolio, cashIRR, assetId, side, amountIRR) {
  const amt = Math.max(0, Math.floor(Number(amountIRR) || 0));
  if (!portfolio || !portfolio.holdings || !assetId || !side || amt <= 0) {
    return { portfolio, cashIRR };
  }

  const holdings = portfolio.holdings.map(h => ({ ...h }));
  const h = holdings.find(x => x.asset === assetId);
  if (!h) return { portfolio, cashIRR };

  if (h.frozen && side === 'SELL') return { portfolio, cashIRR };

  let cash = Math.max(0, Math.floor(Number(cashIRR) || 0));

  if (side === 'BUY') {
    const spend = Math.min(cash, amt);
    if (spend <= 0) return { portfolio, cashIRR: cash };
    cash -= spend;
    h.amountIRR += spend;
  } else {
    const sell = Math.min(h.amountIRR, amt);
    if (sell <= 0) return { portfolio, cashIRR: cash };
    h.amountIRR -= sell;
    cash += sell;
  }

  const invested = holdings.reduce((s, x) => s + x.amountIRR, 0);
  return { portfolio: { ...portfolio, holdings, totalIRR: invested }, cashIRR: cash };
}

function rebalanceToTarget(totalIRR, targetLayers) {
  const t = Math.max(0, Math.floor(Number(totalIRR) || 0));
  if (!targetLayers) return null;
  return buildPortfolio(t, targetLayers);
}

// ====== STATE MACHINE ======
const STAGES = {
  PHONE_REQUIRED: 'PHONE_REQUIRED',
  QUESTIONNAIRE: 'QUESTIONNAIRE',
  ALLOCATION_PROPOSED: 'ALLOCATION_PROPOSED',
  AMOUNT_REQUIRED: 'AMOUNT_REQUIRED',
  EXECUTED: 'EXECUTED',
};

const POST_ACTIONS = {
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

function initialState() {
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
    targetLayers: null,
    portfolio: null,
    cashIRR: 0,
    tab: 'PORTFOLIO',
    protections: [],
    loan: null,
    postAction: POST_ACTIONS.NONE,
    pendingAmountIRR: null,
    tradeDraft: null,
    protectDraft: null,
    borrowDraft: null,
    preview: null,
    softWarning: null,
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

function reduce(state, event) {
  switch (event.type) {
    case 'RESET':
      return initialState();

    case 'SET_TAB': {
      return { ...state, tab: event.tab };
    }

    case 'SET_PHONE': {
      const phone = String(event.phone || '');
      return { ...state, user: { ...state.user, phone } };
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

    case 'CONFIRM_ADD_FUNDS': {
      if (!requireExecuted(state)) return state;
      const n = Number(state.pendingAmountIRR);
      const guard = minAmountGuard(n);
      if (guard) return addMessage(state, 'system', guard);

      const delta = Math.floor(n);
      let s = { ...state, cashIRR: (state.cashIRR || 0) + delta, postAction: POST_ACTIONS.NONE, pendingAmountIRR: null };
      s = addMessage(s, 'system', 'Top-up executed.');
      s = addMessage(s, 'system', `${delta.toLocaleString('en-US')} IRR added to cash.`);
      return s;
    }

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

    case 'CONFIRM_TRADE': {
      if (!requireExecuted(state)) return state;
      const d = state.tradeDraft;
      if (!d) return state;

      const n = Number(d.amountIRR);
      const guard = minAmountGuard(n);
      if (guard) return addMessage(state, 'system', guard);

      const after = tradeAsset(state.portfolio, state.cashIRR, d.assetId, d.side, Math.floor(n));
      let s = { ...state, portfolio: after.portfolio, cashIRR: after.cashIRR, postAction: POST_ACTIONS.NONE, tradeDraft: null };
      s = addMessage(s, 'system', 'Trade executed.');
      return s;
    }

    case 'CONFIRM_REBALANCE': {
      if (!requireExecuted(state)) return state;
      const total = (state.cashIRR || 0) + (state.portfolio?.totalIRR || 0);
      const nextPortfolio = rebalanceToTarget(total, state.targetLayers);
      let s = { ...state, portfolio: nextPortfolio, cashIRR: 0, postAction: POST_ACTIONS.NONE };
      s = addMessage(s, 'system', 'Rebalance executed.');
      return s;
    }

    case 'START_PROTECT': {
      if (!requireExecuted(state)) return state;

      const preferred = event?.assetId || state.portfolio.holdings[0]?.asset;
      if (!preferred) return addMessage(state, 'system', 'No assets available.');

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

    case 'CONFIRM_PROTECT': {
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

      let s = { ...state, cashIRR: (state.cashIRR || 0) - premium, protections: [...state.protections, { assetId: d.assetId, protectedUntil, premiumIRR: premium }], postAction: POST_ACTIONS.NONE, protectDraft: null };
      s = addMessage(s, 'system', 'Protection activated.');
      return s;
    }

    case 'START_BORROW': {
      if (!requireExecuted(state)) return state;

      if (state.loan) {
        let s = addMessage(state, 'user', 'Borrow');
        s = addMessage(s, 'system', 'You already have an active loan. Repay it before taking a new one.');
        return s;
      }

      // Only allow borrowing against GOLD, BTC, USDT
      const BORROWABLE_ASSETS = ['GOLD', 'BTC', 'USDT'];
      const borrowableHoldings = state.portfolio.holdings.filter(h => BORROWABLE_ASSETS.includes(h.asset) && !h.frozen);

      if (borrowableHoldings.length === 0) {
        let s = addMessage(state, 'user', 'Borrow');
        s = addMessage(s, 'system', 'No eligible collateral. You can only borrow against GOLD, BTC, or USDT.');
        return s;
      }

      const preferred = event?.assetId && BORROWABLE_ASSETS.includes(event.assetId) ? event.assetId : borrowableHoldings[0]?.asset;

      let s = addMessage(state, 'user', 'Borrow');
      s = { ...s, postAction: POST_ACTIONS.BORROW, borrowDraft: { assetId: preferred, amountIRR: null } };
      s = addMessage(s, 'system', 'Select collateral (GOLD, BTC, or USDT) and loan amount. LTV is fixed at 50%.');
      return s;
    }

    case 'SET_BORROW_ASSET': {
      if (!requireExecuted(state)) return state;
      if (!state.borrowDraft) return state;
      const BORROWABLE_ASSETS = ['GOLD', 'BTC', 'USDT'];
      if (!BORROWABLE_ASSETS.includes(event.assetId)) return state;
      return { ...state, borrowDraft: { ...state.borrowDraft, assetId: event.assetId } };
    }

    case 'SET_BORROW_AMOUNT': {
      if (!requireExecuted(state)) return state;
      if (!state.borrowDraft) return state;
      return { ...state, borrowDraft: { ...state.borrowDraft, amountIRR: event.amountIRR } };
    }

    case 'CONFIRM_BORROW': {
      if (!requireExecuted(state)) return state;
      const d = state.borrowDraft;
      if (!d) return state;

      const BORROWABLE_ASSETS = ['GOLD', 'BTC', 'USDT'];
      const LTV = 0.5; // Fixed 50% LTV

      const n = Number(d.amountIRR);
      const guard = minAmountGuard(n);
      if (guard) return addMessage(state, 'system', guard);

      if (!BORROWABLE_ASSETS.includes(d.assetId)) {
        return addMessage(state, 'system', 'You can only borrow against GOLD, BTC, or USDT.');
      }

      const holdings = state.portfolio.holdings.map(h => ({ ...h }));
      const h = holdings.find(x => x.asset === d.assetId);
      if (!h) return addMessage(state, 'system', 'Asset not found.');
      if (h.frozen) return addMessage(state, 'system', 'This asset is already frozen as collateral.');

      const maxBorrow = Math.floor(h.amountIRR * LTV);
      const req = Math.min(Math.floor(n), maxBorrow);
      if (req <= 0) return addMessage(state, 'system', `Amount exceeds max borrow (${formatIRR(maxBorrow)} at 50% LTV).`);

      h.frozen = true;
      const liquidationIRR = Math.floor(req / LTV);

      const invested = holdings.reduce((s, x) => s + x.amountIRR, 0);
      const nextPortfolio = { ...state.portfolio, holdings, totalIRR: invested };

      let s = { ...state, portfolio: nextPortfolio, cashIRR: (state.cashIRR || 0) + req, loan: { collateralAssetId: d.assetId, amountIRR: req, ltv: LTV, liquidationIRR }, postAction: POST_ACTIONS.NONE, borrowDraft: null };
      s = addMessage(s, 'system', `Loan executed. ${formatIRR(req)} credited to cash.`);
      return s;
    }

    default:
      return state;
  }
}

// ====== COMPONENTS ======

function MessagesPane({ messages }) {
  return (
    <div>
      {messages.map((m, i) => (
        <div key={i} className={'msg ' + (m.from === 'user' ? 'user' : '')}>
          <div className="meta">{m.from}</div>
          <div>{m.text}</div>
        </div>
      ))}
    </div>
  );
}

function Tabs({ tab, dispatch }) {
  const tabs = [
    { id: 'PORTFOLIO', label: 'Portfolio' },
    { id: 'PROTECTION', label: 'Protection' },
    { id: 'LOANS', label: 'Loans' },
  ];

  return (
    <div className="tabs">
      {tabs.map(t => (
        <button
          key={t.id}
          className={'tab ' + (tab === t.id ? 'active' : '')}
          onClick={() => dispatch({ type: 'SET_TAB', tab: t.id })}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function LayerMini({ name, pct, target }) {
  return (
    <div className="mini">
      <div className="tag">{name}</div>
      <div className="big" style={{ fontSize: 20 }}>{pct}%</div>
      <div className="muted">Target {target}%</div>
    </div>
  );
}

function PortfolioHome({ portfolio, cashIRR, targetLayers, onStartTrade, onStartProtect, onStartBorrow }) {
  if (!portfolio) {
    return (
      <div className="card">
        <h3>Portfolio Home</h3>
        <div className="muted">Complete onboarding to create your portfolio.</div>
      </div>
    );
  }

  const exposure = calcLayerPercents(portfolio.holdings, cashIRR || 0);
  const total = exposure.totalIRR;

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="muted">Total value</div>
            <div className="big">{formatIRR(total)}</div>
            <div className="muted">Currency: IRR</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="muted">Cash</div>
            <div className="big" style={{ fontSize: 22 }}>{formatIRR(cashIRR || 0)}</div>
            <div className="muted">Available for Buy / Protect</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Allocation (Now vs Target)</h3>
        <div className="grid3">
          <LayerMini name="Foundation" pct={exposure.pct.foundation} target={targetLayers?.foundation ?? '-'} />
          <LayerMini name="Growth" pct={exposure.pct.growth} target={targetLayers?.growth ?? '-'} />
          <LayerMini name="Upside" pct={exposure.pct.upside} target={targetLayers?.upside ?? '-'} />
        </div>
      </div>

      <div className="card">
        <h3>Holdings</h3>
        <div className="list">
          {portfolio.holdings.map((h) => (
            <div key={h.asset} className="item" style={{ alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div className="asset">{h.asset}</div>
                <div className="muted">{h.layer.toUpperCase()}{h.frozen ? ' · Frozen' : ''}</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 150 }}>
                <div className="asset">{formatIRR(h.amountIRR)}</div>
                <div className="row" style={{ justifyContent: 'flex-end', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <button className="btn tiny" onClick={() => onStartTrade(h.asset, 'BUY')}>Buy</button>
                  <button
                    className={'btn tiny ' + (h.frozen ? 'disabled' : '')}
                    disabled={h.frozen}
                    title={h.frozen ? 'Frozen as collateral' : ''}
                    onClick={() => onStartTrade(h.asset, 'SELL')}
                  >
                    Sell
                  </button>
                  <button className="btn tiny" onClick={() => onStartProtect?.(h.asset)}>Protect</button>
                  <button
                    className={'btn tiny ' + (h.frozen ? 'disabled' : '')}
                    disabled={h.frozen}
                    title={h.frozen ? 'Frozen as collateral' : ''}
                    onClick={() => onStartBorrow?.(h.asset)}
                  >
                    Borrow
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          Tip: Buy uses cash. If cash is 0, add funds first.
        </div>
      </div>
    </div>
  );
}

function Protection({ protections }) {
  const list = protections || [];
  return (
    <div className="card">
      <h3>Protection</h3>
      {list.length === 0 ? (
        <div className="muted">No assets protected yet.</div>
      ) : (
        <div className="list">
          {list.map((p, idx) => (
            <div key={p.assetId + '|' + idx} className="item">
              <div style={{ flex: 1 }}>
                <div className="asset">{p.assetId}</div>
                <div className="muted">Protected until {p.protectedUntil}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="asset">{formatIRR(p.premiumIRR)}</div>
                <div className="muted">Premium</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Loans({ loan }) {
  return (
    <div className="card">
      <h3>Loans</h3>
      {!loan ? (
        <div className="muted">No active loans.</div>
      ) : (
        <div className="list">
          <div className="item">
            <div style={{ flex: 1 }}>
              <div className="asset">{formatIRR(loan.amountIRR)}</div>
              <div className="muted">Collateral: {loan.collateralAssetId} · LTV {Math.round(loan.ltv * 100)}%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="asset">{formatIRR(loan.liquidationIRR)}</div>
              <div className="muted">Indicative liquidation</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhoneForm({ state, dispatch }) {
  return (
    <div>
      <div className="muted" style={{ marginBottom: 10 }}>
        Sign in
      </div>
      <div className="row">
        <input
          className="input"
          type="tel"
          placeholder="+989XXXXXXXXX"
          value={state.user.phone}
          onChange={(e) => dispatch({ type: 'SET_PHONE', phone: e.target.value })}
        />
        <button className="btn primary" onClick={() => dispatch({ type: 'SUBMIT_PHONE' })}>Continue</button>
      </div>
    </div>
  );
}

function ActionCard({ title, children }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="muted" style={{ marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function PreviewPanel({ title, preview, softWarning, onConfirm, onBack }) {
  const after = preview?.after || preview;
  const deltas = preview?.deltas;

  return (
    <div className="panel">
      <div className="muted" style={{ marginBottom: 8 }}>{title}</div>

      <div className="previewCard">
        <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 220 }}>
            <div className="muted">After</div>
            <div className="big">
              Foundation {Math.round(after.layers.foundation)}% • Growth {Math.round(after.layers.growth)}% • Upside {Math.round(after.layers.upside)}%
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              Total {formatIRR(after.totalIRR)}
            </div>
          </div>

          {deltas ? (
            <div style={{ minWidth: 220 }}>
              <div className="muted">Change</div>
              <div className="big">
                Upside {deltas.layers.upside >= 0 ? "+" : ""}{Math.round(deltas.layers.upside)}%
              </div>
              <div className="muted" style={{ marginTop: 8 }}>
                Δ Total {formatIRR(deltas.totalIRR)}
              </div>
            </div>
          ) : null}
        </div>

        {softWarning ? (
          <div className="softWarn" style={{ marginTop: 12 }}>
            {softWarning.text || softWarning}
          </div>
        ) : null}
      </div>

      <div className="row" style={{ marginTop: 12, gap: 10 }}>
        <button className="btn primary" onClick={onConfirm}>
          {softWarning ? "Confirm anyway" : "Confirm"}
        </button>
        <button className="btn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

function OnboardingControls({ state, dispatch, onReset }) {
  const stage = state.user.stage;
  const [consentText, setConsentText] = useState('');

  if (stage === STAGES.PHONE_REQUIRED) return <PhoneForm state={state} dispatch={dispatch} />;

  if (stage === STAGES.QUESTIONNAIRE) {
    const idx = state.questionnaire.index;
    const q = questionnaire.questions[idx];
    if (!q) return null;

    return (
      <div>
        <div className="muted" style={{ marginBottom: 10 }}>
          Questionnaire ({idx + 1}/{questionnaire.questions.length})
        </div>

        <div className="q-card">
          <div className="q-title">{q.text}</div>
          <div className="q-options">
            {q.options.map((opt) => (
              <button
                key={opt.id}
                className="opt"
                onClick={() => dispatch({ type: 'ANSWER_QUESTION', qId: q.id, optionId: opt.id })}
              >
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stage === STAGES.ALLOCATION_PROPOSED) {
    return (
      <div>
        <div className="muted" style={{ marginBottom: 10 }}>
          Target allocation proposed
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div className="muted" style={{ marginBottom: 6 }}>Paste this exact sentence to confirm:</div>
          <div className="code">{questionnaire.consent_exact}</div>

          <div style={{ marginTop: 10 }}>
            <input
              className="input"
              type="text"
              placeholder="Paste the exact sentence"
              value={consentText}
              onChange={(e) => setConsentText(e.target.value)}
            />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'SUBMIT_CONSENT', text: consentText })}>
                Confirm
              </button>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              (Prototype constraint) Consent must match exactly.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === STAGES.AMOUNT_REQUIRED) {
    return (
      <div>
        <div className="muted" style={{ marginBottom: 10 }}>
          Investment amount (IRR)
        </div>
        <div className="row">
          <input
            className="input"
            type="number"
            placeholder="Amount in IRR"
            value={state.user.investAmountIRR ?? ''}
            onChange={(e) => dispatch({ type: 'SET_INVEST_AMOUNT', investAmountIRR: e.target.value })}
          />
          <button className="btn primary" onClick={() => dispatch({ type: 'EXECUTE_PORTFOLIO' })}>
            Execute
          </button>
        </div>
      </div>
    );
  }

  if (stage === STAGES.EXECUTED) {
    return (
      <div>
        {state.postAction === POST_ACTIONS.NONE && (
          <div className="chips">
            <button className="chip primary" onClick={() => dispatch({ type: 'START_ADD_FUNDS' })}>Add funds</button>
            <button className="chip" onClick={() => dispatch({ type: 'CONFIRM_REBALANCE' })}>Rebalance</button>
            <button className="chip" onClick={() => dispatch({ type: 'START_PROTECT' })}>Protect</button>
            <button className="chip" onClick={() => dispatch({ type: 'START_BORROW' })}>Borrow</button>
            <button className="chip ghost" onClick={onReset}>Reset state</button>
          </div>
        )}

        {state.postAction === POST_ACTIONS.ADD_FUNDS && (
          <ActionCard title="Add funds (to cash)">
            <div className="muted" style={{ marginBottom: 8 }}>Top-up amount (IRR)</div>
            <input
              className="input"
              type="number"
              placeholder="Amount in IRR"
              value={state.pendingAmountIRR ?? ''}
              onChange={(e) => dispatch({ type: 'SET_PENDING_AMOUNT', amountIRR: e.target.value })}
            />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'CONFIRM_ADD_FUNDS' })} disabled={!state.pendingAmountIRR}>Confirm</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}

        {state.postAction === POST_ACTIONS.TRADE && (
          <ActionCard title={`Trade: ${state.tradeDraft?.assetId || ''}`}>
            <div className="row" style={{ gap: 8 }}>
              <select
                className="input"
                value={state.tradeDraft?.side || 'BUY'}
                onChange={(e) => dispatch({ type: 'SET_TRADE_SIDE', side: e.target.value })}
              >
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </select>
              <input
                className="input"
                type="number"
                placeholder="Amount in IRR"
                value={state.tradeDraft?.amountIRR ?? ''}
                onChange={(e) => dispatch({ type: 'SET_TRADE_AMOUNT', amountIRR: e.target.value })}
              />
            </div>

            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'CONFIRM_TRADE' })} disabled={!state.tradeDraft?.amountIRR}>Confirm</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}


        {state.postAction === POST_ACTIONS.PROTECT && (
          <ActionCard title="Protect (Insurance)">
            <div className="row" style={{ gap: 8 }}>
              <select
                className="input"
                value={state.protectDraft?.assetId || ''}
                onChange={(e) => dispatch({ type: 'SET_PROTECT_ASSET', assetId: e.target.value })}
              >
                {(state.portfolio?.holdings || []).map((h) => (
                  <option key={h.asset} value={h.asset}>{h.asset}</option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                min="1"
                max="6"
                value={state.protectDraft?.months ?? 3}
                onChange={(e) => dispatch({ type: 'SET_PROTECT_MONTHS', months: e.target.value })}
              />
            </div>
            <div className="muted" style={{ marginTop: 6 }}>Months (1-6). Premium will be paid from cash.</div>
            {state.protectError ? (
              <div className="softWarn" style={{ marginTop: 10 }}>
                Need at least {formatIRR(state.protectError.neededIRR)} cash to pay the premium.
              </div>
            ) : null}

            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'CONFIRM_PROTECT' })}>Confirm</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}

        {state.postAction === POST_ACTIONS.BORROW && (
          <ActionCard title="Borrow (50% LTV)">
            <div className="muted" style={{ marginBottom: 8 }}>Collateral: GOLD, BTC, or USDT only</div>
            <select
              className="input"
              value={state.borrowDraft?.assetId || ''}
              onChange={(e) => dispatch({ type: 'SET_BORROW_ASSET', assetId: e.target.value })}
            >
              {(state.portfolio?.holdings || []).filter(h => ['GOLD', 'BTC', 'USDT'].includes(h.asset)).map((h) => (
                <option key={h.asset} value={h.asset}>{h.asset}</option>
              ))}
            </select>

            <input
              className="input"
              style={{ marginTop: 8 }}
              type="number"
              placeholder="Loan amount (IRR)"
              value={state.borrowDraft?.amountIRR ?? ''}
              onChange={(e) => dispatch({ type: 'SET_BORROW_AMOUNT', amountIRR: e.target.value })}
            />

            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'CONFIRM_BORROW' })} disabled={!state.borrowDraft?.amountIRR}>Confirm</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}
      </div>
    );
  }

  return null;
}

// ====== MAIN APP ======
export default function App() {
  const [state, dispatch] = useReducer(reduce, null, initialState);

  const stepLabel = useMemo(() => {
    const stage = state.user.stage;
    const map = {
      [STAGES.PHONE_REQUIRED]: { idx: 1, name: 'Phone' },
      [STAGES.QUESTIONNAIRE]: { idx: 2, name: 'Questionnaire' },
      [STAGES.ALLOCATION_PROPOSED]: { idx: 3, name: 'Allocation' },
      [STAGES.AMOUNT_REQUIRED]: { idx: 4, name: 'Amount' },
      [STAGES.EXECUTED]: { idx: 5, name: 'Done' },
    };
    const x = map[stage] || { idx: 0, name: stage };
    return `Step ${x.idx} of 5 — ${x.name}`;
  }, [state.user.stage]);

  const onStartTrade = (assetId, side) => dispatch({ type: 'START_TRADE', assetId, side });
  const onStartProtect = (assetId) => dispatch({ type: 'START_PROTECT', assetId });
  const onStartBorrow = (assetId) => dispatch({ type: 'START_BORROW', assetId });

  const right = useMemo(() => {
    if (state.tab === 'PROTECTION') return <Protection protections={state.protections} />
    if (state.tab === 'LOANS') return <Loans loan={state.loan} />
    return (
      <PortfolioHome
        portfolio={state.portfolio}
        cashIRR={state.cashIRR}
        targetLayers={state.targetLayers}
        onStartTrade={onStartTrade}
        onStartProtect={onStartProtect}
        onStartBorrow={onStartBorrow}
      />
    );
  }, [state.tab, state.portfolio, state.cashIRR, state.targetLayers, state.protections, state.loan]);

  const reset = () => {
    dispatch({ type: 'RESET' });
  };

  return (
    <>
      <style>{`
        :root{
          --bg:#0b1220;
          --panel:#0f1a2e;
          --card:#101f3a;
          --border:rgba(255,255,255,.08);
          --text:#e8eefc;
          --muted:rgba(232,238,252,.72);
          --accent:#4f7cff;
          --accent2:rgba(79,124,255,.18);
        }
        *{box-sizing:border-box}
        html,body{height:100%;margin:0}
        body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;background:var(--bg);color:var(--text)}
        .container{height:100vh;display:grid;grid-template-columns:420px 1fr;gap:12px;padding:12px}
        .panel{background:var(--panel);border:1px solid var(--border);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;min-height:0}
        .header{padding:14px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px}
        .logo{width:28px;height:28px;border-radius:8px;background:var(--accent2);display:grid;place-items:center;font-weight:900}
        .h-title{font-weight:900;letter-spacing:-.01em}
        .h-sub{font-size:12px;color:var(--muted);margin-top:2px}
        .rightMeta{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
        .pill{display:inline-flex;gap:8px;align-items:center;padding:8px 10px;border:1px solid var(--border);border-radius:999px;background:rgba(255,255,255,.03);font-weight:900;font-size:12px}
        .body{padding:14px;overflow:auto;flex:1;min-height:0}
        .footer{padding:12px;border-top:1px solid var(--border);background:rgba(255,255,255,.02)}
        .msg{padding:12px;border-radius:14px;border:1px solid var(--border);background:rgba(255,255,255,.03);margin-bottom:10px;white-space:pre-line}
        .msg.user{background:rgba(79,124,255,.12);border-color:rgba(79,124,255,.25)}
        .msg .meta{font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em}
        .row{display:flex;gap:8px;flex-wrap:wrap}
        .btn{appearance:none;border:1px solid var(--border);background:rgba(255,255,255,.03);color:var(--text);padding:10px 12px;border-radius:12px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
        .btn.primary{background:var(--accent2);border-color:rgba(79,124,255,.35)}
        .btn.full{width:100%;justify-content:center}
        .btn:disabled{opacity:.45;cursor:not-allowed}
        .input{width:100%;padding:11px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.03);color:var(--text);font-weight:900;outline:none}
        .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px;margin-bottom:12px}
        .card h3{margin:0 0 10px 0}
        .kpi{display:flex;justify-content:space-between;gap:10px;align-items:flex-end}
        .big{font-size:30px;font-weight:1000;letter-spacing:-.03em}
        .muted{color:var(--muted);font-size:12px;line-height:1.35}
        .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .mini{border:1px solid var(--border);border-radius:14px;padding:10px;background:rgba(255,255,255,.02)}
        .tag{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
        .list{display:flex;flex-direction:column;gap:10px}
        .item{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.02)}
        .asset{font-weight:1000}
        .tabs{display:flex;gap:8px;flex-wrap:wrap}
        .tab{padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.02);font-weight:1000;cursor:pointer;color:var(--text)}
        .tab.active{background:var(--accent2);border-color:rgba(79,124,255,.35)}
        .chips{display:flex;gap:8px;flex-wrap:wrap}
        .chip{padding:8px 10px;border-radius:999px;border:1px solid var(--border);background:rgba(255,255,255,.03);font-weight:900;font-size:12px;cursor:pointer;color:var(--text)}
        .chip.primary{background:var(--accent2);border-color:rgba(79,124,255,.35)}
        @media(max-width:980px){.container{grid-template-columns:1fr;}.panel{min-height:48vh}}
        .panelTitle{font-weight:900;letter-spacing:-.01em}
        .warnText{margin-top:8px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,220,150,.25);background:rgba(255,200,80,.08);color:rgba(255,240,210,.95);font-weight:700}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .btn.tiny{padding:6px 10px;font-size:12px;border-radius:10px}
        .btn.tiny.disabled{opacity:.5;cursor:not-allowed}
        .q-card{border:1px solid var(--border);border-radius:16px;padding:12px;background:rgba(255,255,255,.02)}
        .q-title{font-weight:900;margin-bottom:10px;line-height:1.4}
        .q-options{display:flex;flex-direction:column;gap:8px}
        .opt{appearance:none;border:1px solid var(--border);background:rgba(255,255,255,.03);color:var(--text);padding:10px 12px;border-radius:12px;font-weight:900;cursor:pointer;text-align:left}
        .opt:hover{border-color:rgba(79,124,255,.35)}
        .code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:12px;line-height:1.5;border:1px solid var(--border);background:rgba(0,0,0,.2);padding:10px 12px;border-radius:12px;white-space:pre-wrap}
        .warn{margin-top:8px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,200,80,.2);background:rgba(255,200,80,.08);color:rgba(255,240,210,.95);font-weight:700}
        .preview{margin-top:10px;border:1px solid var(--border);border-radius:14px;padding:10px;background:rgba(255,255,255,.02)}
        .previewRow{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:4px 0}
        .previewCard{border:1px solid var(--border);border-radius:14px;padding:12px;background:rgba(255,255,255,.02)}
        .softWarn{margin-top:8px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,200,80,.2);background:rgba(255,200,80,.08);color:rgba(255,240,210,.95);font-weight:700}
        .stack{display:flex;flex-direction:column;gap:0}
      `}</style>
      <div className="container">
        <div className="panel">
          <div className="header">
            <div className="logo">B</div>
            <div style={{ flex: 1 }}>
              <div className="h-title">Blu Markets</div>
              <div className="h-sub">{stepLabel}</div>
            </div>
            <div className="rightMeta">
              <div className="pill">{state.user.phone || 'Not signed in'}</div>
              <div className="pill">{state.user.stage}</div>
            </div>
          </div>

          <div className="body">
            <MessagesPane messages={state.messages} />
          </div>

          <div className="footer">
            <OnboardingControls state={state} dispatch={dispatch} onReset={reset} />
          </div>
        </div>

        <div className="panel">
          <div className="header">
            <div style={{ flex: 1 }}>
              <div className="h-title">Portfolio Home</div>
              <div className="h-sub">Calm ownership. No market noise.</div>
            </div>
          </div>

          <div className="body">
            <Tabs tab={state.tab} dispatch={dispatch} />
            <div style={{ marginTop: 12 }}>
              {right}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
