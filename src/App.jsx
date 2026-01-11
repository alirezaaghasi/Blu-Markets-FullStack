import React, { useEffect, useMemo, useReducer, useState, useRef } from 'react';

// ====== BLU MARKETS v9.1 ======
// Fixes from v9:
// 1. Allocation display: cash separate from Foundation % (assets-only calculation)
// 2. Hide boundary transition when before === after
// 3. Add Protect/Borrow buttons to footer
// 4. New action log format (minimal event markers)
// 5. Boundary calculation based on assets only
// 6. Remove premium rates table, show rate contextually when protecting

const questionnaire = {
  "version": "v9.1",
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
  foundation: { name: 'Foundation', nameFa: 'پایه', icon: '🛡️', assets: ['USDT', 'Fixed Income'], description: 'Stable assets. Your safety net.', descriptionFa: 'دارایی‌های پایدار. پشتوانه‌ی امنت.' },
  growth: { name: 'Growth', nameFa: 'رشد', icon: '📈', assets: ['Gold', 'BTC', 'ETH', 'QQQ'], description: 'Balanced assets for steady growth.', descriptionFa: 'دارایی‌های متعادل برای رشد تدریجی.' },
  upside: { name: 'Upside', nameFa: 'رشد بالا', icon: '🚀', assets: ['SOL', 'TON'], description: 'Higher potential, more ups and downs.', descriptionFa: 'پتانسیل بالاتر، بالا و پایین بیشتر.' },
};

const PORTFOLIO_HEALTH_LABELS = { SAFE: 'Balanced', DRIFT: 'Slightly Off', STRUCTURAL: 'Rebalance Needed', STRESS: 'Attention Required' };
const PORTFOLIO_HEALTH_LABELS_FA = { SAFE: 'متعادل', DRIFT: 'کمی نامتعادل', STRUCTURAL: 'نیاز به تعادل', STRESS: 'نیاز به توجه' };

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

const WEIGHTS = {
  foundation: { IRR_FIXED_INCOME: 0.55, USDT: 0.45 },
  growth: { GOLD: 0.20, BTC: 0.30, ETH: 0.20, QQQ: 0.30 },
  upside: { SOL: 0.55, TON: 0.45 },
};
const PREMIUM_RATES = { foundation: 0.01, growth: 0.02, upside: 0.03 };
const LTV_LIMITS = { foundation: { max: 0.7, recommended: 0.5 }, growth: { max: 0.6, recommended: 0.5 }, upside: { max: 0.5, recommended: 0.4 } };
const THRESHOLDS = { FOUNDATION_MIN_PCT: 40, UPSIDE_MAX_PCT: 25, MIN_AMOUNT_IRR: 1_000_000, DRIFT_SUGGEST_REBALANCE: 5, DRIFT_WARN: 10 };

function buildPortfolio(totalIRR, layers) {
  const holdings = [];
  for (const layer of ['foundation', 'growth', 'upside']) {
    const pct = (layers[layer] ?? 0) / 100;
    const layerAmount = Math.floor(totalIRR * pct);
    const weights = WEIGHTS[layer] || {};
    let layerAllocated = 0;
    for (const asset of Object.keys(weights)) {
      const amt = Math.floor(layerAmount * weights[asset]);
      if (amt <= 0) continue;
      holdings.push({ asset, layer, amountIRR: amt, frozen: false });
      layerAllocated += amt;
    }
    const remainder = layerAmount - layerAllocated;
    if (remainder > 0) {
      const last = [...holdings].reverse().find(h => h.layer === layer);
      if (last) last.amountIRR += remainder;
    }
  }
  return { totalIRR: holdings.reduce((s, h) => s + h.amountIRR, 0), layers, holdings };
}

// v9.1 FIX: Calculate from ASSETS ONLY (not cash)
function calcLayerPercents(holdings) {
  const sums = { foundation: 0, growth: 0, upside: 0 };
  for (const h of holdings || []) sums[h.layer] = (sums[h.layer] || 0) + (h.amountIRR || 0);
  const total = sums.foundation + sums.growth + sums.upside;
  return {
    sums,
    pct: {
      foundation: total ? (sums.foundation / total) * 100 : 0,
      growth: total ? (sums.growth / total) * 100 : 0,
      upside: total ? (sums.upside / total) * 100 : 0,
    },
    totalIRR: total,
  };
}

function tradeAsset(portfolio, cashIRR, assetId, side, amountIRR) {
  const amt = Math.max(0, Math.floor(Number(amountIRR) || 0));
  if (!portfolio?.holdings || !assetId || !side || amt <= 0) return { portfolio, cashIRR };
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
  return { portfolio: { ...portfolio, holdings, totalIRR: holdings.reduce((s, x) => s + x.amountIRR, 0) }, cashIRR: cash };
}

function rebalanceToTarget(portfolio, cashIRR, targetLayers) {
  if (!portfolio || !targetLayers) return { portfolio, cashIRR };
  const holdings = portfolio.holdings.map(h => ({ ...h }));
  const frozen = holdings.filter(h => h.frozen);
  const unfrozen = holdings.filter(h => !h.frozen);
  const frozenByLayer = { foundation: 0, growth: 0, upside: 0 };
  for (const h of frozen) frozenByLayer[h.layer] += h.amountIRR;
  const unfrozenValue = unfrozen.reduce((s, h) => s + h.amountIRR, 0);
  const totalAssetValue = unfrozenValue + frozen.reduce((s, h) => s + h.amountIRR, 0);
  if (unfrozenValue <= 0) return { portfolio, cashIRR };
  const targetAmounts = {
    foundation: Math.floor(totalAssetValue * targetLayers.foundation / 100),
    growth: Math.floor(totalAssetValue * targetLayers.growth / 100),
    upside: Math.floor(totalAssetValue * targetLayers.upside / 100),
  };
  const unfrozenTargets = {
    foundation: Math.max(0, targetAmounts.foundation - frozenByLayer.foundation),
    growth: Math.max(0, targetAmounts.growth - frozenByLayer.growth),
    upside: Math.max(0, targetAmounts.upside - frozenByLayer.upside),
  };
  const unfrozenTargetTotal = unfrozenTargets.foundation + unfrozenTargets.growth + unfrozenTargets.upside;
  const scale = unfrozenTargetTotal > 0 ? unfrozenValue / unfrozenTargetTotal : 0;
  const adjustedTargets = {
    foundation: Math.floor(unfrozenTargets.foundation * scale),
    growth: Math.floor(unfrozenTargets.growth * scale),
    upside: Math.floor(unfrozenTargets.upside * scale),
  };
  const newUnfrozen = [];
  for (const layer of ['foundation', 'growth', 'upside']) {
    const layerAmount = adjustedTargets[layer];
    if (layerAmount <= 0) continue;
    const weights = WEIGHTS[layer] || {};
    let layerAllocated = 0;
    for (const asset of Object.keys(weights)) {
      if (frozen.some(h => h.asset === asset)) continue;
      const amt = Math.floor(layerAmount * weights[asset]);
      if (amt <= 0) continue;
      newUnfrozen.push({ asset, layer, amountIRR: amt, frozen: false });
      layerAllocated += amt;
    }
    const remainder = layerAmount - layerAllocated;
    if (remainder > 0) {
      const last = [...newUnfrozen].reverse().find(h => h.layer === layer);
      if (last) last.amountIRR += remainder;
    }
  }
  const finalHoldings = [...frozen, ...newUnfrozen];
  return { portfolio: { ...portfolio, holdings: finalHoldings, totalIRR: finalHoldings.reduce((s, h) => s + h.amountIRR, 0) }, cashIRR };
}

const BOUNDARY_STATES = { SAFE: 'SAFE', DRIFT: 'DRIFT', STRUCTURAL: 'STRUCTURAL', STRESS: 'STRESS' };
const DRIFT_THRESHOLDS = { SAFE: 5, DRIFT: 10, STRUCTURAL: 20 };

function computeDrift(currentLayers, targetLayers) {
  if (!currentLayers || !targetLayers) return { foundation: 0, growth: 0, upside: 0, total: 0, max: 0 };
  const f = currentLayers.foundation - targetLayers.foundation;
  const g = currentLayers.growth - targetLayers.growth;
  const u = currentLayers.upside - targetLayers.upside;
  return { foundation: f, growth: g, upside: u, total: Math.abs(f) + Math.abs(g) + Math.abs(u), max: Math.max(Math.abs(f), Math.abs(g), Math.abs(u)) };
}

function computeBoundary(state) {
  if (!state.portfolio || !state.targetLayers) return { state: BOUNDARY_STATES.SAFE, drift: null, warnings: [], constraints: [] };
  const exposure = calcLayerPercents(state.portfolio.holdings);
  const drift = computeDrift(exposure.pct, state.targetLayers);
  const constraints = [];
  if (exposure.pct.foundation < THRESHOLDS.FOUNDATION_MIN_PCT) constraints.push(`Foundation below ${THRESHOLDS.FOUNDATION_MIN_PCT}%`);
  if (exposure.pct.upside > THRESHOLDS.UPSIDE_MAX_PCT) constraints.push(`Upside above ${THRESHOLDS.UPSIDE_MAX_PCT}%`);
  const frozen = (state.portfolio.holdings || []).filter(h => h.frozen);
  if (frozen.length > 0 && state.loan) {
    const collateralValue = frozen.reduce((s, h) => s + h.amountIRR, 0);
    if (collateralValue < state.loan.liquidationIRR * 1.1) constraints.push('Collateral near liquidation');
  }
  let boundaryState;
  if (constraints.length > 0) boundaryState = BOUNDARY_STATES.STRESS;
  else if (drift.total > DRIFT_THRESHOLDS.STRUCTURAL) boundaryState = BOUNDARY_STATES.STRESS;
  else if (drift.total > DRIFT_THRESHOLDS.DRIFT) boundaryState = BOUNDARY_STATES.STRUCTURAL;
  else if (drift.total > DRIFT_THRESHOLDS.SAFE) boundaryState = BOUNDARY_STATES.DRIFT;
  else boundaryState = BOUNDARY_STATES.SAFE;
  return { state: boundaryState, drift, exposure: exposure.pct, warnings: [], constraints };
}

function calcFundingOptions(state, shortfallIRR) {
  const options = { shortfall: shortfallIRR, addFunds: { amount: shortfallIRR }, sellOptions: [] };
  if (!state.portfolio) return options;
  const foundationHoldings = state.portfolio.holdings.filter(h => h.layer === 'foundation' && !h.frozen && h.amountIRR > 0).sort((a, b) => b.amountIRR - a.amountIRR);
  for (const h of foundationHoldings) {
    const sellAmount = Math.min(h.amountIRR, shortfallIRR);
    const afterTrade = tradeAsset(state.portfolio, state.cashIRR, h.asset, 'SELL', sellAmount);
    const afterBoundary = computeBoundary({ ...state, portfolio: afterTrade.portfolio, cashIRR: afterTrade.cashIRR });
    options.sellOptions.push({ asset: h.asset, layer: h.layer, available: h.amountIRR, sellAmount, coversShortfall: sellAmount >= shortfallIRR, resultingBoundary: afterBoundary.state });
  }
  return options;
}

