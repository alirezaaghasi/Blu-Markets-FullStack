import React, { useEffect, useMemo, useReducer, useState, useRef } from 'react';

// ====== QUESTIONNAIRE DATA ======
const questionnaire = {
  "version": "v7.3",
  "consent_exact": "متوجه ریسک این سبد دارایی شدم و باهاش موافق هستم.",
  "consent_english": "I understand the risk of this portfolio and I agree with it.",
  "questions": [
    {
      "id": "q_income",
      "text": "درآمد ماهانه‌ات چقدر قابل‌پیش‌بینیه؟",
      "english": "How predictable is your monthly income?",
      "options": [
        { "id": "inc_stable", "text": "کاملاً ثابت", "english": "Completely stable", "risk": 0 },
        { "id": "inc_some", "text": "تا حدی ثابت", "english": "Somewhat stable", "risk": 1 },
        { "id": "inc_var", "text": "متغیره (فریلنس/کسب‌وکار)", "english": "Variable (freelance/business)", "risk": 2 }
      ]
    },
    {
      "id": "q_buffer",
      "text": "بدون فروش سرمایه‌گذاری‌هات تا چند ماه می‌تونی خرج غیرمنتظره رو مدیریت کنی؟",
      "english": "How many months can you handle unexpected expenses without selling investments?",
      "options": [
        { "id": "buf_1", "text": "کمتر از ۱ ماه", "english": "Less than 1 month", "risk": 0 },
        { "id": "buf_3", "text": "۱ تا ۳ ماه", "english": "1 to 3 months", "risk": 1 },
        { "id": "buf_6", "text": "بیش از ۶ ماه", "english": "More than 6 months", "risk": 2 }
      ]
    },
    {
      "id": "q_drawdown",
      "text": "اگر ارزش سبدت ۲۰٪ افت کنه، احتمالاً چیکار می‌کنی؟",
      "english": "If your portfolio drops 20%, what would you likely do?",
      "options": [
        { "id": "dd_sell", "text": "می‌فروشم", "english": "Sell", "risk": 0 },
        { "id": "dd_hold_scared", "text": "استرس می‌گیرم ولی صبر می‌کنم", "english": "Stress but hold", "risk": 1 },
        { "id": "dd_hold_check", "text": "صبر می‌کنم و منطقی بررسی می‌کنم", "english": "Hold and evaluate rationally", "risk": 2 }
      ]
    },
    {
      "id": "q_horizon",
      "text": "افق زمانی این پول چقدره؟",
      "english": "What is your time horizon for this money?",
      "options": [
        { "id": "hz_short", "text": "کمتر از ۶ ماه", "english": "Less than 6 months", "risk": 0 },
        { "id": "hz_mid", "text": "۶ ماه تا ۲ سال", "english": "6 months to 2 years", "risk": 1 },
        { "id": "hz_long", "text": "بیش از ۳ سال", "english": "More than 3 years", "risk": 2 }
      ]
    },
    {
      "id": "q_experience",
      "text": "تجربه‌ات از دارایی‌های نوسانی چقدره؟",
      "english": "How much experience do you have with volatile assets?",
      "options": [
        { "id": "ex_none", "text": "تقریباً هیچ", "english": "Almost none", "risk": 0 },
        { "id": "ex_some", "text": "متوسط", "english": "Moderate", "risk": 1 },
        { "id": "ex_high", "text": "زیاد", "english": "Extensive", "risk": 2 }
      ]
    },
    {
      "id": "q_sleep",
      "text": "با کدوم جمله بیشتر موافقی؟",
      "english": "Which statement do you agree with more?",
      "options": [
        { "id": "sl_calm", "text": "آرامش مهم‌تر از سود بالاست", "english": "Peace of mind > high returns", "risk": 0 },
        { "id": "sl_mix", "text": "تعادل بین آرامش و رشد", "english": "Balance between calm and growth", "risk": 1 },
        { "id": "sl_up", "text": "رشد مهم‌تره حتی با نوسان", "english": "Growth > volatility concerns", "risk": 2 }
      ]
    },
    {
      "id": "q_goal",
      "text": "هدف اصلی‌ات از سرمایه‌گذاری چیه؟",
      "english": "What is your main investment goal?",
      "options": [
        { "id": "g_preserve", "text": "حفظ ارزش پول", "english": "Preserve value", "risk": 0 },
        { "id": "g_grow", "text": "رشد متعادل", "english": "Balanced growth", "risk": 1 },
        { "id": "g_moon", "text": "رشد بالاتر با ریسک بیشتر", "english": "Higher growth with more risk", "risk": 2 }
      ]
    }
  ]
};

// Layer explanations for onboarding
const LAYER_EXPLANATIONS = {
  foundation: {
    name: 'Foundation',
    nameFa: 'پایه',
    assets: ['USDT', 'Fixed Income'],
    description: 'Stable assets that preserve value. Low volatility, steady returns.',
    descriptionFa: 'دارایی‌های پایدار برای حفظ ارزش. نوسان کم، بازده ثابت.',
    color: '#4ade80',
    risk: 'Low',
  },
  growth: {
    name: 'Growth',
    nameFa: 'رشد',
    assets: ['Gold', 'BTC', 'ETH', 'QQQ'],
    description: 'Balanced assets for steady growth. Moderate volatility.',
    descriptionFa: 'دارایی‌های متعادل برای رشد پایدار. نوسان متوسط.',
    color: '#60a5fa',
    risk: 'Medium',
  },
  upside: {
    name: 'Upside',
    nameFa: 'رشد بالا',
    assets: ['SOL', 'TON'],
    description: 'High-potential assets. Higher volatility, potential for significant returns.',
    descriptionFa: 'دارایی‌های با پتانسیل بالا. نوسان زیاد، امکان بازده بالا.',
    color: '#f472b6',
    risk: 'High',
  },
};

// ====== HELPERS ======
function formatIRR(n) {
  const x = Math.round(Number(n) || 0).toString();
  return x.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' IRR';
}

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ====== ENGINE ======
const WEIGHTS = {
  foundation: { IRR_FIXED_INCOME: 0.55, USDT: 0.45 },
  growth: { GOLD: 0.20, BTC: 0.30, ETH: 0.20, QQQ: 0.30 },
  upside: { SOL: 0.55, TON: 0.45 },
};

const PREMIUM_RATES = {
  foundation: 0.01,
  growth: 0.02,
  upside: 0.03,
};

const LTV_LIMITS = {
  foundation: { max: 0.7, recommended: 0.5 },
  growth: { max: 0.6, recommended: 0.5 },
  upside: { max: 0.5, recommended: 0.4 },
};

const THRESHOLDS = {
  FOUNDATION_MIN_PCT: 40,
  UPSIDE_MAX_PCT: 25,
  MIN_AMOUNT_IRR: 1_000_000,
  DRIFT_SUGGEST_REBALANCE: 5,
  DRIFT_WARN: 10,
};

function buildPortfolio(totalIRR, layers) {
  const holdings = [];

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
  }

  const invested = holdings.reduce((s, h) => s + h.amountIRR, 0);
  return { totalIRR: invested, layers, holdings };
}