const STAGES = { PHONE_REQUIRED: 'PHONE_REQUIRED', QUESTIONNAIRE: 'QUESTIONNAIRE', ALLOCATION_PROPOSED: 'ALLOCATION_PROPOSED', AMOUNT_REQUIRED: 'AMOUNT_REQUIRED', EXECUTED: 'EXECUTED' };
const POST_ACTIONS = { NONE: 'NONE', ADD_FUNDS: 'ADD_FUNDS', TRADE: 'TRADE', TRADE_PREVIEW: 'TRADE_PREVIEW', REBALANCE: 'REBALANCE', REBALANCE_PREVIEW: 'REBALANCE_PREVIEW', PROTECT: 'PROTECT', PROTECT_PREVIEW: 'PROTECT_PREVIEW', PROTECT_FUNDING: 'PROTECT_FUNDING', BORROW: 'BORROW', BORROW_PREVIEW: 'BORROW_PREVIEW', REPAY_LOAN: 'REPAY_LOAN', REPAY_LOAN_PREVIEW: 'REPAY_LOAN_PREVIEW' };
const CONSENT_EXACT = questionnaire.consent_exact;

function validateAction(state, actionType, params = {}) {
  const result = { allowed: true, boundary: computeBoundary(state), warnings: [], errors: [], requiresAcknowledgment: false, acknowledgmentMessage: null, projectedBoundary: null, fundingOptions: null };
  if (state.user.stage !== STAGES.EXECUTED) return result;
  let projectedState = { ...state };
  switch (actionType) {
    case 'ADD_FUNDS': {
      const amount = Number(params.amountIRR) || 0;
      if (amount < THRESHOLDS.MIN_AMOUNT_IRR) { result.errors.push(`Minimum: ${formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}`); result.allowed = false; }
      projectedState = { ...state, cashIRR: (state.cashIRR || 0) + amount };
      break;
    }
    case 'TRADE': {
      const { assetId, side, amountIRR } = params;
      const amount = Number(amountIRR) || 0;
      if (amount < THRESHOLDS.MIN_AMOUNT_IRR) { result.errors.push(`Minimum: ${formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}`); result.allowed = false; }
      const holding = state.portfolio?.holdings?.find(h => h.asset === assetId);
      if (side === 'BUY' && amount > (state.cashIRR || 0)) { result.errors.push('Insufficient cash'); result.allowed = false; }
      if (side === 'SELL') {
        if (holding?.frozen) { result.errors.push('Asset is frozen as collateral'); result.allowed = false; }
        if (holding && amount > holding.amountIRR) result.warnings.push('Will sell maximum available');
      }
      if (result.allowed) {
        const after = tradeAsset(state.portfolio, state.cashIRR, assetId, side, amount);
        projectedState = { ...state, portfolio: after.portfolio, cashIRR: after.cashIRR };
        const projectedExposure = calcLayerPercents(after.portfolio.holdings);
        if (projectedExposure.pct.foundation < THRESHOLDS.FOUNDATION_MIN_PCT) {
          result.requiresAcknowledgment = true;
          result.acknowledgmentMessage = `Foundation will be ${projectedExposure.pct.foundation.toFixed(1)}% (below ${THRESHOLDS.FOUNDATION_MIN_PCT}% guideline)`;
          result.warnings.push(result.acknowledgmentMessage);
        }
        if (projectedExposure.pct.upside > THRESHOLDS.UPSIDE_MAX_PCT && side === 'BUY' && holding?.layer === 'upside') {
          result.requiresAcknowledgment = true;
          result.acknowledgmentMessage = `Upside will be ${projectedExposure.pct.upside.toFixed(1)}% (above ${THRESHOLDS.UPSIDE_MAX_PCT}% guideline)`;
          result.warnings.push(result.acknowledgmentMessage);
        }
      }
      break;
    }
    case 'REBALANCE': {
      const { portfolio: afterPortfolio, cashIRR: afterCash } = rebalanceToTarget(state.portfolio, state.cashIRR, state.targetLayers);
      const frozen = state.portfolio?.holdings?.filter(h => h.frozen) || [];
      if (frozen.length > 0) result.warnings.push('Frozen collateral unchanged');
      result.warnings.push('Cash wallet unchanged');
      projectedState = { ...state, portfolio: afterPortfolio, cashIRR: afterCash };
      break;
    }
    case 'PROTECT': {
      const { assetId, months } = params;
      const holding = state.portfolio?.holdings?.find(h => h.asset === assetId);
      if (!holding) { result.errors.push('Asset not found'); result.allowed = false; break; }
      const rate = PREMIUM_RATES[holding.layer] || 0.02;
      const premium = Math.floor(holding.amountIRR * rate * (months / 3));
      const existing = (state.protections || []).find(p => p.assetId === assetId);
      if (existing) { result.errors.push(`Already protected until ${existing.protectedUntil}`); result.allowed = false; break; }
      if (premium > (state.cashIRR || 0)) {
        const shortfall = premium - (state.cashIRR || 0);
        result.errors.push(`Need ${formatIRR(shortfall)} more cash`);
        result.allowed = false;
        result.fundingOptions = calcFundingOptions(state, shortfall);
        result.fundingOptions.premium = premium;
      }
      if (result.allowed) projectedState = { ...state, cashIRR: (state.cashIRR || 0) - premium };
      break;
    }
    case 'BORROW': {
      const { assetId, ltv, amountIRR } = params;
      const amount = Number(amountIRR) || 0;
      const holding = state.portfolio?.holdings?.find(h => h.asset === assetId);
      if (!holding) { result.errors.push('Asset not found'); result.allowed = false; break; }
      if (holding.frozen) { result.errors.push('Asset already used as collateral'); result.allowed = false; break; }
      if (state.loan) { result.errors.push('Active loan exists'); result.allowed = false; break; }
      const limits = LTV_LIMITS[holding.layer] || LTV_LIMITS.growth;
      if (ltv > limits.max) { result.errors.push(`Max LTV: ${Math.round(limits.max * 100)}%`); result.allowed = false; }
      if (ltv > limits.recommended) {
        result.requiresAcknowledgment = true;
        result.acknowledgmentMessage = `LTV ${Math.round(ltv * 100)}% exceeds recommended ${Math.round(limits.recommended * 100)}%`;
        result.warnings.push(result.acknowledgmentMessage);
      }
      const maxBorrow = Math.floor(holding.amountIRR * ltv);
      if (amount > maxBorrow) { result.errors.push(`Max borrow: ${formatIRR(maxBorrow)}`); result.allowed = false; }
      if (amount < THRESHOLDS.MIN_AMOUNT_IRR) { result.errors.push(`Minimum: ${formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}`); result.allowed = false; }
      if (result.allowed) {
        const afterCash = (state.cashIRR || 0) + amount;
        const holdings = state.portfolio.holdings.map(h => ({ ...h }));
        const collateral = holdings.find(x => x.asset === assetId);
        if (collateral) collateral.frozen = true;
        const simulatedExposure = calcLayerPercents(holdings);
        if (simulatedExposure.pct.foundation < THRESHOLDS.FOUNDATION_MIN_PCT) {
          result.requiresAcknowledgment = true;
          result.acknowledgmentMessage = `Foundation will be ${simulatedExposure.pct.foundation.toFixed(1)}%`;
          result.warnings.push(result.acknowledgmentMessage);
        }
        if (holding.layer === 'upside' && ltv >= 0.5) result.warnings.push('High liquidation risk on Upside collateral');
        projectedState = { ...state, cashIRR: afterCash };
      }
      break;
    }
    case 'REPAY_LOAN': {
      if (!state.loan) { result.errors.push('No active loan'); result.allowed = false; break; }
      if ((state.cashIRR || 0) < state.loan.amountIRR) { result.errors.push(`Need ${formatIRR(state.loan.amountIRR - (state.cashIRR || 0))} more`); result.allowed = false; }
      if (result.allowed) projectedState = { ...state, cashIRR: (state.cashIRR || 0) - state.loan.amountIRR };
      break;
    }
  }
  if (result.allowed) {
    result.projectedBoundary = computeBoundary(projectedState);
    if (result.projectedBoundary.state === BOUNDARY_STATES.STRESS && result.boundary.state !== BOUNDARY_STATES.STRESS) {
      result.requiresAcknowledgment = true;
      result.acknowledgmentMessage = `Portfolio Health → ${PORTFOLIO_HEALTH_LABELS[result.projectedBoundary.state]}`;
      result.warnings.push(result.acknowledgmentMessage);
    } else if (result.projectedBoundary.state === BOUNDARY_STATES.STRUCTURAL && result.boundary.state !== BOUNDARY_STATES.STRUCTURAL && result.boundary.state !== BOUNDARY_STATES.STRESS) {
      result.requiresAcknowledgment = true;
      result.acknowledgmentMessage = `Portfolio Health → ${PORTFOLIO_HEALTH_LABELS[result.projectedBoundary.state]}`;
      result.warnings.push(result.acknowledgmentMessage);
    }
  }
  return result;
}

function createLedgerEntry(actionType, params, stateBefore, stateAfter) {
  const boundaryBefore = computeBoundary(stateBefore);
  const boundaryAfter = computeBoundary(stateAfter);
  const exposureBefore = stateBefore.portfolio ? calcLayerPercents(stateBefore.portfolio.holdings) : null;
  const exposureAfter = stateAfter.portfolio ? calcLayerPercents(stateAfter.portfolio.holdings) : null;
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    actionType,
    params,
    boundary: { before: boundaryBefore.state, after: boundaryAfter.state },
    snapshot: {
      before: exposureBefore ? { totalIRR: exposureBefore.totalIRR, cashIRR: stateBefore.cashIRR || 0, layers: exposureBefore.pct } : null,
      after: exposureAfter ? { totalIRR: exposureAfter.totalIRR, cashIRR: stateAfter.cashIRR || 0, layers: exposureAfter.pct } : null,
    },
  };
}

function initialState() {
  return {
    protectError: null, user: { stage: STAGES.PHONE_REQUIRED, phone: '', investAmountIRR: null },
    questionnaire: { index: 0, answers: {} }, targetLayers: null, portfolio: null, cashIRR: 0,
    tab: 'PORTFOLIO', protections: [], loan: null, postAction: POST_ACTIONS.NONE,
    pendingAmountIRR: null, tradeDraft: null, protectDraft: null, borrowDraft: null,
    preview: null, validation: null, fundingOptions: null, lastAction: null,
    acknowledged: false, showResetConfirm: false, actionLog: [], ledger: [],
  };
}

function addLogEntry(state, type, data = {}) {
  if (['STAGE_CHANGE', 'ALLOCATION_COMPUTED', 'CONSENT_GIVEN'].includes(type)) return state;
  return { ...state, actionLog: [...state.actionLog, { id: Date.now(), timestamp: Date.now(), type, ...data }] };
}

function computeTargetLayersFromAnswers(answers) {
  let risk = 0;
  for (const q of questionnaire.questions) {
    const opt = q.options.find(o => o.id === answers[q.id]);
    risk += (opt?.risk ?? 0);
  }
  if (risk <= 5) return { foundation: 65, growth: 30, upside: 5 };
  if (risk <= 10) return { foundation: 50, growth: 35, upside: 15 };
  return { foundation: 40, growth: 40, upside: 20 };
}

function exposureSnapshot(portfolio) {
  const { pct, totalIRR } = calcLayerPercents(portfolio?.holdings || []);
  return { totalIRR, layers: pct };
}

function buildPreview(beforePortfolio, beforeCash, afterPortfolio, afterCash, targetLayers) {
  const before = exposureSnapshot(beforePortfolio);
  const after = exposureSnapshot(afterPortfolio);
  const beforeDrift = targetLayers ? computeDrift(before.layers, targetLayers) : null;
  const afterDrift = targetLayers ? computeDrift(after.layers, targetLayers) : null;
  return {
    before: { ...before, cashIRR: beforeCash }, after: { ...after, cashIRR: afterCash },
    deltas: { totalIRR: after.totalIRR - before.totalIRR, layers: { foundation: after.layers.foundation - before.layers.foundation, growth: after.layers.growth - before.layers.growth, upside: after.layers.upside - before.layers.upside } },
    beforeDrift, afterDrift, driftChange: afterDrift && beforeDrift ? afterDrift.total - beforeDrift.total : 0,
  };
}

function requireExecuted(state) { return state.user.stage === STAGES.EXECUTED && state.portfolio; }

function reduce(state, event) {
  switch (event.type) {
    case 'RESET': return initialState();
    case 'SHOW_RESET_CONFIRM': return { ...state, showResetConfirm: true };
    case 'HIDE_RESET_CONFIRM': return { ...state, showResetConfirm: false };
    case 'SET_TAB': return { ...state, tab: event.tab };
    case 'SET_PHONE': return { ...state, user: { ...state.user, phone: String(event.phone || '') } };
    case 'SUBMIT_PHONE': {
      const phone = String(state.user.phone || '');
      if (!phone.startsWith('+989') || phone.length !== 13) return state;
      return { ...state, user: { ...state.user, stage: STAGES.QUESTIONNAIRE } };
    }
    case 'ANSWER_QUESTION': {
      if (state.user.stage !== STAGES.QUESTIONNAIRE) return state;
      const answers = { ...state.questionnaire.answers, [event.qId]: event.optionId };
      let idx = state.questionnaire.index + 1;
      let s = { ...state, questionnaire: { index: idx, answers } };
      if (idx >= questionnaire.questions.length) {
        const targetLayers = computeTargetLayersFromAnswers(answers);
        s = { ...s, targetLayers, user: { ...s.user, stage: STAGES.ALLOCATION_PROPOSED } };
      }
      return s;
    }
    case 'SUBMIT_CONSENT': {
      if (state.user.stage !== STAGES.ALLOCATION_PROPOSED) return state;
      if (String(event.text || '') !== CONSENT_EXACT) return state;
      return { ...state, user: { ...state.user, stage: STAGES.AMOUNT_REQUIRED } };
    }
    case 'SET_INVEST_AMOUNT': {
      if (state.user.stage !== STAGES.AMOUNT_REQUIRED) return state;
      return { ...state, user: { ...state.user, investAmountIRR: event.investAmountIRR ?? event.amountIRR } };
    }
    case 'EXECUTE_PORTFOLIO': {
      if (state.user.stage !== STAGES.AMOUNT_REQUIRED) return state;
      const n = Math.floor(Number(state.user.investAmountIRR) || 0);
      if (n < THRESHOLDS.MIN_AMOUNT_IRR) return state;
      const portfolio = buildPortfolio(n, state.targetLayers);
      let s = { ...state, portfolio, cashIRR: 0, user: { ...state.user, stage: STAGES.EXECUTED } };
      const entry = createLedgerEntry('PORTFOLIO_CREATED', { amountIRR: n }, state, s);
      s = { ...s, ledger: [entry], lastAction: { type: 'PORTFOLIO_CREATED', timestamp: Date.now() } };
      s = addLogEntry(s, 'PORTFOLIO_CREATED', { amountIRR: n, targetLayers: state.targetLayers });
      return s;
    }
    case 'CANCEL_POST_ACTION': {
      if (!requireExecuted(state)) return state;
      return { ...state, postAction: POST_ACTIONS.NONE, pendingAmountIRR: null, tradeDraft: null, protectDraft: null, borrowDraft: null, preview: null, validation: null, fundingOptions: null, acknowledged: false };
    }
    case 'SET_ACKNOWLEDGED': return { ...state, acknowledged: event.value };
    case 'DISMISS_LAST_ACTION': return { ...state, lastAction: null };
    case 'START_ADD_FUNDS': {
      if (!requireExecuted(state)) return state;
      return { ...state, postAction: POST_ACTIONS.ADD_FUNDS, pendingAmountIRR: null, preview: null, validation: null, lastAction: null, acknowledged: false };
    }
    case 'SET_PENDING_AMOUNT': {
      if (!requireExecuted(state)) return state;
      return { ...state, pendingAmountIRR: event.amountIRR };
    }
    case 'CONFIRM_ADD_FUNDS': {
      if (!requireExecuted(state)) return state;
      const n = Number(state.pendingAmountIRR);
      const validation = validateAction(state, 'ADD_FUNDS', { amountIRR: n });
      if (!validation.allowed) return { ...state, validation };
      const delta = Math.floor(n);
      const stateBefore = state;
      let s = { ...state, cashIRR: (state.cashIRR || 0) + delta, postAction: POST_ACTIONS.NONE, pendingAmountIRR: null, preview: null, validation: null, acknowledged: false };
      const entry = createLedgerEntry('ADD_FUNDS', { amountIRR: delta }, stateBefore, s);
      s = { ...s, ledger: [...state.ledger, entry], lastAction: { type: 'ADD_FUNDS', amountIRR: delta, boundary: entry.boundary, timestamp: Date.now() } };
      s = addLogEntry(s, 'ADD_FUNDS', { amountIRR: delta });
      return s;
    }
    case 'START_TRADE': {
      if (!requireExecuted(state)) return state;
      return { ...state, postAction: POST_ACTIONS.TRADE, tradeDraft: { assetId: String(event.assetId || ''), side: event.side === 'SELL' ? 'SELL' : 'BUY', amountIRR: null }, preview: null, validation: null, lastAction: null, acknowledged: false };
    }
    case 'SET_TRADE_SIDE': {
      if (!requireExecuted(state) || !state.tradeDraft) return state;
      return { ...state, tradeDraft: { ...state.tradeDraft, side: event.side === 'SELL' ? 'SELL' : 'BUY' } };
    }
    case 'SET_TRADE_AMOUNT': {
      if (!requireExecuted(state) || !state.tradeDraft) return state;
      return { ...state, tradeDraft: { ...state.tradeDraft, amountIRR: event.amountIRR } };
    }
    case 'PREVIEW_TRADE': {
      if (!requireExecuted(state)) return state;
      const d = state.tradeDraft;
      if (!d) return state;
      const validation = validateAction(state, 'TRADE', { assetId: d.assetId, side: d.side, amountIRR: Number(d.amountIRR) });
      if (!validation.allowed) return { ...state, validation };
      const after = tradeAsset(state.portfolio, state.cashIRR, d.assetId, d.side, Math.floor(Number(d.amountIRR)));
      const preview = buildPreview(state.portfolio, state.cashIRR, after.portfolio, after.cashIRR, state.targetLayers);
      return { ...state, preview, validation, postAction: POST_ACTIONS.TRADE_PREVIEW, acknowledged: false };
    }
    case 'CONFIRM_TRADE_FINAL': {
      if (!requireExecuted(state)) return state;
      const d = state.tradeDraft;
      if (!d) return state;
      const validation = validateAction(state, 'TRADE', { assetId: d.assetId, side: d.side, amountIRR: Number(d.amountIRR) });
      if (validation.requiresAcknowledgment && !state.acknowledged) return state;
      if (!validation.allowed) return { ...state, validation };
      const stateBefore = state;
      const after = tradeAsset(state.portfolio, state.cashIRR, d.assetId, d.side, Math.floor(Number(d.amountIRR)));
      let s = { ...state, portfolio: after.portfolio, cashIRR: after.cashIRR, postAction: POST_ACTIONS.NONE, tradeDraft: null, preview: null, validation: null, acknowledged: false };
      const entry = createLedgerEntry('TRADE', { assetId: d.assetId, side: d.side, amountIRR: Number(d.amountIRR) }, stateBefore, s);
      s = { ...s, ledger: [...state.ledger, entry], lastAction: { type: 'TRADE', assetId: d.assetId, side: d.side, amountIRR: Number(d.amountIRR), boundary: entry.boundary, timestamp: Date.now() } };
      s = addLogEntry(s, 'TRADE', { assetId: d.assetId, side: d.side, amountIRR: Number(d.amountIRR) });
      return s;
    }
    case 'START_REBALANCE': {
      if (!requireExecuted(state)) return state;
      return { ...state, postAction: POST_ACTIONS.REBALANCE, preview: null, validation: validateAction(state, 'REBALANCE', {}), lastAction: null, acknowledged: false };
    }
    case 'PREVIEW_REBALANCE': {
      if (!requireExecuted(state)) return state;
      const { portfolio: afterPortfolio, cashIRR: afterCash } = rebalanceToTarget(state.portfolio, state.cashIRR, state.targetLayers);
      const preview = buildPreview(state.portfolio, state.cashIRR, afterPortfolio, afterCash, state.targetLayers);
      return { ...state, preview, validation: validateAction(state, 'REBALANCE', {}), postAction: POST_ACTIONS.REBALANCE_PREVIEW, acknowledged: false };
    }
    case 'CONFIRM_REBALANCE_FINAL': {
      if (!requireExecuted(state)) return state;
      const stateBefore = state;
      const beforeExposure = calcLayerPercents(state.portfolio.holdings);
      const { portfolio: nextPortfolio, cashIRR: nextCash } = rebalanceToTarget(state.portfolio, state.cashIRR, state.targetLayers);
      const afterExposure = calcLayerPercents(nextPortfolio.holdings);
      let s = { ...state, portfolio: nextPortfolio, cashIRR: nextCash, postAction: POST_ACTIONS.NONE, preview: null, validation: null, acknowledged: false };
      const entry = createLedgerEntry('REBALANCE', { totalIRR: nextPortfolio.totalIRR }, stateBefore, s);
      s = { ...s, ledger: [...state.ledger, entry], lastAction: { type: 'REBALANCE', beforeLayers: beforeExposure.pct, afterLayers: afterExposure.pct, boundary: entry.boundary, timestamp: Date.now() } };
      s = addLogEntry(s, 'REBALANCE', { beforeLayers: beforeExposure.pct, afterLayers: afterExposure.pct });
      return s;
    }
    case 'START_PROTECT': {
      if (!requireExecuted(state)) return state;
      const preferred = event?.assetId || state.portfolio.holdings[0]?.asset;
      if (!preferred) return state;
      if ((state.protections || []).find(p => p.assetId === preferred)) return state;
      return { ...state, postAction: POST_ACTIONS.PROTECT, protectDraft: { assetId: preferred, months: 3 }, preview: null, protectError: null, validation: null, fundingOptions: null, lastAction: null, acknowledged: false };
    }
    case 'SET_PROTECT_ASSET': {
      if (!requireExecuted(state) || !state.protectDraft) return state;
      return { ...state, protectDraft: { ...state.protectDraft, assetId: event.assetId }, protectError: null, fundingOptions: null };
    }
    case 'SET_PROTECT_MONTHS': {
      if (!requireExecuted(state) || !state.protectDraft) return state;
      return { ...state, protectDraft: { ...state.protectDraft, months: event.months } };
    }
    case 'PREVIEW_PROTECT': {
      if (!requireExecuted(state)) return state;
      const d = state.protectDraft;
      if (!d) return state;
      const months = Math.min(6, Math.max(1, Math.floor(Number(d.months) || 0)));
      const h = state.portfolio.holdings.find(x => x.asset === d.assetId);
      if (!h) return state;
      const rate = PREMIUM_RATES[h.layer] || 0.02;
      const premium = Math.floor(h.amountIRR * rate * (months / 3));
      const validation = validateAction(state, 'PROTECT', { assetId: d.assetId, months });
      if (!validation.allowed && validation.fundingOptions) {
        return { ...state, postAction: POST_ACTIONS.PROTECT_FUNDING, validation, fundingOptions: validation.fundingOptions, protectError: { premium, shortfall: validation.fundingOptions.shortfall, cashIRR: state.cashIRR || 0 } };
      }
      if (!validation.allowed) return { ...state, validation };
      const afterCash = (state.cashIRR || 0) - premium;
      const preview = buildPreview(state.portfolio, state.cashIRR, state.portfolio, afterCash, state.targetLayers);
      return { ...state, preview: { ...preview, premium, months, assetId: d.assetId, layer: h.layer }, validation, postAction: POST_ACTIONS.PROTECT_PREVIEW, acknowledged: false };
    }
    case 'CONFIRM_PROTECT_FINAL': {
      if (!requireExecuted(state)) return state;
      const d = state.protectDraft;
      if (!d) return state;
      const months = Math.min(6, Math.max(1, Math.floor(Number(d.months) || 0)));
      const h = state.portfolio.holdings.find(x => x.asset === d.assetId);
      if (!h) return state;
      const validation = validateAction(state, 'PROTECT', { assetId: d.assetId, months });
      if (!validation.allowed) return { ...state, validation };
      const rate = PREMIUM_RATES[h.layer] || 0.02;
      const premium = Math.floor(h.amountIRR * rate * (months / 3));
      const protectedUntil = new Date(); protectedUntil.setMonth(protectedUntil.getMonth() + months);
      const stateBefore = state;
      let s = { ...state, cashIRR: (state.cashIRR || 0) - premium, protections: [...(state.protections || []), { assetId: d.assetId, layer: h.layer, months, premiumIRR: premium, protectedUntil: protectedUntil.toISOString().split('T')[0] }], postAction: POST_ACTIONS.NONE, protectDraft: null, preview: null, validation: null, acknowledged: false };
      const entry = createLedgerEntry('PROTECT', { assetId: d.assetId, months, premiumIRR: premium }, stateBefore, s);
      s = { ...s, ledger: [...state.ledger, entry], lastAction: { type: 'PROTECT', assetId: d.assetId, months, boundary: entry.boundary, timestamp: Date.now() } };
      s = addLogEntry(s, 'PROTECT', { assetId: d.assetId, months, premiumIRR: premium });
      return s;
    }
    case 'START_BORROW': {
      if (!requireExecuted(state)) return state;
      const available = state.portfolio.holdings.filter(h => !h.frozen);
      if (available.length === 0) return state;
      const preferred = event?.assetId || available[0].asset;
      const h = state.portfolio.holdings.find(x => x.asset === preferred);
      if (!h || h.frozen) return state;
      const limits = LTV_LIMITS[h.layer] || LTV_LIMITS.growth;
      return { ...state, postAction: POST_ACTIONS.BORROW, borrowDraft: { assetId: preferred, ltv: limits.recommended, amountIRR: null }, preview: null, validation: null, lastAction: null, acknowledged: false };
    }
    case 'SET_BORROW_ASSET': {
      if (!requireExecuted(state) || !state.borrowDraft) return state;
      const h = state.portfolio.holdings.find(x => x.asset === event.assetId);
      if (!h) return state;
      const limits = LTV_LIMITS[h.layer] || LTV_LIMITS.growth;
      return { ...state, borrowDraft: { ...state.borrowDraft, assetId: event.assetId, ltv: limits.recommended } };
    }
    case 'SET_BORROW_LTV': {
      if (!requireExecuted(state) || !state.borrowDraft) return state;
      return { ...state, borrowDraft: { ...state.borrowDraft, ltv: Number(event.ltv) } };
    }
    case 'SET_BORROW_AMOUNT': {
      if (!requireExecuted(state) || !state.borrowDraft) return state;
      return { ...state, borrowDraft: { ...state.borrowDraft, amountIRR: event.amountIRR } };
    }
    case 'PREVIEW_BORROW': {
      if (!requireExecuted(state)) return state;
      const d = state.borrowDraft;
      if (!d) return state;
      const validation = validateAction(state, 'BORROW', { assetId: d.assetId, ltv: d.ltv, amountIRR: Number(d.amountIRR) });
      if (!validation.allowed) return { ...state, validation };
      const h = state.portfolio.holdings.find(x => x.asset === d.assetId);
      if (!h) return state;
      const amount = Math.floor(Number(d.amountIRR) || 0);
      const afterCash = (state.cashIRR || 0) + amount;
      const holdings = state.portfolio.holdings.map(x => ({ ...x }));
      const collateral = holdings.find(x => x.asset === d.assetId);
      if (collateral) collateral.frozen = true;
      const afterPortfolio = { ...state.portfolio, holdings };
      const preview = buildPreview(state.portfolio, state.cashIRR, afterPortfolio, afterCash, state.targetLayers);
      return { ...state, preview: { ...preview, loanAmount: amount, collateralAsset: d.assetId, collateralValue: h.amountIRR, ltv: d.ltv, liquidationIRR: Math.floor(h.amountIRR * (d.ltv + 0.1)) }, validation, postAction: POST_ACTIONS.BORROW_PREVIEW, acknowledged: false };
    }
    case 'CONFIRM_BORROW_FINAL': {
      if (!requireExecuted(state)) return state;
      const d = state.borrowDraft;
      if (!d) return state;
      const validation = validateAction(state, 'BORROW', { assetId: d.assetId, ltv: d.ltv, amountIRR: Number(d.amountIRR) });
      if (validation.requiresAcknowledgment && !state.acknowledged) return state;
      if (!validation.allowed) return { ...state, validation };
      const h = state.portfolio.holdings.find(x => x.asset === d.assetId);
      if (!h) return state;
      const amount = Math.floor(Number(d.amountIRR) || 0);
      const holdings = state.portfolio.holdings.map(x => ({ ...x }));
      const collateral = holdings.find(x => x.asset === d.assetId);
      if (collateral) collateral.frozen = true;
      const stateBefore = state;
      let s = { ...state, portfolio: { ...state.portfolio, holdings }, cashIRR: (state.cashIRR || 0) + amount, loan: { amountIRR: amount, collateralAssetId: d.assetId, collateralValueIRR: h.amountIRR, ltv: d.ltv, liquidationIRR: Math.floor(h.amountIRR * (d.ltv + 0.1)), timestamp: Date.now() }, postAction: POST_ACTIONS.NONE, borrowDraft: null, preview: null, validation: null, acknowledged: false };
      const entry = createLedgerEntry('BORROW', { amountIRR: amount, collateralAssetId: d.assetId, ltv: d.ltv }, stateBefore, s);
      s = { ...s, ledger: [...state.ledger, entry], lastAction: { type: 'BORROW', amountIRR: amount, collateralAssetId: d.assetId, boundary: entry.boundary, timestamp: Date.now() } };
      s = addLogEntry(s, 'BORROW', { amountIRR: amount, collateralAssetId: d.assetId });
      return s;
    }
    case 'START_REPAY_LOAN': {
      if (!requireExecuted(state) || !state.loan) return state;
      return { ...state, postAction: POST_ACTIONS.REPAY_LOAN, preview: null, validation: null, lastAction: null, acknowledged: false };
    }
    case 'PREVIEW_REPAY_LOAN': {
      if (!requireExecuted(state) || !state.loan) return state;
      const validation = validateAction(state, 'REPAY_LOAN', {});
      if (!validation.allowed) return { ...state, validation };
      const holdings = state.portfolio.holdings.map(h => ({ ...h }));
      const collateral = holdings.find(h => h.asset === state.loan.collateralAssetId);
      if (collateral) collateral.frozen = false;
      const afterCash = (state.cashIRR || 0) - state.loan.amountIRR;
      const afterPortfolio = { ...state.portfolio, holdings };
      const preview = buildPreview(state.portfolio, state.cashIRR, afterPortfolio, afterCash, state.targetLayers);
      return { ...state, preview: { ...preview, loanAmount: state.loan.amountIRR, collateralAsset: state.loan.collateralAssetId }, validation, postAction: POST_ACTIONS.REPAY_LOAN_PREVIEW, acknowledged: false };
    }
    case 'CONFIRM_REPAY_LOAN_FINAL': {
      if (!requireExecuted(state) || !state.loan) return state;
      const validation = validateAction(state, 'REPAY_LOAN', {});
      if (!validation.allowed) return { ...state, validation };
      const holdings = state.portfolio.holdings.map(h => ({ ...h }));
      const collateral = holdings.find(h => h.asset === state.loan.collateralAssetId);
      if (collateral) collateral.frozen = false;
      const stateBefore = state;
      let s = { ...state, portfolio: { ...state.portfolio, holdings }, cashIRR: (state.cashIRR || 0) - state.loan.amountIRR, loan: null, postAction: POST_ACTIONS.NONE, preview: null, validation: null, acknowledged: false };
      const entry = createLedgerEntry('REPAY_LOAN', { amountIRR: state.loan.amountIRR, collateralAssetId: state.loan.collateralAssetId }, stateBefore, s);
      s = { ...s, ledger: [...state.ledger, entry], lastAction: { type: 'REPAY_LOAN', amountIRR: state.loan.amountIRR, boundary: entry.boundary, timestamp: Date.now() } };
      s = addLogEntry(s, 'REPAY_LOAN', { amountIRR: state.loan.amountIRR });
      return s;
    }
    default: return state;
  }
}