function calcLayerPercents(holdings, cashIRR) {
  const sums = { foundation: Math.max(0, cashIRR || 0), growth: 0, upside: 0 };
  for (const h of holdings || []) sums[h.layer] = (sums[h.layer] || 0) + (h.amountIRR || 0);

  const total = sums.foundation + sums.growth + sums.upside;
  const pct = {
    foundation: total ? (sums.foundation / total) * 100 : 0,
    growth: total ? (sums.growth / total) * 100 : 0,
    upside: total ? (sums.upside / total) * 100 : 0,
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

function calcBorrowCapacity(holdings, loan) {
  return (holdings || []).map(h => {
    const limits = LTV_LIMITS[h.layer] || LTV_LIMITS.growth;
    const maxLTV = limits.max;
    const recommendedLTV = limits.recommended;
    
    return {
      asset: h.asset,
      layer: h.layer,
      amountIRR: h.amountIRR,
      frozen: h.frozen,
      maxBorrow: h.frozen ? 0 : Math.floor(h.amountIRR * maxLTV),
      recommendedBorrow: h.frozen ? 0 : Math.floor(h.amountIRR * recommendedLTV),
      maxLTV,
      recommendedLTV,
    };
  });
}

// ====== INTEGRITY ENGINE ======

const BOUNDARY_STATES = {
  SAFE: 'SAFE',
  DRIFT: 'DRIFT',
  STRUCTURAL: 'STRUCTURAL',
  STRESS: 'STRESS',
};

const DRIFT_THRESHOLDS = {
  SAFE: 5,
  DRIFT: 10,
  STRUCTURAL: 20,
};

function computeDrift(currentLayers, targetLayers) {
  if (!currentLayers || !targetLayers) {
    return { foundation: 0, growth: 0, upside: 0, total: 0, max: 0 };
  }
  
  const foundation = currentLayers.foundation - targetLayers.foundation;
  const growth = currentLayers.growth - targetLayers.growth;
  const upside = currentLayers.upside - targetLayers.upside;
  
  const absFoundation = Math.abs(foundation);
  const absGrowth = Math.abs(growth);
  const absUpside = Math.abs(upside);
  
  return {
    foundation,
    growth,
    upside,
    total: absFoundation + absGrowth + absUpside,
    max: Math.max(absFoundation, absGrowth, absUpside),
  };
}

function computeBoundary(state) {
  if (!state.portfolio || !state.targetLayers) {
    return { state: BOUNDARY_STATES.SAFE, drift: null, warnings: [], constraints: [] };
  }
  
  const exposure = calcLayerPercents(state.portfolio.holdings, state.cashIRR || 0);
  const drift = computeDrift(exposure.pct, state.targetLayers);
  
  const warnings = [];
  const constraints = [];
  
  if (exposure.pct.foundation < THRESHOLDS.FOUNDATION_MIN_PCT) {
    constraints.push(`Foundation below minimum (${THRESHOLDS.FOUNDATION_MIN_PCT}%)`);
  }
  
  if (exposure.pct.upside > THRESHOLDS.UPSIDE_MAX_PCT) {
    constraints.push(`Upside exceeds maximum (${THRESHOLDS.UPSIDE_MAX_PCT}%)`);
  }
  
  const frozenAssets = (state.portfolio.holdings || []).filter(h => h.frozen);
  if (frozenAssets.length > 0 && state.loan) {
    const collateralValue = frozenAssets.reduce((s, h) => s + h.amountIRR, 0);
    if (collateralValue < state.loan.liquidationIRR * 1.1) {
      constraints.push('Collateral approaching liquidation threshold');
    }
  }
  
  let boundaryState;
  
  if (constraints.length > 0) {
    boundaryState = BOUNDARY_STATES.STRESS;
  } else if (drift.total > DRIFT_THRESHOLDS.STRUCTURAL) {
    boundaryState = BOUNDARY_STATES.STRESS;
    warnings.push(`Total drift (${drift.total.toFixed(1)}%) exceeds structural threshold`);
  } else if (drift.total > DRIFT_THRESHOLDS.DRIFT) {
    boundaryState = BOUNDARY_STATES.STRUCTURAL;
    warnings.push(`Portfolio has significant drift from target allocation`);
  } else if (drift.total > DRIFT_THRESHOLDS.SAFE) {
    boundaryState = BOUNDARY_STATES.DRIFT;
    warnings.push(`Minor drift detected - consider rebalancing`);
  } else {
    boundaryState = BOUNDARY_STATES.SAFE;
  }
  
  return {
    state: boundaryState,
    drift,
    exposure: exposure.pct,
    warnings,
    constraints,
  };
}

function calcFundingOptions(state, shortfallIRR) {
  const options = {
    shortfall: shortfallIRR,
    addFunds: { amount: shortfallIRR },
    sellOptions: [],
  };
  
  if (!state.portfolio) return options;
  
  const foundationHoldings = state.portfolio.holdings
    .filter(h => h.layer === 'foundation' && !h.frozen && h.amountIRR > 0)
    .sort((a, b) => b.amountIRR - a.amountIRR);
  
  for (const h of foundationHoldings) {
    const sellAmount = Math.min(h.amountIRR, shortfallIRR);
    
    const afterTrade = tradeAsset(state.portfolio, state.cashIRR, h.asset, 'SELL', sellAmount);
    const afterState = { ...state, portfolio: afterTrade.portfolio, cashIRR: afterTrade.cashIRR };
    const afterBoundary = computeBoundary(afterState);
    
    options.sellOptions.push({
      asset: h.asset,
      layer: h.layer,
      available: h.amountIRR,
      sellAmount,
      coversShortfall: sellAmount >= shortfallIRR,
      resultingBoundary: afterBoundary.state,
      warning: afterBoundary.state === BOUNDARY_STATES.STRESS 
        ? 'Selling this amount will put portfolio in STRESS state'
        : afterBoundary.state === BOUNDARY_STATES.STRUCTURAL
        ? 'Selling this amount will cause significant drift'
        : null,
    });
  }
  
  return options;
}

// Calculate rebalance impact for post-trade suggestion
function calcRebalanceImpact(state) {
  if (!state.portfolio || !state.targetLayers) return null;
  
  const currentExposure = calcLayerPercents(state.portfolio.holdings, state.cashIRR || 0);
  const currentDrift = computeDrift(currentExposure.pct, state.targetLayers);
  
  const total = (state.cashIRR || 0) + (state.portfolio?.totalIRR || 0);
  const afterPortfolio = rebalanceToTarget(total, state.targetLayers);
  const afterExposure = calcLayerPercents(afterPortfolio.holdings, 0);
  const afterDrift = computeDrift(afterExposure.pct, state.targetLayers);
  
  return {
    before: {
      drift: currentDrift,
      exposure: currentExposure.pct,
    },
    after: {
      drift: afterDrift,
      exposure: afterExposure.pct,
    },
    improvement: currentDrift.total - afterDrift.total,
    worthIt: currentDrift.total > THRESHOLDS.DRIFT_SUGGEST_REBALANCE,
  };
}

function validateAction(state, actionType, params = {}) {
  const result = {
    allowed: true,
    boundary: computeBoundary(state),
    warnings: [],
    errors: [],
    blockers: [],
    projectedBoundary: null,
    fundingOptions: null,
    rebalanceImpact: null,
  };
  
  if (state.user.stage !== STAGES.EXECUTED) {
    return result;
  }
  
  let projectedState = { ...state };
  
  switch (actionType) {
    case 'ADD_FUNDS': {
      const amount = Number(params.amountIRR) || 0;
      if (amount < THRESHOLDS.MIN_AMOUNT_IRR) {
        result.errors.push(`Minimum amount is ${formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}`);
        result.allowed = false;
      }
      projectedState = { ...state, cashIRR: (state.cashIRR || 0) + amount };
      break;
    }
    
    case 'TRADE': {
      const { assetId, side, amountIRR } = params;
      const amount = Number(amountIRR) || 0;
      
      if (amount < THRESHOLDS.MIN_AMOUNT_IRR) {
        result.errors.push(`Minimum amount is ${formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}`);
        result.allowed = false;
      }
      
      const holding = state.portfolio?.holdings?.find(h => h.asset === assetId);
      
      if (side === 'BUY' && amount > (state.cashIRR || 0)) {
        result.errors.push('Insufficient cash for this purchase');
        result.allowed = false;
      }
      
      if (side === 'SELL') {
        if (holding?.frozen) {
          result.blockers.push('Cannot sell frozen collateral');
          result.allowed = false;
        }
        if (holding && amount > holding.amountIRR) {
          result.warnings.push('Amount exceeds holding - will sell maximum available');
        }
      }
      
      if (result.allowed) {
        const after = tradeAsset(state.portfolio, state.cashIRR, assetId, side, amount);
        projectedState = { ...state, portfolio: after.portfolio, cashIRR: after.cashIRR };
        
        // Calculate rebalance impact for post-trade suggestion
        result.rebalanceImpact = calcRebalanceImpact(projectedState);
      }
      break;
    }
    
    case 'REBALANCE': {
      const total = (state.cashIRR || 0) + (state.portfolio?.totalIRR || 0);
      const afterPortfolio = rebalanceToTarget(total, state.targetLayers);
      
      const frozenAssets = state.portfolio?.holdings?.filter(h => h.frozen) || [];
      if (frozenAssets.length > 0) {
        result.warnings.push('Rebalance will not affect frozen collateral assets');
      }
      
      projectedState = { ...state, portfolio: afterPortfolio, cashIRR: 0 };
      break;
    }
    
    case 'PROTECT': {
      const { assetId, months } = params;
      const holding = state.portfolio?.holdings?.find(h => h.asset === assetId);
      
      if (!holding) {
        result.errors.push('Asset not found in portfolio');
        result.allowed = false;
        break;
      }
      
      const rate = PREMIUM_RATES[holding.layer] || 0.02;
      const premium = Math.floor(holding.amountIRR * rate * (months / 3));
      
      const existing = (state.protections || []).find(p => p.assetId === assetId);
      if (existing) {
        result.blockers.push(`Asset already protected until ${existing.protectedUntil}`);
        result.allowed = false;
        break;
      }
      
      if (premium > (state.cashIRR || 0)) {
        const shortfall = premium - (state.cashIRR || 0);
        result.errors.push(`Insufficient cash for premium (need ${formatIRR(shortfall)} more)`);
        result.allowed = false;
        result.fundingOptions = calcFundingOptions(state, shortfall);
        result.fundingOptions.premium = premium;
      }
      
      if (result.allowed) {
        projectedState = { ...state, cashIRR: (state.cashIRR || 0) - premium };
      }
      break;
    }
    
    case 'BORROW': {
      const { assetId, ltv, amountIRR } = params;
      const amount = Number(amountIRR) || 0;
      const holding = state.portfolio?.holdings?.find(h => h.asset === assetId);
      
      if (!holding) {
        result.errors.push('Asset not found in portfolio');
        result.allowed = false;
        break;
      }
      
      if (holding.frozen) {
        result.blockers.push('Asset already used as collateral');
        result.allowed = false;
        break;
      }
      
      if (state.loan) {
        result.blockers.push('Active loan exists - repay first');
        result.allowed = false;
        break;
      }
      
      const limits = LTV_LIMITS[holding.layer] || LTV_LIMITS.growth;
      if (ltv > limits.max) {
        result.blockers.push(`Maximum LTV for ${holding.layer} assets is ${Math.round(limits.max * 100)}%`);
        result.allowed = false;
      }
      
      if (ltv > limits.recommended) {
        result.warnings.push(`LTV exceeds recommended ${Math.round(limits.recommended * 100)}% for ${holding.layer} assets`);
      }
      
      const maxBorrow = Math.floor(holding.amountIRR * ltv);
      if (amount > maxBorrow) {
        result.errors.push(`Amount exceeds maximum borrow (${formatIRR(maxBorrow)})`);
        result.allowed = false;
      }
      
      if (amount < THRESHOLDS.MIN_AMOUNT_IRR) {
        result.errors.push(`Minimum borrow is ${formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}`);
        result.allowed = false;
      }
      
      if (result.allowed) {
        const afterCash = (state.cashIRR || 0) + amount;
        
        const holdings = state.portfolio.holdings.map(h => ({ ...h }));
        const collateral = holdings.find(x => x.asset === assetId);
        if (collateral) collateral.frozen = true;
        
        const simulatedExposure = calcLayerPercents(holdings, afterCash);
        
        if (simulatedExposure.pct.foundation < THRESHOLDS.FOUNDATION_MIN_PCT) {
          result.blockers.push(`Borrowing would reduce Foundation below ${THRESHOLDS.FOUNDATION_MIN_PCT}%`);
          result.allowed = false;
        }
        
        if (holding.layer === 'upside' && ltv >= 0.5) {
          result.warnings.push('High LTV on Upside collateral increases liquidation risk significantly');
        }
        
        if (result.allowed) {
          projectedState = { ...state, cashIRR: afterCash };
        }
      }
      break;
    }
  }
  
  if (result.allowed) {
    result.projectedBoundary = computeBoundary(projectedState);
    
    if (result.projectedBoundary.state === BOUNDARY_STATES.STRESS) {
      result.warnings.push('This action will put portfolio in STRESS state');
    } else if (result.projectedBoundary.state === BOUNDARY_STATES.STRUCTURAL && 
               result.boundary.state !== BOUNDARY_STATES.STRUCTURAL) {
      result.warnings.push('This action will cause significant portfolio drift');
    }
    
    result.warnings = [...result.warnings, ...result.projectedBoundary.warnings];
  }
  
  if (result.blockers.length > 0) {
    result.allowed = false;
  }
  
  return result;
}

function createLedgerEntry(actionType, params, stateBefore, stateAfter) {
  const boundaryBefore = computeBoundary(stateBefore);
  const boundaryAfter = computeBoundary(stateAfter);
  
  const exposureBefore = stateBefore.portfolio 
    ? calcLayerPercents(stateBefore.portfolio.holdings, stateBefore.cashIRR || 0)
    : null;
  const exposureAfter = stateAfter.portfolio
    ? calcLayerPercents(stateAfter.portfolio.holdings, stateAfter.cashIRR || 0)
    : null;
  
  const driftBefore = boundaryBefore.drift;
  const driftAfter = boundaryAfter.drift;
  
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    actionType,
    params,
    boundary: {
      before: boundaryBefore.state,
      after: boundaryAfter.state,
    },
    drift: {
      before: driftBefore?.total || 0,
      after: driftAfter?.total || 0,
    },
    snapshot: {
      before: exposureBefore ? {
        totalIRR: exposureBefore.totalIRR,
        cashIRR: stateBefore.cashIRR || 0,
        layers: exposureBefore.pct,
      } : null,
      after: exposureAfter ? {
        totalIRR: exposureAfter.totalIRR,
        cashIRR: stateAfter.cashIRR || 0,
        layers: exposureAfter.pct,
      } : null,
    },
  };
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
  PROTECT_FUNDING: 'PROTECT_FUNDING',
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
    validation: null,
    fundingOptions: null,
    lastAction: null,
    rebalanceSuggestion: null, // NEW: Post-trade rebalance suggestion
    showTranslations: true, // NEW: Toggle for English translations
    messages: [{ from: 'system', text: 'Enter your phone number.' }],
    ledger: [],
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

function getRiskProfile(answers) {
  let risk = 0;
  for (const q of questionnaire.questions) {
    const optId = answers[q.id];
    const opt = q.options.find(o => o.id === optId);
    risk += (opt?.risk ?? 0);
  }
  if (risk <= 4) return { level: 'Conservative', levelFa: 'محافظه‌کار', score: risk };
  if (risk <= 9) return { level: 'Moderate', levelFa: 'متعادل', score: risk };
  return { level: 'Growth-Oriented', levelFa: 'رشد‌محور', score: risk };
}

function exposureSnapshot(portfolio, cashIRR) {
  const { pct, totalIRR } = calcLayerPercents(portfolio?.holdings || [], cashIRR || 0);
  return { totalIRR, layers: pct };
}

function buildPreview(beforePortfolio, beforeCash, afterPortfolio, afterCash, targetLayers) {
  const before = exposureSnapshot(beforePortfolio, beforeCash);
  const after = exposureSnapshot(afterPortfolio, afterCash);
  
  const beforeDrift = targetLayers ? computeDrift(before.layers, targetLayers) : null;
  const afterDrift = targetLayers ? computeDrift(after.layers, targetLayers) : null;
  
  const deltas = {
    totalIRR: after.totalIRR - before.totalIRR,
    layers: {
      foundation: after.layers.foundation - before.layers.foundation,
      growth: after.layers.growth - before.layers.growth,
      upside: after.layers.upside - before.layers.upside,
    },
  };
  
  return { 
    before, 
    after, 
    deltas, 
    beforeDrift, 
    afterDrift,
    driftChange: afterDrift && beforeDrift ? afterDrift.total - beforeDrift.total : 0,
  };
}

function requireExecuted(state) {
  return state.user.stage === STAGES.EXECUTED && state.portfolio;
}

function reduce(state, event) {
  switch (event.type) {
    case 'RESET':
      return initialState();

    case 'SET_TAB': {
      return { ...state, tab: event.tab };
    }

    case 'TOGGLE_TRANSLATIONS': {
      return { ...state, showTranslations: !state.showTranslations };
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
        const riskProfile = getRiskProfile(answers);
        s = { ...s, targetLayers, riskProfile, user: { ...s.user, stage: STAGES.ALLOCATION_PROPOSED } };
        s = addMessage(s, 'system', `Risk Profile: ${riskProfile.level} (${riskProfile.levelFa})`);
        s = addMessage(s, 'system', `Target: Foundation ${targetLayers.foundation}% · Growth ${targetLayers.growth}% · Upside ${targetLayers.upside}%`);
      }
      return s;
    }

    case 'SUBMIT_CONSENT': {
      if (state.user.stage !== STAGES.ALLOCATION_PROPOSED) return state;
      const text = String(event.text || '');
      let s = addMessage(state, 'user', text);

      if (text !== CONSENT_EXACT) {
        s = addMessage(s, 'system', 'Consent sentence must match exactly.');
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
      if (n < THRESHOLDS.MIN_AMOUNT_IRR) {
        return addMessage(state, 'system', `Minimum is ${formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}.`);
      }

      const portfolio = buildPortfolio(n, state.targetLayers);
      let s = addMessage(state, 'system', 'Portfolio created successfully.');
      s = { ...s, portfolio, cashIRR: 0, user: { ...s.user, stage: STAGES.EXECUTED } };
      
      const entry = createLedgerEntry('PORTFOLIO_CREATED', { amountIRR: n }, state, s);
      s = { 
        ...s, 
        ledger: [entry],
        lastAction: {
          type: 'PORTFOLIO_CREATED',
          summary: `Invested ${formatIRR(n)}`,
          timestamp: Date.now(),
        }
      };
      
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
        validation: null,
        fundingOptions: null,
        rebalanceSuggestion: null,
      };
    }

    case 'DISMISS_LAST_ACTION': {
      return { ...state, lastAction: null };
    }

    case 'DISMISS_REBALANCE_SUGGESTION': {
      return { ...state, rebalanceSuggestion: null };
    }

    // ===== ADD FUNDS =====
    case 'START_ADD_FUNDS': {
      if (!requireExecuted(state)) return state;
      let s = addMessage(state, 'user', 'Add funds');
      s = { ...s, postAction: POST_ACTIONS.ADD_FUNDS, pendingAmountIRR: event.prefillAmount || null, preview: null, softWarning: null, validation: null, lastAction: null, rebalanceSuggestion: null };
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
      
      const validation = validateAction(state, 'ADD_FUNDS', { amountIRR: n });
      
      if (!validation.allowed) {
        let s = state;
        for (const err of [...validation.blockers, ...validation.errors]) {
          s = addMessage(s, 'system', err);
        }
        return { ...s, validation };
      }

      const afterCash = (state.cashIRR || 0) + Math.floor(n);
      const preview = buildPreview(state.portfolio, state.cashIRR, state.portfolio, afterCash, state.targetLayers);

      let s = { ...state, preview, validation, postAction: POST_ACTIONS.ADD_FUNDS_PREVIEW };
      s = addMessage(s, 'system', 'Preview ready. Confirm to add to cash.');
      return s;
    }

    case 'CONFIRM_ADD_FUNDS_FINAL': {
      if (!requireExecuted(state)) return state;
      const n = Number(state.pendingAmountIRR);
      
      const validation = validateAction(state, 'ADD_FUNDS', { amountIRR: n });
      if (!validation.allowed) {
        return addMessage(state, 'system', validation.errors[0] || validation.blockers[0] || 'Action not allowed');
      }

      const delta = Math.floor(n);
      const stateBefore = state;
      let s = { ...state, cashIRR: (state.cashIRR || 0) + delta, postAction: POST_ACTIONS.NONE, pendingAmountIRR: null, preview: null, softWarning: null, validation: null };
      
      const entry = createLedgerEntry('ADD_FUNDS', { amountIRR: delta }, stateBefore, s);
      
      // Check if rebalance would help
      const rebalanceImpact = calcRebalanceImpact(s);
      
      s = { 
        ...s, 
        ledger: [...state.ledger, entry],
        lastAction: {
          type: 'ADD_FUNDS',
          summary: `Added ${formatIRR(delta)} to cash`,
          details: { amount: delta, newCash: s.cashIRR },
          boundary: entry.boundary,
          timestamp: Date.now(),
        },
        rebalanceSuggestion: rebalanceImpact?.worthIt ? rebalanceImpact : null,
      };
      
      return s;
    }

    // ===== TRADE =====
    case 'START_TRADE': {
      if (!requireExecuted(state)) return state;
      const assetId = String(event.assetId || '');
      const side = event.side === 'SELL' ? 'SELL' : 'BUY';
      let s = addMessage(state, 'user', side === 'BUY' ? `Buy ${assetId}` : `Sell ${assetId}`);
      s = { ...s, postAction: POST_ACTIONS.TRADE, tradeDraft: { assetId, side, amountIRR: null }, preview: null, softWarning: null, validation: null, lastAction: null, rebalanceSuggestion: null };
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

      const validation = validateAction(state, 'TRADE', {
        assetId: d.assetId,
        side: d.side,
        amountIRR: Number(d.amountIRR),
      });
      
      if (!validation.allowed) {
        let s = state;
        for (const err of [...validation.blockers, ...validation.errors]) {
          s = addMessage(s, 'system', err);
        }
        return { ...s, validation };
      }

      const after = tradeAsset(state.portfolio, state.cashIRR, d.assetId, d.side, Math.floor(Number(d.amountIRR)));
      const preview = buildPreview(state.portfolio, state.cashIRR, after.portfolio, after.cashIRR, state.targetLayers);

      let s = { ...state, preview, validation, postAction: POST_ACTIONS.TRADE_PREVIEW };
      
      // Add drift change warning
      if (preview.driftChange > 0) {
        const msg = `This trade will increase portfolio drift by ${preview.driftChange.toFixed(1)}%`;
        s = { ...s, softWarning: msg };
      }
      
      if (validation.warnings.length > 0) {
        s = { ...s, softWarning: (s.softWarning ? s.softWarning + ' ' : '') + validation.warnings.join(' ') };
      }
      
      s = addMessage(s, 'system', 'Preview ready. Confirm to execute.');
      return s;
    }

    case 'CONFIRM_TRADE_FINAL': {
      if (!requireExecuted(state)) return state;
      const d = state.tradeDraft;
      if (!d) return state;

      const validation = validateAction(state, 'TRADE', {
        assetId: d.assetId,
        side: d.side,
        amountIRR: Number(d.amountIRR),
      });
      
      if (!validation.allowed) {
        return addMessage(state, 'system', validation.errors[0] || validation.blockers[0] || 'Action not allowed');
      }

      const stateBefore = state;
      const after = tradeAsset(state.portfolio, state.cashIRR, d.assetId, d.side, Math.floor(Number(d.amountIRR)));
      let s = { ...state, portfolio: after.portfolio, cashIRR: after.cashIRR, postAction: POST_ACTIONS.NONE, tradeDraft: null, preview: null, softWarning: null, validation: null };
      
      const entry = createLedgerEntry('TRADE', { assetId: d.assetId, side: d.side, amountIRR: Number(d.amountIRR) }, stateBefore, s);
      
      // Calculate rebalance suggestion
      const rebalanceImpact = calcRebalanceImpact(s);
      
      s = { 
        ...s, 
        ledger: [...state.ledger, entry],
        lastAction: {
          type: 'TRADE',
          summary: `${d.side === 'BUY' ? 'Bought' : 'Sold'} ${formatIRR(Number(d.amountIRR))} of ${d.assetId}`,
          details: { asset: d.assetId, side: d.side, amount: Number(d.amountIRR) },
          boundary: entry.boundary,
          timestamp: Date.now(),
        },
        rebalanceSuggestion: rebalanceImpact?.worthIt ? rebalanceImpact : null,
      };
      
      return s;
    }

    // ===== REBALANCE =====
    case 'START_REBALANCE': {
      if (!requireExecuted(state)) return state;
      let s = addMessage(state, 'user', 'Rebalance');
      
      const validation = validateAction(state, 'REBALANCE', {});
      s = { ...s, postAction: POST_ACTIONS.REBALANCE, preview: null, softWarning: null, validation, lastAction: null, rebalanceSuggestion: null };
      s = addMessage(s, 'system', 'Preview rebalance to restore your target allocation?');
      return s;
    }

    case 'PREVIEW_REBALANCE': {
      if (!requireExecuted(state)) return state;
      const total = (state.cashIRR || 0) + (state.portfolio?.totalIRR || 0);
      const afterPortfolio = rebalanceToTarget(total, state.targetLayers);
      const preview = buildPreview(state.portfolio, state.cashIRR, afterPortfolio, 0, state.targetLayers);
      
      const validation = validateAction(state, 'REBALANCE', {});

      let s = { ...state, preview, validation, postAction: POST_ACTIONS.REBALANCE_PREVIEW };
      
      if (validation.warnings.length > 0) {
        s = { ...s, softWarning: validation.warnings.join(' ') };
      }
      
      s = addMessage(s, 'system', `Rebalance will restore target allocation. Drift: ${preview.beforeDrift?.total.toFixed(1)}% → ${preview.afterDrift?.total.toFixed(1)}%`);
      return s;
    }

    case 'CONFIRM_REBALANCE_FINAL': {
      if (!requireExecuted(state)) return state;
      const stateBefore = state;
      const total = (state.cashIRR || 0) + (state.portfolio?.totalIRR || 0);
      const nextPortfolio = rebalanceToTarget(total, state.targetLayers);
      let s = { ...state, portfolio: nextPortfolio, cashIRR: 0, postAction: POST_ACTIONS.NONE, preview: null, softWarning: null, validation: null, rebalanceSuggestion: null };
      
      const entry = createLedgerEntry('REBALANCE', { totalIRR: total }, stateBefore, s);
      s = { 
        ...s, 
        ledger: [...state.ledger, entry],
        lastAction: {
          type: 'REBALANCE',
          summary: `Rebalanced to target allocation`,
          details: { total },
          boundary: entry.boundary,
          timestamp: Date.now(),
        }
      };
      
      return s;
    }

    // ===== PROTECT =====
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

      s = { ...s, postAction: POST_ACTIONS.PROTECT, protectDraft: { assetId: preferred, months: 3 }, preview: null, softWarning: null, protectError: null, validation: null, fundingOptions: null, lastAction: null, rebalanceSuggestion: null };
      s = addMessage(s, 'system', 'Select an asset and protection duration (1–6 months).');
      return s;
    }

    case 'SET_PROTECT_ASSET': {
      if (!requireExecuted(state)) return state;
      if (!state.protectDraft) return state;
      return { ...state, protectDraft: { ...state.protectDraft, assetId: event.assetId }, protectError: null, fundingOptions: null };
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
      
      const rate = PREMIUM_RATES[h.layer] || 0.02;
      const premium = Math.floor(h.amountIRR * rate * (months / 3));
      
      const validation = validateAction(state, 'PROTECT', { assetId: d.assetId, months });
      
      if (!validation.allowed && validation.fundingOptions) {
        let s = { 
          ...state, 
          postAction: POST_ACTIONS.PROTECT_FUNDING,
          validation,
          fundingOptions: validation.fundingOptions,
          protectError: {
            premium,
            shortfall: validation.fundingOptions.shortfall,
            cashIRR: state.cashIRR || 0,
          }
        };
        s = addMessage(s, 'system', `Insufficient cash for premium. You need ${formatIRR(validation.fundingOptions.shortfall)} more.`);
        return s;
      }
      
      if (!validation.allowed) {
        let s = state;
        for (const err of [...validation.blockers, ...validation.errors]) {
          s = addMessage(s, 'system', err);
        }
        return { ...s, validation };
      }

      const before = exposureSnapshot(state.portfolio, state.cashIRR);
      const after = exposureSnapshot(state.portfolio, (state.cashIRR || 0) - premium);
      const preview = { before, after, deltas: { totalIRR: after.totalIRR - before.totalIRR, layers: { foundation: after.layers.foundation - before.layers.foundation, growth: after.layers.growth - before.layers.growth, upside: after.layers.upside - before.layers.upside } } };

      let s = { ...state, preview, validation, postAction: POST_ACTIONS.PROTECT_PREVIEW };
      s = addMessage(s, 'system', `Premium: ${formatIRR(premium)} (${(rate * 100).toFixed(0)}% rate for ${h.layer}). Confirm to activate.`);
      return s;
    }

    case 'CONFIRM_PROTECT_FINAL': {
      if (!requireExecuted(state)) return state;
      const d = state.protectDraft;
      if (!d) return state;

      const months = Math.min(6, Math.max(1, Math.floor(Number(d.months) || 0)));
      const h = state.portfolio.holdings.find(x => x.asset === d.assetId);
      if (!h) return addMessage(state, 'system', 'Asset not found.');
      
      const rate = PREMIUM_RATES[h.layer] || 0.02;
      const premium = Math.floor(h.amountIRR * rate * (months / 3));
      
      if ((state.cashIRR || 0) < premium) {
        return addMessage(state, 'system', 'Insufficient cash for premium.');
      }

      const until = new Date();
      until.setMonth(until.getMonth() + months);
      const protectedUntil = until.toISOString().slice(0, 10);

      const stateBefore = state;
      let s = { ...state, cashIRR: (state.cashIRR || 0) - premium, protections: [...state.protections, { assetId: d.assetId, protectedUntil, premiumIRR: premium, layer: h.layer }], postAction: POST_ACTIONS.NONE, protectDraft: null, preview: null, softWarning: null, validation: null, fundingOptions: null };
      
      const entry = createLedgerEntry('PROTECT', { assetId: d.assetId, months, premiumIRR: premium, layer: h.layer }, stateBefore, s);
      s = { 
        ...s, 
        ledger: [...state.ledger, entry],
        lastAction: {
          type: 'PROTECT',
          summary: `Protected ${d.assetId} for ${months} months`,
          details: { asset: d.assetId, months, premium, until: protectedUntil },
          boundary: entry.boundary,
          timestamp: Date.now(),
        }
      };
      
      return s;
    }

    case 'QUICK_SELL_FOR_FUNDING': {
      if (!requireExecuted(state)) return state;
      const { assetId, amount, returnTo } = event;
      
      const validation = validateAction(state, 'TRADE', {
        assetId,
        side: 'SELL',
        amountIRR: amount,
      });
      
      if (!validation.allowed) {
        return addMessage(state, 'system', validation.errors[0] || validation.blockers[0] || 'Cannot execute sell');
      }
      
      const stateBefore = state;
      const after = tradeAsset(state.portfolio, state.cashIRR, assetId, 'SELL', amount);
      let s = { ...state, portfolio: after.portfolio, cashIRR: after.cashIRR };
      
      const entry = createLedgerEntry('TRADE', { assetId, side: 'SELL', amountIRR: amount, reason: 'funding_protection' }, stateBefore, s);
      s = { ...s, ledger: [...state.ledger, entry] };
      
      if (returnTo === 'PROTECT') {
        s = { ...s, postAction: POST_ACTIONS.PROTECT, fundingOptions: null, protectError: null };
        s = addMessage(s, 'system', `Sold ${formatIRR(amount)} of ${assetId}. Cash available: ${formatIRR(s.cashIRR)}. Continue with protection.`);
      } else {
        s = { ...s, postAction: POST_ACTIONS.NONE };
        s = addMessage(s, 'system', `Sold ${formatIRR(amount)} of ${assetId}.`);
      }
      
      return s;
    }

    // ===== BORROW =====
    case 'START_BORROW': {
      if (!requireExecuted(state)) return state;

      if (state.loan) {
        let s = addMessage(state, 'user', 'Borrow');
        s = addMessage(s, 'system', 'You already have an active loan. Repay it before taking a new one.');
        return s;
      }

      const availableCollateral = state.portfolio.holdings
        .filter(h => !h.frozen && h.amountIRR > 0)
        .sort((a, b) => {
          const order = { foundation: 0, growth: 1, upside: 2 };
          return (order[a.layer] || 1) - (order[b.layer] || 1);
        });
      
      const preferred = event?.assetId || availableCollateral[0]?.asset;
      if (!preferred) return addMessage(state, 'system', 'No assets available for collateral.');

      let s = addMessage(state, 'user', 'Borrow');
      s = { ...s, postAction: POST_ACTIONS.BORROW, borrowDraft: { assetId: preferred, ltv: 0.5, amountIRR: null }, preview: null, softWarning: null, validation: null, lastAction: null, rebalanceSuggestion: null };
      s = addMessage(s, 'system', 'Select collateral asset, LTV, and loan amount.');
      return s;
    }

    case 'SET_BORROW_ASSET': {
      if (!requireExecuted(state)) return state;
      if (!state.borrowDraft) return state;
      
      const holding = state.portfolio?.holdings?.find(h => h.asset === event.assetId);
      const limits = holding ? (LTV_LIMITS[holding.layer] || LTV_LIMITS.growth) : LTV_LIMITS.growth;
      
      return { ...state, borrowDraft: { ...state.borrowDraft, assetId: event.assetId, ltv: limits.recommended } };
    }

    case 'SET_BORROW_LTV': {
      if (!requireExecuted(state)) return state;
      if (!state.borrowDraft) return state;
      const ltv = Math.min(0.7, Math.max(0.3, Number(event.ltv) || 0.5));
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
      
      const validation = validateAction(state, 'BORROW', {
        assetId: d.assetId,
        ltv: d.ltv,
        amountIRR: n,
      });
      
      if (!validation.allowed) {
        let s = state;
        for (const err of [...validation.blockers, ...validation.errors]) {
          s = addMessage(s, 'system', err);
        }
        return { ...s, validation };
      }

      const h = state.portfolio.holdings.find(x => x.asset === d.assetId);
      const maxBorrow = Math.floor(h.amountIRR * d.ltv);
      const req = Math.min(Math.floor(n), maxBorrow);
      const liquidationIRR = Math.floor(req / d.ltv);
      
      const before = exposureSnapshot(state.portfolio, state.cashIRR);
      const after = exposureSnapshot(state.portfolio, (state.cashIRR || 0) + req);
      const preview = { before, after, deltas: { totalIRR: after.totalIRR - before.totalIRR, layers: { foundation: after.layers.foundation - before.layers.foundation, growth: after.layers.growth - before.layers.growth, upside: after.layers.upside - before.layers.upside } } };

      let s = { ...state, preview, validation, postAction: POST_ACTIONS.BORROW_PREVIEW };
      
      if (validation.warnings.length > 0) {
        s = { ...s, softWarning: validation.warnings.join(' ') };
      }
      
      s = addMessage(s, 'system', `Borrow ${formatIRR(req)} against ${h.asset}. Liquidation at ${formatIRR(liquidationIRR)}.`);
      return s;
    }

    case 'CONFIRM_BORROW_FINAL': {
      if (!requireExecuted(state)) return state;
      const d = state.borrowDraft;
      if (!d) return state;

      const validation = validateAction(state, 'BORROW', {
        assetId: d.assetId,
        ltv: d.ltv,
        amountIRR: Number(d.amountIRR),
      });
      
      if (!validation.allowed) {
        return addMessage(state, 'system', validation.errors[0] || validation.blockers[0] || 'Action not allowed');
      }

      const n = Number(d.amountIRR);
      const holdings = state.portfolio.holdings.map(h => ({ ...h }));
      const h = holdings.find(x => x.asset === d.assetId);
      
      const maxBorrow = Math.floor(h.amountIRR * d.ltv);
      const req = Math.min(Math.floor(n), maxBorrow);

      h.frozen = true;
      const liquidationIRR = Math.floor(req / d.ltv);

      const invested = holdings.reduce((s, x) => s + x.amountIRR, 0);
      const nextPortfolio = { ...state.portfolio, holdings, totalIRR: invested };

      const stateBefore = state;
      let s = { ...state, portfolio: nextPortfolio, cashIRR: (state.cashIRR || 0) + req, loan: { collateralAssetId: d.assetId, amountIRR: req, ltv: d.ltv, liquidationIRR }, postAction: POST_ACTIONS.NONE, borrowDraft: null, preview: null, softWarning: null, validation: null };
      
      const entry = createLedgerEntry('BORROW', { assetId: d.assetId, ltv: d.ltv, amountIRR: req, liquidationIRR }, stateBefore, s);
      s = { 
        ...s, 
        ledger: [...state.ledger, entry],
        lastAction: {
          type: 'BORROW',
          summary: `Borrowed ${formatIRR(req)} against ${d.assetId}`,
          details: { asset: d.assetId, amount: req, ltv: d.ltv, liquidation: liquidationIRR },
          boundary: entry.boundary,
          timestamp: Date.now(),
        }
      };
      
      return s;
    }

    default:
      return state;
  }
}