// ====== UI COMPONENTS ======

function PortfolioHealthBadge({ boundary }) {
  if (!boundary) return null;
  const label = PORTFOLIO_HEALTH_LABELS[boundary.state];
  const colorMap = { SAFE: { bg: 'rgba(34,197,94,.15)', border: 'rgba(34,197,94,.3)', color: '#4ade80' }, DRIFT: { bg: 'rgba(250,204,21,.15)', border: 'rgba(250,204,21,.3)', color: '#fde047' }, STRUCTURAL: { bg: 'rgba(249,115,22,.15)', border: 'rgba(249,115,22,.3)', color: '#fb923c' }, STRESS: { bg: 'rgba(239,68,68,.15)', border: 'rgba(239,68,68,.3)', color: '#f87171' } };
  const colors = colorMap[boundary.state] || colorMap.SAFE;
  return <div className="healthBadge" style={{ background: colors.bg, borderColor: colors.border, color: colors.color }}>{label}</div>;
}

function LayerMini({ layer, pct, target }) {
  const info = LAYER_EXPLANATIONS[layer];
  return (
    <div className="mini">
      <div className="layerHeader"><span className="layerIcon">{info.icon}</span><span className="tag">{info.name}</span></div>
      <div className="big" style={{ fontSize: 20 }}>{Math.round(pct)}%</div>
      <div className="muted">Target {target}%</div>
    </div>
  );
}

function ActionLogPane({ actionLog }) {
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [actionLog]);
  if (!actionLog || actionLog.length === 0) return <div className="actionLogEmpty"><div className="muted">No actions yet</div></div>;
  const formatLogEntry = (entry) => {
    const time = formatTime(entry.timestamp);
    switch (entry.type) {
      case 'PORTFOLIO_CREATED': return `${time}  Started with ${formatIRRShort(entry.amountIRR)}`;
      case 'ADD_FUNDS': return `${time}  +${formatIRRShort(entry.amountIRR)} cash`;
      case 'TRADE': return `${time}  ${entry.side === 'BUY' ? '+' : '-'}${entry.assetId} ${formatIRRShort(entry.amountIRR)}`;
      case 'BORROW': return `${time}  💰 Borrowed ${formatIRRShort(entry.amountIRR)} against ${entry.collateralAssetId}`;
      case 'REPAY_LOAN': return `${time}  ✓ Repaid ${formatIRRShort(entry.amountIRR)}`;
      case 'PROTECT': return `${time}  ☂️ ${entry.assetId} protected ${entry.months}mo`;
      case 'REBALANCE': return entry.beforeLayers && entry.afterLayers ? `${time}  ⟲ Rebalanced: 🛡️${Math.round(entry.beforeLayers.foundation)}→${Math.round(entry.afterLayers.foundation)}% 📈${Math.round(entry.beforeLayers.growth)}→${Math.round(entry.afterLayers.growth)}% 🚀${Math.round(entry.beforeLayers.upside)}→${Math.round(entry.afterLayers.upside)}%` : `${time}  ⟲ Rebalanced`;
      default: return `${time}  ${entry.type}`;
    }
  };
  return <div className="actionLog" ref={logRef}>{actionLog.map((entry) => <div key={entry.id} className="logEntry">{formatLogEntry(entry)}</div>)}</div>;
}

function ExecutionSummary({ lastAction, dispatch }) {
  if (!lastAction) return null;
  const formatSummary = () => {
    switch (lastAction.type) {
      case 'PORTFOLIO_CREATED': return 'Portfolio created';
      case 'ADD_FUNDS': return `+${formatIRRShort(lastAction.amountIRR)} cash`;
      case 'TRADE': return `${lastAction.side === 'BUY' ? '+' : '-'}${lastAction.assetId} ${formatIRRShort(lastAction.amountIRR)}`;
      case 'BORROW': return `💰 ${formatIRRShort(lastAction.amountIRR)}`;
      case 'REPAY_LOAN': return `✓ Repaid`;
      case 'PROTECT': return `☂️ ${lastAction.assetId} ${lastAction.months}mo`;
      case 'REBALANCE': return `⟲ Rebalanced`;
      default: return lastAction.type;
    }
  };
  const showTransition = lastAction.boundary && lastAction.boundary.before !== lastAction.boundary.after;
  return (
    <div className="executionSummary">
      <div className="summaryHeader"><span className="summaryIcon">✓</span><span className="summaryText">{formatSummary()}</span><button className="summaryDismiss" onClick={() => dispatch({ type: 'DISMISS_LAST_ACTION' })}>×</button></div>
      {showTransition && <div className="summaryBoundary"><span className={`healthPill ${lastAction.boundary.before.toLowerCase()}`}>{PORTFOLIO_HEALTH_LABELS[lastAction.boundary.before]}</span><span className="arrow">→</span><span className={`healthPill ${lastAction.boundary.after.toLowerCase()}`}>{PORTFOLIO_HEALTH_LABELS[lastAction.boundary.after]}</span></div>}
    </div>
  );
}

function ResetConfirmModal({ onConfirm, onCancel }) {
  const [confirmText, setConfirmText] = useState('');
  return (
    <div className="modalOverlay">
      <div className="modal">
        <div className="modalHeader">Reset Portfolio?</div>
        <div className="modalBody"><p>This will permanently delete your portfolio and all history.</p><div className="modalInput"><label>Type "reset" to confirm:</label><input className="input" type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="reset" /></div></div>
        <div className="modalFooter"><button className="btn danger" onClick={onConfirm} disabled={confirmText !== 'reset'}>Delete</button><button className="btn" onClick={onCancel}>Cancel</button></div>
      </div>
    </div>
  );
}

function OnboardingRightPanel({ stage, questionIndex, targetLayers, investAmount }) {
  if (stage === STAGES.PHONE_REQUIRED) {
    return (
      <div className="onboardingPanel">
        <div className="welcomeCard"><div className="welcomeIcon">🏦</div><h2>Blu Markets</h2><p>A calm approach to portfolio management.</p>
        <div className="welcomeFeatures">{['foundation', 'growth', 'upside'].map(layer => { const info = LAYER_EXPLANATIONS[layer]; return <div key={layer} className="featureItem"><span className="featureIcon">{info.icon}</span><span>{`${info.name} — ${info.description.split('.')[0]}`}</span></div>; })}</div></div>
      </div>
    );
  }
  if (stage === STAGES.QUESTIONNAIRE) {
    const progress = (questionIndex / questionnaire.questions.length) * 100;
    return (
      <div className="onboardingPanel">
        <div className="progressCard"><h3>Building Your Profile</h3><div className="bigProgress"><svg viewBox="0 0 100 100" className="progressRing"><circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="8" /><circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="8" strokeDasharray={`${progress * 2.83} 283`} strokeLinecap="round" transform="rotate(-90 50 50)" /></svg><div className="progressText">{questionIndex}/{questionnaire.questions.length}</div></div></div>
        <div className="layerPreviewCard"><h4>The Three Layers</h4>{['foundation', 'growth', 'upside'].map(layer => { const info = LAYER_EXPLANATIONS[layer]; return <div key={layer} className="layerPreviewRow"><span className="layerIcon">{info.icon}</span><div><div className="layerPreviewName">{info.name}</div><div className="layerPreviewDesc">{info.description}</div></div></div>; })}</div>
      </div>
    );
  }
  if (stage === STAGES.ALLOCATION_PROPOSED) {
    return (
      <div className="onboardingPanel">
        <div className="allocationPreviewCard"><h3>Your Allocation</h3><div className="allocationViz">{['foundation', 'growth', 'upside'].map(layer => { const info = LAYER_EXPLANATIONS[layer]; const pct = targetLayers?.[layer] || 0; return <div key={layer} className="allocationBar" style={{ flex: pct }}><span className="barIcon">{info.icon}</span><span className="barPct">{pct}%</span></div>; })}</div>
        <div className="allocationDetails">{['foundation', 'growth', 'upside'].map(layer => { const info = LAYER_EXPLANATIONS[layer]; const pct = targetLayers?.[layer] || 0; return <div key={layer} className="detailRow"><div className="detailHeader"><span className="layerIcon">{info.icon}</span><span className="detailName">{info.name}</span><span className="detailPct">{pct}%</span></div><div className="detailAssets">{info.assets.join(' · ')}</div></div>; })}</div></div>
      </div>
    );
  }
  if (stage === STAGES.AMOUNT_REQUIRED) {
    const amount = Number(investAmount) || 0;
    const isValid = amount >= THRESHOLDS.MIN_AMOUNT_IRR;
    return (
      <div className="onboardingPanel">
        <div className="investPreviewCard"><h3>Investment Preview</h3>
        {isValid ? (<><div className="investTotal"><div className="big">{formatIRR(amount)}</div></div><div className="investBreakdown">{['foundation', 'growth', 'upside'].map(layer => { const info = LAYER_EXPLANATIONS[layer]; const pct = targetLayers?.[layer] || 0; return <div key={layer} className="breakdownRow"><div className="breakdownLeft"><span className="layerIcon">{info.icon}</span><span>{info.name}</span></div><div className="breakdownRight"><span className="breakdownAmount">{formatIRR(Math.floor(amount * pct / 100))}</span></div></div>; })}</div></>) : (<div className="investPlaceholder"><div className="muted">{`Minimum: ${formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}`}</div></div>)}</div>
      </div>
    );
  }
  return null;
}

function HistoryPane({ ledger }) {
  const [expanded, setExpanded] = useState({});
  if (!ledger || ledger.length === 0) return <div className="card"><h3>Action History</h3><div className="muted">No actions yet.</div></div>;
  const actionIcons = { 'PORTFOLIO_CREATED': '✓', 'ADD_FUNDS': '+', 'TRADE': '↔', 'REBALANCE': '⟲', 'PROTECT': '☂️', 'BORROW': '💰', 'REPAY_LOAN': '✓' };
  const formatLedgerAction = (entry) => {
    switch (entry.actionType) {
      case 'PORTFOLIO_CREATED': return 'Portfolio Created';
      case 'ADD_FUNDS': return 'Funds Added';
      case 'TRADE': return `${entry.params?.side === 'BUY' ? 'Bought' : 'Sold'} ${entry.params?.assetId || ''}`;
      case 'REBALANCE': return 'Rebalanced';
      case 'PROTECT': return `Protected ${entry.params?.assetId || ''} (${entry.params?.months || 3}mo)`;
      case 'BORROW': return `Borrowed (${entry.params?.collateralAssetId || ''})`;
      case 'REPAY_LOAN': return 'Loan Repaid';
      default: return entry.actionType;
    }
  };
  return (
    <div className="card"><h3>Action History</h3><div className="ledgerList">{[...ledger].reverse().map((entry) => {
      const showTransition = entry.boundary.before !== entry.boundary.after;
      return (
        <div key={entry.id} className="ledgerEntry">
          <div className="ledgerHeader" onClick={() => setExpanded(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))} style={{ cursor: 'pointer' }}><span className="ledgerIcon">{actionIcons[entry.actionType] || '•'}</span><span className="ledgerAction">{formatLedgerAction(entry)}</span><span className="ledgerTime">{formatTimestamp(entry.timestamp)}</span><span className="ledgerExpand">{expanded[entry.id] ? '−' : '+'}</span></div>
          {showTransition && <div className="ledgerBoundary"><span className={`healthPill small ${entry.boundary.before.toLowerCase()}`}>{PORTFOLIO_HEALTH_LABELS[entry.boundary.before]}</span><span className="arrow">→</span><span className={`healthPill small ${entry.boundary.after.toLowerCase()}`}>{PORTFOLIO_HEALTH_LABELS[entry.boundary.after]}</span></div>}
          {expanded[entry.id] && entry.snapshot.before && entry.snapshot.after && <div className="ledgerDetails"><div className="ledgerSnapshot"><div className="snapshotColumn"><div className="snapshotLabel">Before</div><div className="snapshotValue">{formatIRR(entry.snapshot.before.totalIRR)}</div></div><div className="snapshotColumn"><div className="snapshotLabel">After</div><div className="snapshotValue">{formatIRR(entry.snapshot.after.totalIRR)}</div></div></div></div>}
        </div>
      );
    })}</div></div>
  );
}