// ====== COMPONENTS ======

function MessagesPane({ messages }) {
  const endRef = useRef(null);
  
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  return (
    <div>
      {messages.map((m, i) => (
        <div key={i} className={'msg ' + (m.from === 'user' ? 'user' : '')}>
          <div className="meta">{m.from}</div>
          <div>{m.text}</div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

function Tabs({ tab, dispatch }) {
  const tabs = [
    { id: 'PORTFOLIO', label: 'Portfolio' },
    { id: 'PROTECTION', label: 'Protection' },
    { id: 'LOANS', label: 'Loans' },
    { id: 'HISTORY', label: 'History' },
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

function BoundaryBadge({ boundary }) {
  const colors = {
    [BOUNDARY_STATES.SAFE]: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)', text: '#4ade80' },
    [BOUNDARY_STATES.DRIFT]: { bg: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.4)', text: '#fde047' },
    [BOUNDARY_STATES.STRUCTURAL]: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.4)', text: '#fb923c' },
    [BOUNDARY_STATES.STRESS]: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: '#f87171' },
  };
  
  const style = colors[boundary.state] || colors[BOUNDARY_STATES.SAFE];
  
  return (
    <div className="boundaryBadge" style={{ background: style.bg, borderColor: style.border }}>
      <span style={{ color: style.text, fontWeight: 900 }}>{boundary.state}</span>
      {boundary.drift && (
        <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 11 }}>
          {boundary.drift.total.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

// NEW: Rebalance Suggestion Card
function RebalanceSuggestion({ suggestion, onRebalance, onDismiss }) {
  if (!suggestion || !suggestion.worthIt) return null;
  
  return (
    <div className="rebalanceSuggestion">
      <div className="suggestionHeader">
        <span className="suggestionIcon">⟲</span>
        <span className="suggestionTitle">Rebalance Recommended</span>
        <button className="suggestionDismiss" onClick={onDismiss}>×</button>
      </div>
      <div className="suggestionDetails">
        <div className="suggestionRow">
          <span>Current drift:</span>
          <span className="driftValue high">{suggestion.before.drift.total.toFixed(1)}%</span>
        </div>
        <div className="suggestionRow">
          <span>After rebalance:</span>
          <span className="driftValue low">{suggestion.after.drift.total.toFixed(1)}%</span>
        </div>
      </div>
      <button className="btn primary small" onClick={onRebalance}>
        Rebalance Now
      </button>
    </div>
  );
}

function ExecutionSummary({ lastAction, onDismiss }) {
  if (!lastAction) return null;
  
  const icons = {
    'PORTFOLIO_CREATED': '✓',
    'ADD_FUNDS': '+',
    'TRADE': '↔',
    'REBALANCE': '⟲',
    'PROTECT': '🛡',
    'BORROW': '💰',
  };
  
  return (
    <div className="executionSummary">
      <div className="summaryHeader">
        <span className="summaryIcon">{icons[lastAction.type] || '•'}</span>
        <span className="summaryTitle">{lastAction.summary}</span>
        <button className="summaryDismiss" onClick={onDismiss}>×</button>
      </div>
      {lastAction.boundary && (
        <div className="summaryBoundary">
          <span className={`boundaryPill small ${lastAction.boundary.before.toLowerCase()}`}>
            {lastAction.boundary.before}
          </span>
          <span className="boundaryArrow">→</span>
          <span className={`boundaryPill small ${lastAction.boundary.after.toLowerCase()}`}>
            {lastAction.boundary.after}
          </span>
        </div>
      )}
    </div>
  );
}

function HistoryPane({ ledger }) {
  const [expanded, setExpanded] = useState({});
  
  if (!ledger || ledger.length === 0) {
    return (
      <div className="card">
        <h3>Action History</h3>
        <div className="muted">No actions recorded yet.</div>
      </div>
    );
  }
  
  const actionLabels = {
    'PORTFOLIO_CREATED': 'Portfolio Created',
    'ADD_FUNDS': 'Add Funds',
    'TRADE': 'Trade',
    'REBALANCE': 'Rebalance',
    'PROTECT': 'Protection',
    'BORROW': 'Borrow',
  };
  
  const actionIcons = {
    'PORTFOLIO_CREATED': '✓',
    'ADD_FUNDS': '+',
    'TRADE': '↔',
    'REBALANCE': '⟲',
    'PROTECT': '🛡',
    'BORROW': '💰',
  };
  
  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  return (
    <div className="card">
      <h3>Action History</h3>
      <div className="muted" style={{ marginBottom: 12 }}>
        {ledger.length} actions recorded
      </div>
      <div className="ledgerList">
        {[...ledger].reverse().map((entry) => (
          <div key={entry.id} className="ledgerEntry">
            <div className="ledgerHeader" onClick={() => toggleExpand(entry.id)} style={{ cursor: 'pointer' }}>
              <span className="ledgerIcon">{actionIcons[entry.actionType] || '•'}</span>
              <span className="ledgerAction">{actionLabels[entry.actionType] || entry.actionType}</span>
              <span className="ledgerTime">{formatTimestamp(entry.timestamp)}</span>
              <span className="ledgerExpand">{expanded[entry.id] ? '−' : '+'}</span>
            </div>
            
            <div className="ledgerBoundary">
              <span className={`boundaryPill small ${entry.boundary.before.toLowerCase()}`}>
                {entry.boundary.before}
              </span>
              <span className="boundaryArrow">→</span>
              <span className={`boundaryPill small ${entry.boundary.after.toLowerCase()}`}>
                {entry.boundary.after}
              </span>
              {entry.drift && (
                <span className="driftBadge">
                  Drift: {entry.drift.before.toFixed(1)}% → {entry.drift.after.toFixed(1)}%
                </span>
              )}
            </div>
            
            {expanded[entry.id] && (
              <div className="ledgerDetails">
                {entry.snapshot.before && entry.snapshot.after && (
                  <div className="ledgerSnapshot">
                    <div className="snapshotColumn">
                      <div className="snapshotLabel">Before</div>
                      <div className="snapshotValue">{formatIRR(entry.snapshot.before.totalIRR)}</div>
                      <div className="snapshotLayers">
                        F:{Math.round(entry.snapshot.before.layers.foundation)}% 
                        G:{Math.round(entry.snapshot.before.layers.growth)}% 
                        U:{Math.round(entry.snapshot.before.layers.upside)}%
                      </div>
                      <div className="snapshotCash">Cash: {formatIRR(entry.snapshot.before.cashIRR)}</div>
                    </div>
                    <div className="snapshotColumn">
                      <div className="snapshotLabel">After</div>
                      <div className="snapshotValue">{formatIRR(entry.snapshot.after.totalIRR)}</div>
                      <div className="snapshotLayers">
                        F:{Math.round(entry.snapshot.after.layers.foundation)}% 
                        G:{Math.round(entry.snapshot.after.layers.growth)}% 
                        U:{Math.round(entry.snapshot.after.layers.upside)}%
                      </div>
                      <div className="snapshotCash">Cash: {formatIRR(entry.snapshot.after.cashIRR)}</div>
                    </div>
                  </div>
                )}
                
                {entry.params && Object.keys(entry.params).length > 0 && (
                  <div className="ledgerParams">
                    {entry.params.amountIRR && <span>Amount: {formatIRR(entry.params.amountIRR)}</span>}
                    {entry.params.assetId && <span>Asset: {entry.params.assetId}</span>}
                    {entry.params.side && <span>Side: {entry.params.side}</span>}
                    {entry.params.ltv && <span>LTV: {Math.round(entry.params.ltv * 100)}%</span>}
                    {entry.params.months && <span>Duration: {entry.params.months} months</span>}
                    {entry.params.premiumIRR && <span>Premium: {formatIRR(entry.params.premiumIRR)}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FundingOptionsPanel({ fundingOptions, protectDraft, dispatch }) {
  if (!fundingOptions) return null;
  
  return (
    <div className="fundingPanel">
      <div className="fundingHeader">
        <span className="fundingIcon">⚠</span>
        <span>Insufficient Cash</span>
      </div>
      
      <div className="fundingDetails">
        <div className="fundingRow">
          <span>Premium required:</span>
          <span className="fundingValue">{formatIRR(fundingOptions.premium)}</span>
        </div>
        <div className="fundingRow">
          <span>Current cash:</span>
          <span className="fundingValue">{formatIRR((fundingOptions.premium || 0) - fundingOptions.shortfall)}</span>
        </div>
        <div className="fundingRow highlight">
          <span>Shortfall:</span>
          <span className="fundingValue">{formatIRR(fundingOptions.shortfall)}</span>
        </div>
      </div>
      
      <div className="fundingOptions">
        <div className="fundingOption">
          <div className="optionTitle">Option 1: Add Funds</div>
          <div className="optionDesc">Deposit {formatIRR(fundingOptions.shortfall)} to cover premium</div>
          <button 
            className="btn primary small"
            onClick={() => dispatch({ type: 'START_ADD_FUNDS', prefillAmount: fundingOptions.shortfall })}
          >
            Add {formatIRR(fundingOptions.shortfall)}
          </button>
        </div>
        
        {fundingOptions.sellOptions && fundingOptions.sellOptions.length > 0 && (
          <div className="fundingOption">
            <div className="optionTitle">Option 2: Sell Foundation Asset</div>
            <div className="optionDesc">Liquidate part of Foundation to fund premium</div>
            
            {fundingOptions.sellOptions.map((opt, i) => (
              <div key={i} className="sellOption">
                <div className="sellOptionHeader">
                  <span className="sellAsset">{opt.asset}</span>
                  <span className="sellAmount">Sell {formatIRR(opt.sellAmount)}</span>
                </div>
                {opt.warning && (
                  <div className="sellWarning">{opt.warning}</div>
                )}
                <button 
                  className={`btn small ${opt.resultingBoundary === BOUNDARY_STATES.STRESS ? 'danger' : ''}`}
                  onClick={() => dispatch({ 
                    type: 'QUICK_SELL_FOR_FUNDING', 
                    assetId: opt.asset, 
                    amount: opt.sellAmount,
                    returnTo: 'PROTECT'
                  })}
                >
                  {opt.resultingBoundary === BOUNDARY_STATES.STRESS ? 'Sell Anyway' : 'Sell'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
      </div>
    </div>
  );
}

function BorrowCapacityCard({ holdings, loan }) {
  const capacity = calcBorrowCapacity(holdings, loan);
  const available = capacity.filter(c => !c.frozen && c.maxBorrow > 0);
  
  if (available.length === 0) {
    return (
      <div className="capacityCard">
        <div className="muted">No assets available for collateral</div>
      </div>
    );
  }
  
  return (
    <div className="capacityCard">
      <div className="capacityTitle">Available Borrow Capacity</div>
      {available.map(c => (
        <div key={c.asset} className="capacityRow">
          <div className="capacityAsset">
            <span className="assetName">{c.asset}</span>
            <span className="assetLayer">{c.layer}</span>
          </div>
          <div className="capacityValues">
            <div className="capacityMax">Max: {formatIRR(c.maxBorrow)}</div>
            <div className="capacityRec">@ {Math.round(c.maxLTV * 100)}% LTV</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LayerMini({ name, pct, target, drift }) {
  const driftColor = drift ? (
    Math.abs(drift) < 5 ? 'var(--muted)' :
    Math.abs(drift) < 10 ? '#fde047' :
    Math.abs(drift) < 20 ? '#fb923c' : '#f87171'
  ) : 'var(--muted)';
  
  return (
    <div className="mini">
      <div className="tag">{name}</div>
      <div className="big" style={{ fontSize: 20 }}>{Math.round(pct)}%</div>
      <div className="muted">Target {target}%</div>
      {drift !== undefined && (
        <div style={{ color: driftColor, fontSize: 11, marginTop: 4 }}>
          {drift >= 0 ? '+' : ''}{drift.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function PortfolioHome({ portfolio, cashIRR, targetLayers, boundary, onStartTrade, onStartProtect, onStartBorrow }) {
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
  const drift = boundary?.drift;

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
            <div className="muted">Available</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Allocation</h3>
        <div className="grid3">
          <LayerMini 
            name="Foundation" 
            pct={exposure.pct.foundation} 
            target={targetLayers?.foundation ?? '-'} 
            drift={drift?.foundation}
          />
          <LayerMini 
            name="Growth" 
            pct={exposure.pct.growth} 
            target={targetLayers?.growth ?? '-'} 
            drift={drift?.growth}
          />
          <LayerMini 
            name="Upside" 
            pct={exposure.pct.upside} 
            target={targetLayers?.upside ?? '-'} 
            drift={drift?.upside}
          />
        </div>
        
        {drift && drift.total > 5 && (
          <div className="driftWarning" style={{ marginTop: 12 }}>
            Total drift: {drift.total.toFixed(1)}% — Consider rebalancing
          </div>
        )}
      </div>

      <div className="card">
        <h3>Holdings</h3>
        <div className="list">
          {portfolio.holdings.map((h) => (
            <div key={h.asset} className="item" style={{ alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div className="asset">{h.asset}</div>
                <div className="muted">{h.layer.toUpperCase()}{h.frozen ? ' · 🔒 Collateral' : ''}</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 150 }}>
                <div className="asset">{formatIRR(h.amountIRR)}</div>
                <div className="row" style={{ justifyContent: 'flex-end', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <button className="btn tiny" onClick={() => onStartTrade(h.asset, 'BUY')}>Buy</button>
                  <button
                    className={'btn tiny ' + (h.frozen ? 'disabled' : '')}
                    disabled={h.frozen}
                    onClick={() => onStartTrade(h.asset, 'SELL')}
                  >
                    Sell
                  </button>
                  <button className="btn tiny" onClick={() => onStartProtect?.(h.asset)}>Protect</button>
                  <button
                    className={'btn tiny ' + (h.frozen ? 'disabled' : '')}
                    disabled={h.frozen}
                    onClick={() => onStartBorrow?.(h.asset)}
                  >
                    Borrow
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Protection({ protections }) {
  const list = protections || [];
  return (
    <div className="card">
      <h3>Active Protections</h3>
      {list.length === 0 ? (
        <div className="muted">No assets protected yet.</div>
      ) : (
        <div className="list">
          {list.map((p, idx) => (
            <div key={p.assetId + '|' + idx} className="item">
              <div style={{ flex: 1 }}>
                <div className="asset">{p.assetId}</div>
                <div className="muted">
                  {p.layer?.toUpperCase()} · Until {p.protectedUntil}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="asset">{formatIRR(p.premiumIRR)}</div>
                <div className="muted">Premium paid</div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="premiumRates">
        <div className="ratesTitle">Premium Rates</div>
        <div className="ratesRow"><span>Foundation</span><span>1% / 3mo</span></div>
        <div className="ratesRow"><span>Growth</span><span>2% / 3mo</span></div>
        <div className="ratesRow"><span>Upside</span><span>3% / 3mo</span></div>
      </div>
    </div>
  );
}

function Loans({ loan, portfolio }) {
  return (
    <div className="card">
      <h3>Active Loan</h3>
      {!loan ? (
        <>
          <div className="muted" style={{ marginBottom: 12 }}>No active loans.</div>
          {portfolio && <BorrowCapacityCard holdings={portfolio.holdings} loan={loan} />}
        </>
      ) : (
        <div className="list">
          <div className="item loanItem">
            <div style={{ flex: 1 }}>
              <div className="loanAmount">{formatIRR(loan.amountIRR)}</div>
              <div className="loanDetails">
                Collateral: {loan.collateralAssetId} · LTV {Math.round(loan.ltv * 100)}%
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="liquidationValue">{formatIRR(loan.liquidationIRR)}</div>
              <div className="muted">Liquidation threshold</div>
            </div>
          </div>
        </div>
      )}
      
      <div className="ltvLimits">
        <div className="limitsTitle">LTV Limits by Layer</div>
        <div className="limitsRow"><span>Foundation</span><span>Max 70% (Rec: 50%)</span></div>
        <div className="limitsRow"><span>Growth</span><span>Max 60% (Rec: 50%)</span></div>
        <div className="limitsRow"><span>Upside</span><span>Max 50% (Rec: 40%)</span></div>
      </div>
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

// NEW: Allocation Explanation Component
function AllocationExplanation({ targetLayers, riskProfile, showTranslations, onToggleTranslations }) {
  return (
    <div className="allocationExplanation">
      <div className="explanationHeader">
        <div>
          <div className="profileBadge">
            <span className="profileLevel">{riskProfile?.level}</span>
            {showTranslations && <span className="profileLevelFa">{riskProfile?.levelFa}</span>}
          </div>
          <div className="muted" style={{ marginTop: 4 }}>Risk Score: {riskProfile?.score}/14</div>
        </div>
        <button className="btn tiny" onClick={onToggleTranslations}>
          {showTranslations ? 'Hide EN' : 'Show EN'}
        </button>
      </div>
      
      <div className="layerExplanations">
        {['foundation', 'growth', 'upside'].map(layer => {
          const info = LAYER_EXPLANATIONS[layer];
          const pct = targetLayers?.[layer] || 0;
          
          return (
            <div key={layer} className="layerExplain" style={{ borderLeftColor: info.color }}>
              <div className="layerHeader">
                <span className="layerName" style={{ color: info.color }}>{info.name}</span>
                <span className="layerPct">{pct}%</span>
              </div>
              {showTranslations && (
                <div className="layerNameFa">{info.nameFa}</div>
              )}
              <div className="layerAssets">{info.assets.join(' · ')}</div>
              <div className="layerDesc">{info.description}</div>
              {showTranslations && (
                <div className="layerDescFa">{info.descriptionFa}</div>
              )}
              <div className="layerRisk">Risk: {info.risk}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionCard({ title, children }) {
  return (
    <div className="actionCard">
      <div className="actionTitle">{title}</div>
      {children}
    </div>
  );
}

function ValidationDisplay({ validation }) {
  if (!validation) return null;
  
  const hasIssues = validation.blockers?.length > 0 || validation.warnings?.length > 0;
  if (!hasIssues) return null;
  
  return (
    <div className="validationDisplay">
      {validation.blockers?.map((b, i) => (
        <div key={`b-${i}`} className="validationBlocker">{b}</div>
      ))}
      {validation.warnings?.map((w, i) => (
        <div key={`w-${i}`} className="validationWarning">{w}</div>
      ))}
    </div>
  );
}

// Enhanced preview panel with drift change display
function PreviewPanel({ title, preview, softWarning, validation, onConfirm, onBack }) {
  const after = preview?.after || preview;
  const deltas = preview?.deltas;
  
  const hasWarnings = (validation?.warnings?.length > 0) || softWarning;
  const confirmText = hasWarnings ? "Confirm Anyway" : "Confirm";

  return (
    <div className="previewPanel">
      <div className="previewTitle">{title}</div>

      <div className="previewCard">
        <div className="previewGrid">
          <div className="previewColumn">
            <div className="previewLabel">After</div>
            <div className="previewLayers">
              <span>F: {Math.round(after.layers.foundation)}%</span>
              <span>G: {Math.round(after.layers.growth)}%</span>
              <span>U: {Math.round(after.layers.upside)}%</span>
            </div>
            <div className="previewTotal">{formatIRR(after.totalIRR)}</div>
          </div>

          {deltas && (
            <div className="previewColumn">
              <div className="previewLabel">Change</div>
              <div className="previewDeltas">
                <span style={{ color: deltas.layers.foundation >= 0 ? '#4ade80' : '#f87171' }}>
                  F: {deltas.layers.foundation >= 0 ? '+' : ''}{Math.round(deltas.layers.foundation)}%
                </span>
                <span style={{ color: deltas.layers.upside > 0 ? '#fb923c' : '#4ade80' }}>
                  U: {deltas.layers.upside >= 0 ? '+' : ''}{Math.round(deltas.layers.upside)}%
                </span>
              </div>
              <div className="previewDelta">Δ {formatIRR(deltas.totalIRR)}</div>
            </div>
          )}
        </div>
        
        {/* Drift change indicator */}
        {preview?.beforeDrift && preview?.afterDrift && (
          <div className="driftChangeRow">
            <span className="driftChangeLabel">Drift:</span>
            <span className="driftChangeValue" style={{ color: preview.beforeDrift.total > 5 ? '#fb923c' : 'var(--muted)' }}>
              {preview.beforeDrift.total.toFixed(1)}%
            </span>
            <span className="driftArrow">→</span>
            <span className="driftChangeValue" style={{ color: preview.afterDrift.total > 5 ? '#fb923c' : '#4ade80' }}>
              {preview.afterDrift.total.toFixed(1)}%
            </span>
            {preview.driftChange !== 0 && (
              <span className={`driftDelta ${preview.driftChange > 0 ? 'negative' : 'positive'}`}>
                ({preview.driftChange > 0 ? '+' : ''}{preview.driftChange.toFixed(1)}%)
              </span>
            )}
          </div>
        )}
        
        {validation?.projectedBoundary && (
          <div className="projectedBoundary">
            <span className="projectedLabel">Projected:</span>
            <BoundaryBadge boundary={validation.projectedBoundary} />
          </div>
        )}

        <ValidationDisplay validation={validation} />

        {softWarning && !validation?.warnings?.includes(softWarning) && (
          <div className="softWarn">{softWarning}</div>
        )}
      </div>

      <div className="row" style={{ marginTop: 12, gap: 10 }}>
        <button className={`btn ${hasWarnings ? 'warning' : 'primary'}`} onClick={onConfirm}>
          {confirmText}
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
        <div className="questionnaireHeader">
          <div className="muted">Question {idx + 1} of {questionnaire.questions.length}</div>
          <button 
            className="btn tiny" 
            onClick={() => dispatch({ type: 'TOGGLE_TRANSLATIONS' })}
          >
            {state.showTranslations ? 'Hide EN' : 'Show EN'}
          </button>
        </div>

        <div className="q-card">
          <div className="q-title">{q.text}</div>
          {state.showTranslations && q.english && (
            <div className="q-english">{q.english}</div>
          )}
          <div className="q-options">
            {q.options.map((opt) => (
              <button
                key={opt.id}
                className="opt"
                onClick={() => dispatch({ type: 'ANSWER_QUESTION', qId: q.id, optionId: opt.id })}
              >
                <div>{opt.text}</div>
                {state.showTranslations && opt.english && (
                  <div className="opt-english">{opt.english}</div>
                )}
              </button>
            ))}
          </div>
        </div>
        
        <div className="progressBar">
          <div className="progressFill" style={{ width: `${((idx) / questionnaire.questions.length) * 100}%` }} />
        </div>
      </div>
    );
  }

  if (stage === STAGES.ALLOCATION_PROPOSED) {
    return (
      <div>
        <AllocationExplanation 
          targetLayers={state.targetLayers}
          riskProfile={state.riskProfile}
          showTranslations={state.showTranslations}
          onToggleTranslations={() => dispatch({ type: 'TOGGLE_TRANSLATIONS' })}
        />
        
        <div className="consentCard">
          <div className="consentHeader">Confirm Your Allocation</div>
          <div className="consentInstruction">
            {state.showTranslations 
              ? 'Paste the exact Persian sentence below to confirm you understand and accept:'
              : 'برای تأیید، جمله دقیق زیر را کپی و پیست کنید:'
            }
          </div>
          
          <div className="consentSentence">
            <div className="sentenceFa">{questionnaire.consent_exact}</div>
            {state.showTranslations && (
              <div className="sentenceEn">{questionnaire.consent_english}</div>
            )}
          </div>

          <input
            className="input"
            type="text"
            placeholder="Paste the exact sentence here"
            value={consentText}
            onChange={(e) => setConsentText(e.target.value)}
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={() => dispatch({ type: 'SUBMIT_CONSENT', text: consentText })}>
              Confirm
            </button>
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
            placeholder={`Min ${formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}`}
            value={state.user.investAmountIRR ?? ''}
            onChange={(e) => dispatch({ type: 'SET_INVEST_AMOUNT', investAmountIRR: e.target.value })}
          />
          <button className="btn primary" onClick={() => dispatch({ type: 'EXECUTE_PORTFOLIO' })}>
            Execute
          </button>
        </div>
        
        {state.targetLayers && (
          <div className="allocationPreview">
            <div className="previewTitle2">Your allocation:</div>
            <div className="allocationBars">
              <div className="allocBar foundation" style={{ width: `${state.targetLayers.foundation}%` }}>
                F {state.targetLayers.foundation}%
              </div>
              <div className="allocBar growth" style={{ width: `${state.targetLayers.growth}%` }}>
                G {state.targetLayers.growth}%
              </div>
              <div className="allocBar upside" style={{ width: `${state.targetLayers.upside}%` }}>
                U {state.targetLayers.upside}%
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (stage === STAGES.EXECUTED) {
    return (
      <div>
        <ExecutionSummary 
          lastAction={state.lastAction} 
          onDismiss={() => dispatch({ type: 'DISMISS_LAST_ACTION' })} 
        />
        
        <RebalanceSuggestion
          suggestion={state.rebalanceSuggestion}
          onRebalance={() => dispatch({ type: 'START_REBALANCE' })}
          onDismiss={() => dispatch({ type: 'DISMISS_REBALANCE_SUGGESTION' })}
        />
        
        {state.postAction === POST_ACTIONS.NONE && (
          <div className="chips">
            <button className="chip primary" onClick={() => dispatch({ type: 'START_ADD_FUNDS' })}>Add funds</button>
            <button className="chip" onClick={() => dispatch({ type: 'START_REBALANCE' })}>Rebalance</button>
            <button className="chip" onClick={() => dispatch({ type: 'START_PROTECT' })}>Protect</button>
            <button className="chip" onClick={() => dispatch({ type: 'START_BORROW' })}>Borrow</button>
            <button className="chip ghost" onClick={onReset}>Reset</button>
          </div>
        )}

        {state.postAction === POST_ACTIONS.ADD_FUNDS && (
          <ActionCard title="Add Funds">
            <input
              className="input"
              type="number"
              placeholder="Amount in IRR"
              value={state.pendingAmountIRR ?? ''}
              onChange={(e) => dispatch({ type: 'SET_PENDING_AMOUNT', amountIRR: e.target.value })}
            />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_ADD_FUNDS' })} disabled={!state.pendingAmountIRR}>Preview</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}

        {state.postAction === POST_ACTIONS.ADD_FUNDS_PREVIEW && (
          <PreviewPanel
            title="Preview: Add Funds"
            preview={state.preview}
            softWarning={state.softWarning}
            validation={state.validation}
            onConfirm={() => dispatch({ type: 'CONFIRM_ADD_FUNDS_FINAL' })}
            onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })}
          />
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
              <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_TRADE' })} disabled={!state.tradeDraft?.amountIRR}>Preview</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}

        {state.postAction === POST_ACTIONS.TRADE_PREVIEW && (
          <PreviewPanel
            title="Preview: Trade"
            preview={state.preview}
            softWarning={state.softWarning}
            validation={state.validation}
            onConfirm={() => dispatch({ type: 'CONFIRM_TRADE_FINAL' })}
            onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })}
          />
        )}

        {state.postAction === POST_ACTIONS.REBALANCE && (
          <ActionCard title="Rebalance">
            <div className="muted">
              Restore portfolio to target allocation and invest all cash.
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_REBALANCE' })}>Preview</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}

        {state.postAction === POST_ACTIONS.REBALANCE_PREVIEW && (
          <PreviewPanel
            title="Preview: Rebalance"
            preview={state.preview}
            softWarning={state.softWarning}
            validation={state.validation}
            onConfirm={() => dispatch({ type: 'CONFIRM_REBALANCE_FINAL' })}
            onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })}
          />
        )}

        {state.postAction === POST_ACTIONS.PROTECT && (
          <ActionCard title="Protection">
            <div className="row" style={{ gap: 8 }}>
              <select
                className="input"
                value={state.protectDraft?.assetId || ''}
                onChange={(e) => dispatch({ type: 'SET_PROTECT_ASSET', assetId: e.target.value })}
              >
                {(state.portfolio?.holdings || []).map((h) => (
                  <option key={h.asset} value={h.asset}>{h.asset} ({h.layer} · {PREMIUM_RATES[h.layer] * 100}%)</option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                min="1"
                max="6"
                placeholder="Months"
                value={state.protectDraft?.months ?? 3}
                onChange={(e) => dispatch({ type: 'SET_PROTECT_MONTHS', months: e.target.value })}
                style={{ width: 80 }}
              />
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              Duration 1–6 months. Premium paid from cash.
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_PROTECT' })}>Preview</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}

        {state.postAction === POST_ACTIONS.PROTECT_FUNDING && (
          <FundingOptionsPanel 
            fundingOptions={state.fundingOptions}
            protectDraft={state.protectDraft}
            dispatch={dispatch}
          />
        )}

        {state.postAction === POST_ACTIONS.PROTECT_PREVIEW && (
          <PreviewPanel
            title="Preview: Protection"
            preview={state.preview}
            softWarning={state.softWarning}
            validation={state.validation}
            onConfirm={() => dispatch({ type: 'CONFIRM_PROTECT_FINAL' })}
            onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })}
          />
        )}

        {state.postAction === POST_ACTIONS.BORROW && (
          <ActionCard title="Borrow">
            <div className="row" style={{ gap: 8 }}>
              <select
                className="input"
                value={state.borrowDraft?.assetId || ''}
                onChange={(e) => dispatch({ type: 'SET_BORROW_ASSET', assetId: e.target.value })}
              >
                {(state.portfolio?.holdings || []).filter(h => !h.frozen).map((h) => {
                  const limits = LTV_LIMITS[h.layer] || LTV_LIMITS.growth;
                  return (
                    <option key={h.asset} value={h.asset}>
                      {h.asset} ({h.layer} · max {Math.round(limits.max * 100)}% LTV)
                    </option>
                  );
                })}
              </select>
              <select
                className="input"
                value={state.borrowDraft?.ltv ?? 0.5}
                onChange={(e) => dispatch({ type: 'SET_BORROW_LTV', ltv: e.target.value })}
                style={{ width: 100 }}
              >
                <option value={0.4}>40% LTV</option>
                <option value={0.5}>50% LTV</option>
                <option value={0.6}>60% LTV</option>
              </select>
            </div>
            <input
              className="input"
              style={{ marginTop: 8 }}
              type="number"
              placeholder="Loan amount (IRR)"
              value={state.borrowDraft?.amountIRR ?? ''}
              onChange={(e) => dispatch({ type: 'SET_BORROW_AMOUNT', amountIRR: e.target.value })}
            />
            {state.borrowDraft?.assetId && (
              <div className="borrowHint">
                {(() => {
                  const h = state.portfolio?.holdings?.find(x => x.asset === state.borrowDraft.assetId);
                  if (!h) return null;
                  const max = Math.floor(h.amountIRR * state.borrowDraft.ltv);
                  return <span>Max borrow at {Math.round(state.borrowDraft.ltv * 100)}% LTV: {formatIRR(max)}</span>;
                })()}
              </div>
            )}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_BORROW' })} disabled={!state.borrowDraft?.amountIRR}>Preview</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}

        {state.postAction === POST_ACTIONS.BORROW_PREVIEW && (
          <PreviewPanel
            title="Preview: Borrow"
            preview={state.preview}
            softWarning={state.softWarning}
            validation={state.validation}
            onConfirm={() => dispatch({ type: 'CONFIRM_BORROW_FINAL' })}
            onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })}
          />
        )}
      </div>
    );
  }

  return null;
}

// ====== MAIN APP ======
export default function App() {
  const [state, dispatch] = useReducer(reduce, null, initialState);

  const boundary = useMemo(() => computeBoundary(state), [state]);

  const stepLabel = useMemo(() => {
    const stage = state.user.stage;
    const map = {
      [STAGES.PHONE_REQUIRED]: { idx: 1, name: 'Phone' },
      [STAGES.QUESTIONNAIRE]: { idx: 2, name: 'Questionnaire' },
      [STAGES.ALLOCATION_PROPOSED]: { idx: 3, name: 'Review' },
      [STAGES.AMOUNT_REQUIRED]: { idx: 4, name: 'Fund' },
      [STAGES.EXECUTED]: { idx: 5, name: 'Active' },
    };
    const x = map[stage] || { idx: 0, name: stage };
    return `Step ${x.idx} of 5 — ${x.name}`;
  }, [state.user.stage]);

  const onStartTrade = (assetId, side) => dispatch({ type: 'START_TRADE', assetId, side });
  const onStartProtect = (assetId) => dispatch({ type: 'START_PROTECT', assetId });
  const onStartBorrow = (assetId) => dispatch({ type: 'START_BORROW', assetId });

  const right = useMemo(() => {
    if (state.tab === 'PROTECTION') return <Protection protections={state.protections} />
    if (state.tab === 'LOANS') return <Loans loan={state.loan} portfolio={state.portfolio} />
    if (state.tab === 'HISTORY') return <HistoryPane ledger={state.ledger} />
    return (
      <PortfolioHome
        portfolio={state.portfolio}
        cashIRR={state.cashIRR}
        targetLayers={state.targetLayers}
        boundary={boundary}
        onStartTrade={onStartTrade}
        onStartProtect={onStartProtect}
        onStartBorrow={onStartBorrow}
      />
    );
  }, [state.tab, state.portfolio, state.cashIRR, state.targetLayers, state.protections, state.loan, state.ledger, boundary]);

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
        .rightMeta{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
        .pill{display:inline-flex;gap:8px;align-items:center;padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:rgba(255,255,255,.03);font-weight:900;font-size:11px}
        .body{padding:14px;overflow:auto;flex:1;min-height:0}
        .footer{padding:12px;border-top:1px solid var(--border);background:rgba(255,255,255,.02)}
        .msg{padding:12px;border-radius:14px;border:1px solid var(--border);background:rgba(255,255,255,.03);margin-bottom:10px;white-space:pre-line}
        .msg.user{background:rgba(79,124,255,.12);border-color:rgba(79,124,255,.25)}
        .msg .meta{font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em}
        .row{display:flex;gap:8px;flex-wrap:wrap}
        .btn{appearance:none;border:1px solid var(--border);background:rgba(255,255,255,.03);color:var(--text);padding:10px 12px;border-radius:12px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-size:13px}
        .btn.primary{background:var(--accent2);border-color:rgba(79,124,255,.35)}
        .btn.warning{background:rgba(249,115,22,.15);border-color:rgba(249,115,22,.4);color:#fb923c}
        .btn.danger{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.4);color:#f87171}
        .btn.small{padding:6px 10px;font-size:12px}
        .btn:disabled{opacity:.45;cursor:not-allowed}
        .input{width:100%;padding:11px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.03);color:var(--text);font-weight:900;outline:none}
        .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px;margin-bottom:12px}
        .card h3{margin:0 0 10px 0;font-size:14px}
        .big{font-size:28px;font-weight:1000;letter-spacing:-.03em}
        .muted{color:var(--muted);font-size:12px;line-height:1.35}
        .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .mini{border:1px solid var(--border);border-radius:14px;padding:10px;background:rgba(255,255,255,.02)}
        .tag{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
        .list{display:flex;flex-direction:column;gap:10px}
        .item{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.02)}
        .asset{font-weight:1000}
        .tabs{display:flex;gap:8px;flex-wrap:wrap}
        .tab{padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.02);font-weight:1000;cursor:pointer;color:var(--text);font-size:13px}
        .tab.active{background:var(--accent2);border-color:rgba(79,124,255,.35)}
        .chips{display:flex;gap:8px;flex-wrap:wrap}
        .chip{padding:8px 10px;border-radius:999px;border:1px solid var(--border);background:rgba(255,255,255,.03);font-weight:900;font-size:12px;cursor:pointer;color:var(--text)}
        .chip.primary{background:var(--accent2);border-color:rgba(79,124,255,.35)}
        .chip.ghost{opacity:0.6}
        @media(max-width:980px){.container{grid-template-columns:1fr;}.panel{min-height:48vh}}
        
        .btn.tiny{padding:6px 10px;font-size:11px;border-radius:10px}
        .btn.tiny.disabled{opacity:.5;cursor:not-allowed}
        
        /* Questionnaire */
        .questionnaireHeader{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .q-card{border:1px solid var(--border);border-radius:16px;padding:12px;background:rgba(255,255,255,.02)}
        .q-title{font-weight:900;margin-bottom:6px;line-height:1.4;font-size:15px}
        .q-english{font-size:12px;color:var(--muted);margin-bottom:10px;font-style:italic}
        .q-options{display:flex;flex-direction:column;gap:8px}
        .opt{appearance:none;border:1px solid var(--border);background:rgba(255,255,255,.03);color:var(--text);padding:10px 12px;border-radius:12px;font-weight:900;cursor:pointer;text-align:left}
        .opt:hover{border-color:rgba(79,124,255,.35)}
        .opt-english{font-size:11px;color:var(--muted);margin-top:4px;font-weight:500}
        .progressBar{height:4px;background:var(--border);border-radius:2px;margin-top:12px;overflow:hidden}
        .progressFill{height:100%;background:var(--accent);transition:width .3s}
        
        /* Allocation Explanation */
        .allocationExplanation{margin-bottom:12px}
        .explanationHeader{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
        .profileBadge{display:flex;flex-direction:column}
        .profileLevel{font-weight:900;font-size:16px;color:var(--accent)}
        .profileLevelFa{font-size:12px;color:var(--muted)}
        .layerExplanations{display:flex;flex-direction:column;gap:10px}
        .layerExplain{border-left:3px solid;padding-left:12px;padding:8px 0 8px 12px;background:rgba(255,255,255,.02);border-radius:0 10px 10px 0}
        .layerHeader{display:flex;justify-content:space-between;align-items:center}
        .layerName{font-weight:900;font-size:14px}
        .layerPct{font-weight:900;font-size:16px}
        .layerNameFa{font-size:11px;color:var(--muted)}
        .layerAssets{font-size:11px;color:var(--muted);margin-top:4px}
        .layerDesc{font-size:12px;margin-top:4px}
        .layerDescFa{font-size:11px;color:var(--muted);font-style:italic}
        .layerRisk{font-size:10px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.05em}
        
        /* Consent */
        .consentCard{border:1px solid var(--border);border-radius:14px;padding:12px;background:rgba(255,255,255,.02)}
        .consentHeader{font-weight:900;margin-bottom:8px}
        .consentInstruction{font-size:12px;color:var(--muted);margin-bottom:10px}
        .consentSentence{background:rgba(0,0,0,.2);border-radius:10px;padding:10px;margin-bottom:10px}
        .sentenceFa{font-weight:900;font-size:13px;line-height:1.5}
        .sentenceEn{font-size:11px;color:var(--muted);margin-top:6px;font-style:italic}
        
        /* Amount Preview */
        .allocationPreview{margin-top:12px;padding:10px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.02)}
        .previewTitle2{font-size:11px;color:var(--muted);margin-bottom:8px}
        .allocationBars{display:flex;height:24px;border-radius:6px;overflow:hidden}
        .allocBar{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#fff}
        .allocBar.foundation{background:#4ade80}
        .allocBar.growth{background:#60a5fa}
        .allocBar.upside{background:#f472b6}
        
        .code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.5;border:1px solid var(--border);background:rgba(0,0,0,.2);padding:10px 12px;border-radius:12px;white-space:pre-wrap}
        .stack{display:flex;flex-direction:column;gap:0}
        
        /* Boundary Badge */
        .boundaryBadge{display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;border:1px solid;font-size:12px}
        
        /* Drift Warning */
        .driftWarning{padding:8px 12px;border-radius:10px;background:rgba(250,204,21,.1);border:1px solid rgba(250,204,21,.25);color:#fde047;font-size:12px;font-weight:700}
        
        /* Rebalance Suggestion */
        .rebalanceSuggestion{background:rgba(79,124,255,.1);border:1px solid rgba(79,124,255,.25);border-radius:12px;padding:10px 12px;margin-bottom:12px}
        .suggestionHeader{display:flex;align-items:center;gap:8px;margin-bottom:8px}
        .suggestionIcon{font-size:14px}
        .suggestionTitle{flex:1;font-weight:900;font-size:13px;color:var(--accent)}
        .suggestionDismiss{background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:0}
        .suggestionDetails{display:flex;gap:16px;margin-bottom:10px}
        .suggestionRow{display:flex;align-items:center;gap:6px;font-size:12px}
        .driftValue{font-weight:900}
        .driftValue.high{color:#fb923c}
        .driftValue.low{color:#4ade80}
        
        /* Action Card */
        .actionCard{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px}
        .actionTitle{font-weight:900;font-size:13px;margin-bottom:10px;color:var(--muted)}
        
        /* Preview Panel */
        .previewPanel{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px}
        .previewTitle{font-weight:900;font-size:13px;margin-bottom:10px;color:var(--muted)}
        .previewCard{border:1px solid var(--border);border-radius:12px;padding:12px;background:rgba(255,255,255,.02)}
        .previewGrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .previewColumn{}
        .previewLabel{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
        .previewLayers{display:flex;gap:8px;font-size:13px;font-weight:900}
        .previewTotal{font-size:12px;color:var(--muted);margin-top:4px}
        .previewDeltas{display:flex;gap:8px;font-size:13px;font-weight:900}
        .previewDelta{font-size:12px;color:var(--muted);margin-top:4px}
        .projectedBoundary{display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
        .projectedLabel{font-size:11px;color:var(--muted)}
        
        /* Drift Change Row */
        .driftChangeRow{display:flex;align-items:center;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px}
        .driftChangeLabel{color:var(--muted)}
        .driftChangeValue{font-weight:900}
        .driftArrow{color:var(--muted)}
        .driftDelta{font-weight:700}
        .driftDelta.negative{color:#f87171}
        .driftDelta.positive{color:#4ade80}
        
        /* Validation */
        .validationDisplay{margin-top:10px}
        .validationBlocker{padding:8px 12px;border-radius:8px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#f87171;font-size:12px;margin-bottom:6px}
        .validationWarning{padding:8px 12px;border-radius:8px;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.25);color:#fb923c;font-size:12px;margin-bottom:6px}
        .softWarn{padding:8px 12px;border-radius:8px;background:rgba(250,204,21,.1);border:1px solid rgba(250,204,21,.25);color:#fde047;font-size:12px;margin-top:10px}
        
        /* Execution Summary */
        .executionSummary{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);border-radius:12px;padding:10px 12px;margin-bottom:12px}
        .summaryHeader{display:flex;align-items:center;gap:8px}
        .summaryIcon{font-size:14px}
        .summaryTitle{flex:1;font-weight:900;font-size:13px;color:#4ade80}
        .summaryDismiss{background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:0}
        .summaryBoundary{display:flex;align-items:center;gap:6px;margin-top:6px}
        
        /* Ledger */
        .ledgerList{display:flex;flex-direction:column;gap:8px}
        .ledgerEntry{border:1px solid var(--border);border-radius:12px;padding:10px;background:rgba(255,255,255,.02)}
        .ledgerHeader{display:flex;align-items:center;gap:8px}
        .ledgerIcon{font-size:12px;width:20px}
        .ledgerAction{font-weight:900;font-size:13px;flex:1}
        .ledgerTime{color:var(--muted);font-size:11px}
        .ledgerExpand{color:var(--muted);font-size:14px;width:20px;text-align:center}
        .ledgerBoundary{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}
        .boundaryPill{padding:3px 8px;border-radius:6px;font-size:10px;font-weight:900;text-transform:uppercase}
        .boundaryPill.small{padding:2px 6px;font-size:9px}
        .boundaryPill.safe{background:rgba(34,197,94,.15);color:#4ade80}
        .boundaryPill.drift{background:rgba(250,204,21,.15);color:#fde047}
        .boundaryPill.structural{background:rgba(249,115,22,.15);color:#fb923c}
        .boundaryPill.stress{background:rgba(239,68,68,.15);color:#f87171}
        .boundaryArrow{color:var(--muted);font-size:11px}
        .driftBadge{font-size:10px;color:var(--muted);margin-left:auto}
        .ledgerDetails{margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
        .ledgerSnapshot{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .snapshotColumn{}
        .snapshotLabel{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
        .snapshotValue{font-weight:900;font-size:13px;margin-top:2px}
        .snapshotLayers{font-size:11px;color:var(--muted);margin-top:2px}
        .snapshotCash{font-size:11px;color:var(--muted)}
        .ledgerParams{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:11px;color:var(--muted)}
        
        /* Funding Panel */
        .fundingPanel{background:var(--card);border:1px solid rgba(249,115,22,.3);border-radius:14px;padding:12px}
        .fundingHeader{display:flex;align-items:center;gap:8px;font-weight:900;color:#fb923c;margin-bottom:12px}
        .fundingIcon{font-size:16px}
        .fundingDetails{background:rgba(0,0,0,.2);border-radius:10px;padding:10px;margin-bottom:12px}
        .fundingRow{display:flex;justify-content:space-between;font-size:12px;padding:4px 0}
        .fundingRow.highlight{font-weight:900;color:#fb923c}
        .fundingValue{font-weight:900}
        .fundingOptions{display:flex;flex-direction:column;gap:12px}
        .fundingOption{border:1px solid var(--border);border-radius:10px;padding:10px;background:rgba(255,255,255,.02)}
        .optionTitle{font-weight:900;font-size:12px;margin-bottom:4px}
        .optionDesc{font-size:11px;color:var(--muted);margin-bottom:8px}
        .sellOption{background:rgba(0,0,0,.2);border-radius:8px;padding:8px;margin-top:8px}
        .sellOptionHeader{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px}
        .sellAsset{font-weight:900}
        .sellAmount{color:var(--muted)}
        .sellWarning{font-size:11px;color:#fb923c;margin-bottom:6px}
        
        /* Premium Rates / LTV Limits */
        .premiumRates,.ltvLimits{margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
        .ratesTitle,.limitsTitle{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
        .ratesRow,.limitsRow{display:flex;justify-content:space-between;font-size:12px;padding:3px 0}
        
        /* Borrow Capacity */
        .capacityCard{margin-top:12px;padding:10px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.02)}
        .capacityTitle{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
        .capacityRow{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)}
        .capacityRow:last-child{border-bottom:none}
        .capacityAsset{display:flex;flex-direction:column}
        .assetName{font-weight:900;font-size:12px}
        .assetLayer{font-size:10px;color:var(--muted)}
        .capacityValues{text-align:right}
        .capacityMax{font-weight:900;font-size:12px}
        .capacityRec{font-size:10px;color:var(--muted)}
        
        /* Loan Item */
        .loanItem{background:rgba(79,124,255,.08)}
        .loanAmount{font-size:18px;font-weight:1000}
        .loanDetails{font-size:12px;color:var(--muted);margin-top:4px}
        .liquidationValue{font-size:16px;font-weight:900;color:#fb923c}
        
        /* Borrow Hint */
        .borrowHint{font-size:11px;color:var(--muted);margin-top:6px;padding:6px 8px;background:rgba(0,0,0,.2);border-radius:6px}
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
              {state.user.stage === STAGES.EXECUTED && (
                <BoundaryBadge boundary={boundary} />
              )}
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