function PortfolioHome({ portfolio, cashIRR, targetLayers, onStartTrade, onStartProtect, onStartBorrow }) {
  if (!portfolio) return <div className="card"><h3>Portfolio</h3><div className="muted">Complete onboarding to create your portfolio.</div></div>;
  const exposure = calcLayerPercents(portfolio.holdings);
  const total = exposure.totalIRR + (cashIRR || 0);
  return (
    <div className="stack">
      <div className="card"><div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><div className="muted">Total Value</div><div className="big">{formatIRR(total)}</div></div><div style={{ textAlign: 'right' }}><div className="muted">Cash</div><div className="big" style={{ fontSize: 22 }}>{formatIRR(cashIRR || 0)}</div></div></div></div>
      <div className="card"><h3>Asset Allocation</h3><div className="grid3">{['foundation', 'growth', 'upside'].map(layer => <LayerMini key={layer} layer={layer} pct={exposure.pct[layer]} target={targetLayers?.[layer] ?? '-'} />)}</div></div>
      <div className="card"><h3>Holdings</h3><div className="list">{portfolio.holdings.map((h) => { const info = LAYER_EXPLANATIONS[h.layer]; return (
        <div key={h.asset} className="item" style={{ alignItems: 'center' }}><div style={{ flex: 1 }}><div className="asset">{h.asset}</div><div className="muted">{info.icon} {info.name}{h.frozen ? ' · 🔒' : ''}</div></div>
        <div style={{ textAlign: 'right', minWidth: 150 }}><div className="asset">{formatIRR(h.amountIRR)}</div><div className="row" style={{ justifyContent: 'flex-end', gap: 6, marginTop: 6, flexWrap: 'wrap' }}><button className="btn tiny" onClick={() => onStartTrade(h.asset, 'BUY')}>Buy</button><button className={'btn tiny ' + (h.frozen ? 'disabled' : '')} disabled={h.frozen} onClick={() => onStartTrade(h.asset, 'SELL')}>Sell</button><button className="btn tiny" onClick={() => onStartProtect?.(h.asset)}>Protect</button><button className={'btn tiny ' + (h.frozen ? 'disabled' : '')} disabled={h.frozen} onClick={() => onStartBorrow?.(h.asset)}>Borrow</button></div></div></div>
      ); })}</div></div>
    </div>
  );
}

function Protection({ protections }) {
  const list = protections || [];
  return (
    <div className="card"><h3>Active Protections</h3>
    {list.length === 0 ? <div className="muted">No assets protected.</div> : <div className="list">{list.map((p, idx) => { const info = LAYER_EXPLANATIONS[p.layer]; return <div key={p.assetId + '|' + idx} className="item"><div style={{ flex: 1 }}><div className="asset">☂️ {p.assetId}</div><div className="muted">{info?.icon} {info?.name} · Until {p.protectedUntil}</div></div><div style={{ textAlign: 'right' }}><div className="asset">{formatIRR(p.premiumIRR)}</div><div className="muted">Premium paid</div></div></div>; })}</div>}</div>
  );
}

function Loans({ loan, dispatch }) {
  return (
    <div className="card"><h3>Active Loan</h3>
    {!loan ? <div className="muted">No active loans.</div> : <div className="list"><div className="item loanItem"><div style={{ flex: 1 }}><div className="loanAmount">{formatIRR(loan.amountIRR)}</div><div className="loanDetails">Collateral: {loan.collateralAssetId} · LTV {Math.round(loan.ltv * 100)}%</div></div><div style={{ textAlign: 'right' }}><div className="liquidationValue">{formatIRR(loan.liquidationIRR)}</div><div className="muted">Liquidation</div></div></div><button className="btn primary" style={{ width: '100%', marginTop: 10 }} onClick={() => dispatch({ type: 'START_REPAY_LOAN' })}>Repay Loan</button></div>}</div>
  );
}

function PhoneForm({ state, dispatch }) {
  const isValid = state.user.phone.startsWith('+989') && state.user.phone.length === 13;
  return (
    <div><div className="muted" style={{ marginBottom: 10 }}>Sign in</div><div className="row"><input className="input" type="tel" placeholder="+989XXXXXXXXX" value={state.user.phone} onChange={(e) => dispatch({ type: 'SET_PHONE', phone: e.target.value })} /><button className="btn primary" onClick={() => dispatch({ type: 'SUBMIT_PHONE' })} disabled={!isValid}>Continue</button></div>{state.user.phone && !isValid && <div className="validationError">+989XXXXXXXXX</div>}</div>
  );
}

function Tabs({ tab, dispatch }) {
  return <div className="tabs" style={{ padding: '0 14px 10px' }}>{['PORTFOLIO', 'PROTECTION', 'LOANS', 'HISTORY'].map((t) => { const labels = { PORTFOLIO: 'Portfolio', PROTECTION: 'Protection', LOANS: 'Loans', HISTORY: 'History' }; return <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_TAB', tab: t })}>{labels[t]}</div>; })}</div>;
}

function ActionCard({ title, children }) { return <div className="actionCard"><div className="actionTitle">{title}</div>{children}</div>; }

function AcknowledgmentCheckbox({ validation, acknowledged, onChange }) {
  if (!validation?.requiresAcknowledgment) return null;
  return <div className="acknowledgment"><label className="ackLabel"><input type="checkbox" checked={acknowledged} onChange={(e) => onChange(e.target.checked)} /><span>I understand: {validation.acknowledgmentMessage}</span></label></div>;
}

function PreviewPanel({ title, preview, validation, acknowledged, onAcknowledge, onConfirm, onBack, confirmLabel }) {
  const canConfirm = !validation?.requiresAcknowledgment || acknowledged;
  return (
    <div className="previewPanel">
      <div className="previewTitle">{title}</div>
      {preview && <div className="previewCard"><div className="previewGrid"><div className="previewColumn"><div className="previewLabel">Before</div><div className="previewLayers">🛡️{Math.round(preview.before.layers.foundation)}% 📈{Math.round(preview.before.layers.growth)}% 🚀{Math.round(preview.before.layers.upside)}%</div><div className="previewTotal">{formatIRR(preview.before.totalIRR)}</div></div><div className="previewColumn"><div className="previewLabel">After</div><div className="previewLayers">🛡️{Math.round(preview.after.layers.foundation)}% 📈{Math.round(preview.after.layers.growth)}% 🚀{Math.round(preview.after.layers.upside)}%</div><div className="previewTotal">{formatIRR(preview.after.totalIRR)}</div></div></div>{validation?.projectedBoundary && <div className="projectedBoundary"><span className="projectedLabel">Portfolio Health:</span><span className={`healthPill ${validation.projectedBoundary.state.toLowerCase()}`}>{PORTFOLIO_HEALTH_LABELS[validation.projectedBoundary.state]}</span></div>}</div>}
      {validation?.warnings?.length > 0 && <div className="validationDisplay">{validation.warnings.map((w, i) => <div key={i} className="validationWarning">{w}</div>)}</div>}
      <AcknowledgmentCheckbox validation={validation} acknowledged={acknowledged} onChange={onAcknowledge} />
      <div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={onConfirm} disabled={!canConfirm}>{confirmLabel || 'Confirm'}</button><button className="btn" onClick={onBack}>Cancel</button></div>
    </div>
  );
}

function OnboardingControls({ state, dispatch }) {
  const [consentText, setConsentText] = useState('');
  const isConsentMatch = consentText === CONSENT_EXACT;

  if (state.user.stage === STAGES.PHONE_REQUIRED) return <PhoneForm state={state} dispatch={dispatch} />;
  if (state.user.stage === STAGES.QUESTIONNAIRE) {
    const idx = state.questionnaire.index;
    if (idx >= questionnaire.questions.length) return null;
    const q = questionnaire.questions[idx];
    return (
      <div><div className="questionnaireHeader"><span className="muted">{idx + 1}/{questionnaire.questions.length}</span></div>
      <div className="q-card"><div className="q-title">{q.text}</div><div className="q-english">{q.english}</div><div className="q-options">{q.options.map((opt) => <button key={opt.id} className="opt" onClick={() => dispatch({ type: 'ANSWER_QUESTION', qId: q.id, optionId: opt.id })}>{opt.text}<div className="opt-english">{opt.english}</div></button>)}</div></div></div>
    );
  }
  if (state.user.stage === STAGES.ALLOCATION_PROPOSED) {
    return (
      <div><div className="consentCard"><div className="consentHeader">Confirm allocation</div><div className="consentInstruction">Type the following sentence exactly:</div><div className="consentSentence"><div className="sentenceFa">{questionnaire.consent_exact}</div><div className="sentenceEn">{questionnaire.consent_english}</div></div><input className="input" type="text" dir="rtl" placeholder="Type consent here..." value={consentText} onChange={(e) => setConsentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && isConsentMatch) dispatch({ type: 'SUBMIT_CONSENT', text: consentText }); }} /><button className="btn primary" style={{ marginTop: 10, width: '100%' }} disabled={!isConsentMatch} onClick={() => dispatch({ type: 'SUBMIT_CONSENT', text: consentText })}>Confirm</button></div></div>
    );
  }
  if (state.user.stage === STAGES.AMOUNT_REQUIRED) {
    const amount = Number(state.user.investAmountIRR) || 0;
    const isValid = amount >= THRESHOLDS.MIN_AMOUNT_IRR;
    return <div><div className="muted" style={{ marginBottom: 10 }}>Investment amount (IRR)</div><div className="row"><input className="input" type="number" placeholder={formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)} value={state.user.investAmountIRR || ''} onChange={(e) => dispatch({ type: 'SET_INVEST_AMOUNT', investAmountIRR: e.target.value })} /><button className="btn primary" onClick={() => dispatch({ type: 'EXECUTE_PORTFOLIO' })} disabled={!isValid}>Create Portfolio</button></div></div>;
  }
  // EXECUTED
  return (
    <div>
      {state.lastAction && <ExecutionSummary lastAction={state.lastAction} dispatch={dispatch} />}
      {state.postAction === POST_ACTIONS.NONE && <div className="row"><button className="btn primary" onClick={() => dispatch({ type: 'START_ADD_FUNDS' })}>Add Funds</button><button className="btn" onClick={() => dispatch({ type: 'START_REBALANCE' })}>Rebalance</button><button className="btn" onClick={() => dispatch({ type: 'START_PROTECT' })}>☂️</button><button className="btn" onClick={() => dispatch({ type: 'START_BORROW' })}>💰</button><button className="btn tiny danger" onClick={() => dispatch({ type: 'SHOW_RESET_CONFIRM' })}>×</button></div>}
      {state.postAction === POST_ACTIONS.ADD_FUNDS && <ActionCard title="Add Funds"><input className="input" type="number" placeholder="Amount (IRR)" value={state.pendingAmountIRR || ''} onChange={(e) => dispatch({ type: 'SET_PENDING_AMOUNT', amountIRR: e.target.value })} />{state.validation?.errors?.length > 0 && <div className="validationDisplay">{state.validation.errors.map((e, i) => <div key={i} className="validationError">{e}</div>)}</div>}<div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={() => dispatch({ type: 'CONFIRM_ADD_FUNDS' })} disabled={!state.pendingAmountIRR}>Add to Cash</button><button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button></div></ActionCard>}
      {state.postAction === POST_ACTIONS.TRADE && <ActionCard title={`${state.tradeDraft?.side === 'BUY' ? 'Buy' : 'Sell'} ${state.tradeDraft?.assetId}`}><div className="row" style={{ gap: 8 }}><button className={`chip ${state.tradeDraft?.side === 'BUY' ? 'primary' : ''}`} onClick={() => dispatch({ type: 'SET_TRADE_SIDE', side: 'BUY' })}>Buy</button><button className={`chip ${state.tradeDraft?.side === 'SELL' ? 'primary' : ''}`} onClick={() => dispatch({ type: 'SET_TRADE_SIDE', side: 'SELL' })}>Sell</button></div><input className="input" style={{ marginTop: 8 }} type="number" placeholder="Amount (IRR)" value={state.tradeDraft?.amountIRR ?? ''} onChange={(e) => dispatch({ type: 'SET_TRADE_AMOUNT', amountIRR: e.target.value })} />{state.validation?.errors?.length > 0 && <div className="validationDisplay">{state.validation.errors.map((e, i) => <div key={i} className="validationError">{e}</div>)}</div>}<div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_TRADE' })} disabled={!state.tradeDraft?.amountIRR}>Preview</button><button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button></div></ActionCard>}
      {state.postAction === POST_ACTIONS.TRADE_PREVIEW && <PreviewPanel title={`${state.tradeDraft?.side === 'BUY' ? 'Buy' : 'Sell'} ${state.tradeDraft?.assetId}`} preview={state.preview} validation={state.validation} acknowledged={state.acknowledged} onAcknowledge={(v) => dispatch({ type: 'SET_ACKNOWLEDGED', value: v })} onConfirm={() => dispatch({ type: 'CONFIRM_TRADE_FINAL' })} onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })} />}
      {state.postAction === POST_ACTIONS.REBALANCE && <ActionCard title="Rebalance"><div className="muted">Reallocate assets to target. Cash and frozen assets unchanged.</div><div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_REBALANCE' })}>Preview</button><button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button></div></ActionCard>}
      {state.postAction === POST_ACTIONS.REBALANCE_PREVIEW && <PreviewPanel title="Rebalance Preview" preview={state.preview} validation={state.validation} acknowledged={state.acknowledged} onAcknowledge={(v) => dispatch({ type: 'SET_ACKNOWLEDGED', value: v })} onConfirm={() => dispatch({ type: 'CONFIRM_REBALANCE_FINAL' })} onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })} confirmLabel="Rebalance" />}
      {state.postAction === POST_ACTIONS.PROTECT && <ActionCard title="☂️ Protect Asset"><div className="row" style={{ gap: 8 }}><select className="input" value={state.protectDraft?.assetId || ''} onChange={(e) => dispatch({ type: 'SET_PROTECT_ASSET', assetId: e.target.value })}>{(state.portfolio?.holdings || []).map((h) => { const info = LAYER_EXPLANATIONS[h.layer]; const rate = PREMIUM_RATES[h.layer] || 0.02; return <option key={h.asset} value={h.asset}>{info.icon} {h.asset} — {Math.round(rate * 100)}% / 3mo</option>; })}</select><select className="input" value={state.protectDraft?.months ?? 3} onChange={(e) => dispatch({ type: 'SET_PROTECT_MONTHS', months: Number(e.target.value) })} style={{ width: 100 }}>{[1, 2, 3, 4, 5, 6].map((m) => <option key={m} value={m}>{m} mo</option>)}</select></div>{state.protectDraft?.assetId && <div className="premiumHint">{(() => { const h = state.portfolio?.holdings?.find(x => x.asset === state.protectDraft.assetId); if (!h) return null; const rate = PREMIUM_RATES[h.layer] || 0.02; const premium = Math.floor(h.amountIRR * rate * (state.protectDraft.months / 3)); return <span>Premium: {formatIRR(premium)}</span>; })()}</div>}{state.validation?.errors?.length > 0 && <div className="validationDisplay">{state.validation.errors.map((e, i) => <div key={i} className="validationError">{e}</div>)}</div>}<div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_PROTECT' })}>Preview</button><button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button></div></ActionCard>}
      {state.postAction === POST_ACTIONS.PROTECT_PREVIEW && <PreviewPanel title="☂️ Protection Preview" preview={state.preview} validation={state.validation} acknowledged={state.acknowledged} onAcknowledge={(v) => dispatch({ type: 'SET_ACKNOWLEDGED', value: v })} onConfirm={() => dispatch({ type: 'CONFIRM_PROTECT_FINAL' })} onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })} confirmLabel="Protect" />}
      {state.postAction === POST_ACTIONS.BORROW && <ActionCard title="💰 Borrow"><div className="row" style={{ gap: 8 }}><select className="input" value={state.borrowDraft?.assetId || ''} onChange={(e) => dispatch({ type: 'SET_BORROW_ASSET', assetId: e.target.value })}>{(state.portfolio?.holdings || []).filter(h => !h.frozen).map((h) => { const info = LAYER_EXPLANATIONS[h.layer]; const limits = LTV_LIMITS[h.layer] || LTV_LIMITS.growth; return <option key={h.asset} value={h.asset}>{info.icon} {h.asset} (max {Math.round(limits.max * 100)}% LTV)</option>; })}</select><select className="input" value={state.borrowDraft?.ltv ?? 0.5} onChange={(e) => dispatch({ type: 'SET_BORROW_LTV', ltv: e.target.value })} style={{ width: 100 }}><option value={0.4}>40% LTV</option><option value={0.5}>50% LTV</option><option value={0.6}>60% LTV</option></select></div><input className="input" style={{ marginTop: 8 }} type="number" placeholder="Loan amount (IRR)" value={state.borrowDraft?.amountIRR ?? ''} onChange={(e) => dispatch({ type: 'SET_BORROW_AMOUNT', amountIRR: e.target.value })} />{state.borrowDraft?.assetId && <div className="borrowHint">{(() => { const h = state.portfolio?.holdings?.find(x => x.asset === state.borrowDraft.assetId); if (!h) return null; const max = Math.floor(h.amountIRR * state.borrowDraft.ltv); return <span>Max: {formatIRR(max)}</span>; })()}</div>}{state.validation?.errors?.length > 0 && <div className="validationDisplay">{state.validation.errors.map((e, i) => <div key={i} className="validationError">{e}</div>)}</div>}<div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_BORROW' })} disabled={!state.borrowDraft?.amountIRR}>Preview</button><button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button></div></ActionCard>}
      {state.postAction === POST_ACTIONS.BORROW_PREVIEW && <PreviewPanel title="💰 Borrow Preview" preview={state.preview} validation={state.validation} acknowledged={state.acknowledged} onAcknowledge={(v) => dispatch({ type: 'SET_ACKNOWLEDGED', value: v })} onConfirm={() => dispatch({ type: 'CONFIRM_BORROW_FINAL' })} onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })} confirmLabel="Borrow" />}
      {state.postAction === POST_ACTIONS.REPAY_LOAN && <ActionCard title="Repay Loan"><div className="repayDetails"><div className="repayRow"><span>Loan:</span><span>{formatIRR(state.loan?.amountIRR || 0)}</span></div><div className="repayRow"><span>Cash:</span><span>{formatIRR(state.cashIRR || 0)}</span></div><div className="repayRow"><span>Collateral:</span><span>{state.loan?.collateralAssetId}</span></div></div>{state.validation?.errors?.length > 0 && <div className="validationDisplay">{state.validation.errors.map((e, i) => <div key={i} className="validationError">{e}</div>)}</div>}<div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_REPAY_LOAN' })} disabled={(state.cashIRR || 0) < (state.loan?.amountIRR || 0)}>Preview</button><button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button></div></ActionCard>}
      {state.postAction === POST_ACTIONS.REPAY_LOAN_PREVIEW && <PreviewPanel title="Repay Loan Preview" preview={state.preview} validation={state.validation} acknowledged={state.acknowledged} onAcknowledge={(v) => dispatch({ type: 'SET_ACKNOWLEDGED', value: v })} onConfirm={() => dispatch({ type: 'CONFIRM_REPAY_LOAN_FINAL' })} onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })} confirmLabel="Repay" />}
    </div>
  );
}

// ====== MAIN APP ======
export default function App() {
  const [state, dispatch] = useReducer(reduce, null, initialState);
  const boundary = useMemo(() => computeBoundary(state), [state]);
  const stepLabel = useMemo(() => {
    const map = { [STAGES.PHONE_REQUIRED]: { idx: 1, name: 'Phone' }, [STAGES.QUESTIONNAIRE]: { idx: 2, name: 'Profile' }, [STAGES.ALLOCATION_PROPOSED]: { idx: 3, name: 'Review' }, [STAGES.AMOUNT_REQUIRED]: { idx: 4, name: 'Fund' }, [STAGES.EXECUTED]: { idx: 5, name: 'Active' } };
    const x = map[state.user.stage] || { idx: 0, name: state.user.stage };
    return `${x.idx}/5 — ${x.name}`;
  }, [state.user.stage]);
  const onStartTrade = (assetId, side) => dispatch({ type: 'START_TRADE', assetId, side });
  const onStartProtect = (assetId) => dispatch({ type: 'START_PROTECT', assetId });
  const onStartBorrow = (assetId) => dispatch({ type: 'START_BORROW', assetId });
  const right = useMemo(() => {
    if (state.user.stage !== STAGES.EXECUTED) return <OnboardingRightPanel stage={state.user.stage} questionIndex={state.questionnaire.index} targetLayers={state.targetLayers} investAmount={state.user.investAmountIRR} />;
    if (state.tab === 'PROTECTION') return <Protection protections={state.protections} />;
    if (state.tab === 'LOANS') return <Loans loan={state.loan} dispatch={dispatch} />;
    if (state.tab === 'HISTORY') return <HistoryPane ledger={state.ledger} />;
    return <PortfolioHome portfolio={state.portfolio} cashIRR={state.cashIRR} targetLayers={state.targetLayers} onStartTrade={onStartTrade} onStartProtect={onStartProtect} onStartBorrow={onStartBorrow} />;
  }, [state.user.stage, state.tab, state.portfolio, state.cashIRR, state.targetLayers, state.protections, state.loan, state.ledger, state.questionnaire.index, state.user.investAmountIRR]);

  return (
    <>
      <style>{`
        :root{--bg:#0b1220;--panel:#0f1a2e;--card:#101f3a;--border:rgba(255,255,255,.08);--text:#e8eefc;--muted:rgba(232,238,252,.72);--accent:#4f7cff;--accent2:rgba(79,124,255,.18)}
        *{box-sizing:border-box}html,body{height:100%;margin:0}body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);font-size:14px}
        .container{height:100vh;display:grid;grid-template-columns:420px 1fr;gap:12px;padding:12px}.panel{background:var(--panel);border:1px solid var(--border);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;min-height:0}
        .header{padding:14px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px}.logo{width:28px;height:28px;border-radius:8px;background:var(--accent2);display:grid;place-items:center;font-weight:700}.h-title{font-weight:700}.h-sub{font-size:12px;color:var(--muted);margin-top:2px}
        .rightMeta{display:flex;flex-direction:column;align-items:flex-end;gap:6px}.pill{display:inline-flex;gap:8px;align-items:center;padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:rgba(255,255,255,.03);font-weight:600;font-size:11px}
        .body{padding:14px;overflow:auto;flex:1;min-height:0}.footer{padding:12px;border-top:1px solid var(--border);background:rgba(255,255,255,.02)}.row{display:flex;gap:8px;flex-wrap:wrap}
        .btn{appearance:none;border:1px solid var(--border);background:rgba(255,255,255,.03);color:var(--text);padding:10px 14px;border-radius:12px;font-weight:600;cursor:pointer;font-size:13px}.btn.primary{background:var(--accent2);border-color:rgba(79,124,255,.35)}.btn.danger{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.4);color:#f87171}.btn:disabled{opacity:.45;cursor:not-allowed}.btn.tiny{padding:6px 10px;font-size:11px;border-radius:10px}.btn.tiny.disabled{opacity:.5;cursor:not-allowed}
        .input{width:100%;padding:11px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.03);color:var(--text);font-weight:500;outline:none;font-size:14px}
        .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px;margin-bottom:12px}.card h3{margin:0 0 10px 0;font-size:14px;font-weight:600}.big{font-size:24px;font-weight:700}.muted{color:var(--muted);font-size:12px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .mini{border:1px solid var(--border);border-radius:14px;padding:10px;background:rgba(255,255,255,.02)}.tag{font-size:11px;color:var(--muted);text-transform:uppercase}.list{display:flex;flex-direction:column;gap:10px}.item{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.02)}.asset{font-weight:600}
        .tabs{display:flex;gap:8px;flex-wrap:wrap}.tab{padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.02);font-weight:600;cursor:pointer;font-size:13px}.tab.active{background:var(--accent2);border-color:rgba(79,124,255,.35)}
        .chip{padding:8px 12px;border-radius:999px;border:1px solid var(--border);background:rgba(255,255,255,.03);font-weight:600;font-size:12px;cursor:pointer}.chip.primary{background:var(--accent2);border-color:rgba(79,124,255,.35)}
        @media(max-width:980px){.container{grid-template-columns:1fr;}.panel{min-height:48vh}}
        .healthBadge{display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;border:1px solid;font-size:12px;font-weight:600}
        .healthPill{padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600}.healthPill.small{padding:2px 6px;font-size:9px}.healthPill.safe{background:rgba(34,197,94,.15);color:#4ade80}.healthPill.drift{background:rgba(250,204,21,.15);color:#fde047}.healthPill.structural{background:rgba(249,115,22,.15);color:#fb923c}.healthPill.stress{background:rgba(239,68,68,.15);color:#f87171}
        .layerIcon{font-size:14px;margin-right:4px}.layerHeader{display:flex;align-items:center;gap:4px;margin-bottom:4px}
        .actionLog{display:flex;flex-direction:column;gap:4px;font-family:ui-monospace,monospace;font-size:12px}.actionLogEmpty{padding:20px;text-align:center}.logEntry{padding:6px 0;color:var(--muted);border-bottom:1px solid var(--border)}.logEntry:last-child{border-bottom:none}
        .executionSummary{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);border-radius:12px;padding:10px;margin-bottom:12px}.summaryHeader{display:flex;align-items:center;gap:8px}.summaryIcon{color:#4ade80}.summaryText{flex:1;font-weight:600;font-size:13px}.summaryDismiss{background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:0}.summaryBoundary{display:flex;align-items:center;gap:6px;margin-top:6px}.arrow{color:var(--muted);font-size:11px}
        .questionnaireHeader{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.q-card{border:1px solid var(--border);border-radius:16px;padding:12px;background:rgba(255,255,255,.02)}.q-title{font-weight:600;margin-bottom:6px;line-height:1.4}.q-english{font-size:12px;color:var(--muted);margin-bottom:10px;font-style:italic}.q-options{display:flex;flex-direction:column;gap:8px}.opt{appearance:none;border:1px solid var(--border);background:rgba(255,255,255,.03);color:var(--text);padding:10px 12px;border-radius:12px;font-weight:500;cursor:pointer;text-align:left}.opt:hover{border-color:rgba(79,124,255,.35)}.opt-english{font-size:11px;color:var(--muted);margin-top:4px;font-weight:400}
        .consentCard{border:1px solid var(--border);border-radius:14px;padding:12px;background:rgba(255,255,255,.02)}.consentHeader{font-weight:600;margin-bottom:8px}.consentInstruction{font-size:12px;color:var(--muted);margin-bottom:10px}.consentSentence{background:rgba(0,0,0,.2);border-radius:10px;padding:10px;margin-bottom:10px}.sentenceFa{font-weight:600;font-size:13px;line-height:1.5}.sentenceEn{font-size:11px;color:var(--muted);margin-top:6px;font-style:italic}
        .actionCard{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px}.actionTitle{font-weight:600;font-size:13px;margin-bottom:10px;color:var(--muted)}
        .previewPanel{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px}.previewTitle{font-weight:600;font-size:13px;margin-bottom:10px;color:var(--muted)}.previewCard{border:1px solid var(--border);border-radius:12px;padding:12px;background:rgba(255,255,255,.02)}.previewGrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.previewLabel{font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px}.previewLayers{font-size:13px;font-weight:600}.previewTotal{font-size:12px;color:var(--muted);margin-top:4px}.projectedBoundary{display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}.projectedLabel{font-size:11px;color:var(--muted)}
        .validationDisplay{margin-top:10px}.validationError{padding:8px 12px;border-radius:8px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#f87171;font-size:12px;margin-bottom:6px}.validationWarning{padding:8px 12px;border-radius:8px;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.25);color:#fb923c;font-size:12px;margin-bottom:6px}
        .acknowledgment{margin-top:12px;padding:10px;border:1px solid rgba(249,115,22,.3);border-radius:10px;background:rgba(249,115,22,.08)}.ackLabel{display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12px;color:#fb923c}.ackLabel input{margin-top:2px}
        .ledgerList{display:flex;flex-direction:column;gap:8px}.ledgerEntry{border:1px solid var(--border);border-radius:12px;padding:10px;background:rgba(255,255,255,.02)}.ledgerHeader{display:flex;align-items:center;gap:8px}.ledgerIcon{font-size:12px;width:20px}.ledgerAction{font-weight:600;font-size:13px;flex:1}.ledgerTime{color:var(--muted);font-size:11px}.ledgerExpand{color:var(--muted);font-size:14px;width:20px;text-align:center}.ledgerBoundary{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}.ledgerDetails{margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}.ledgerSnapshot{display:grid;grid-template-columns:1fr 1fr;gap:12px}.snapshotLabel{font-size:10px;color:var(--muted);text-transform:uppercase}.snapshotValue{font-weight:600;font-size:13px;margin-top:2px}
        .ltvLimits{margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}.limitsTitle{font-size:11px;color:var(--muted);text-transform:uppercase;margin-bottom:8px}.limitsRow{display:flex;justify-content:space-between;font-size:12px;padding:3px 0}
        .borrowHint,.premiumHint{font-size:11px;color:var(--muted);margin-top:6px;padding:6px 8px;background:rgba(0,0,0,.2);border-radius:6px}.loanItem{background:rgba(79,124,255,.08)}.loanAmount{font-size:18px;font-weight:700}.loanDetails{font-size:12px;color:var(--muted);margin-top:4px}.liquidationValue{font-size:16px;font-weight:600;color:#fb923c}
        .repayDetails{background:rgba(0,0,0,.2);border-radius:10px;padding:10px}.repayRow{display:flex;justify-content:space-between;font-size:12px;padding:4px 0}
        .modalOverlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100}.modal{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:20px;max-width:400px;width:90%}.modalHeader{font-weight:700;font-size:16px;margin-bottom:12px}.modalBody{margin-bottom:16px}.modalBody p{margin:0 0 10px 0;font-size:13px;color:var(--muted)}.modalInput{margin-top:12px}.modalInput label{display:block;font-size:12px;color:var(--muted);margin-bottom:6px}.modalFooter{display:flex;gap:8px}
        .onboardingPanel{height:100%;display:flex;flex-direction:column;gap:12px}.welcomeCard{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;text-align:center}.welcomeIcon{font-size:48px;margin-bottom:12px}.welcomeCard h2{margin:0 0 8px 0;font-weight:700}.welcomeCard p{color:var(--muted);margin:0 0 16px 0}.welcomeFeatures{text-align:left}.featureItem{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)}.featureItem:last-child{border-bottom:none}.featureIcon{font-size:18px}
        .progressCard{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;text-align:center}.progressCard h3{margin:0 0 16px 0}.bigProgress{position:relative;width:100px;height:100px;margin:0 auto 16px}.progressRing{width:100%;height:100%}.progressText{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-weight:700;font-size:18px}
        .layerPreviewCard{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px}.layerPreviewCard h4{margin:0 0 12px 0;font-size:13px}.layerPreviewRow{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}.layerPreviewRow:last-child{margin-bottom:0}.layerPreviewName{font-weight:600;font-size:12px}.layerPreviewDesc{font-size:11px;color:var(--muted)}
        .allocationPreviewCard{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px}.allocationPreviewCard h3{margin:0 0 14px 0}.allocationViz{display:flex;gap:2px;height:50px;margin-bottom:16px;border-radius:8px;overflow:hidden}.allocationBar{display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--accent2)}.barIcon{font-size:16px}.barPct{font-size:12px;font-weight:600}.allocationDetails{display:flex;flex-direction:column;gap:10px}.detailHeader{display:flex;align-items:center;gap:8px}.detailName{font-weight:600;font-size:12px;flex:1}.detailPct{font-weight:600}.detailAssets{font-size:11px;color:var(--muted);margin-left:24px;margin-top:2px}
        .investPreviewCard{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px}.investPreviewCard h3{margin:0 0 14px 0}.investTotal{text-align:center;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)}.investBreakdown{display:flex;flex-direction:column;gap:8px}.breakdownRow{display:flex;justify-content:space-between;align-items:center}.breakdownLeft{display:flex;align-items:center;gap:8px}.breakdownAmount{font-weight:600;font-size:13px}.investPlaceholder{padding:30px;text-align:center}
        .stack{display:flex;flex-direction:column;gap:0}
      `}</style>
      <div className="container">
        <div className="panel">
          <div className="header"><div className="logo">B</div><div style={{ flex: 1 }}><div className="h-title">Blu Markets</div><div className="h-sub">{stepLabel}</div></div><div className="rightMeta"><div className="pill">{state.user.phone || 'Not signed in'}</div>{state.user.stage === STAGES.EXECUTED && <PortfolioHealthBadge boundary={boundary} />}</div></div>
          <div className="body"><ActionLogPane actionLog={state.actionLog} /></div>
          <div className="footer"><OnboardingControls state={state} dispatch={dispatch} /></div>
        </div>
        <div className="panel">
          <div className="header"><div style={{ flex: 1 }}><div className="h-title">{state.user.stage === STAGES.EXECUTED ? 'Portfolio' : 'Getting Started'}</div><div className="h-sub">{state.user.stage === STAGES.EXECUTED ? `Cash: ${formatIRR(state.cashIRR || 0)}` : 'Complete the steps'}</div></div><div className="rightMeta">{state.user.stage === STAGES.EXECUTED && <><PortfolioHealthBadge boundary={boundary} />{state.loan && <div className="pill" style={{ color: '#fb923c', borderColor: 'rgba(249,115,22,.3)' }}><span>Loan</span><span>{formatIRR(state.loan.amountIRR)}</span></div>}</>}</div></div>
          {state.user.stage === STAGES.EXECUTED && <Tabs tab={state.tab} dispatch={dispatch} />}
          <div className="body">{right}</div>
        </div>
      </div>
      {state.showResetConfirm && <ResetConfirmModal onConfirm={() => dispatch({ type: 'RESET' })} onCancel={() => dispatch({ type: 'HIDE_RESET_CONFIRM' })} />}
    </>
  );
}
