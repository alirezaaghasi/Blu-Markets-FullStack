// Mock API for Demo Mode
// Provides same interface as real API but uses Redux store data

import { store } from '../../../store';
import {
  addFunds as addFundsAction,
  executeTrade as executeTradeAction,
  addProtection,
  removeProtection,
  addLoan,
  updateLoan,
  logAction,
  initializePortfolio,
} from '../../../store/slices/portfolioSlice';
import { completeOnboarding, logout } from '../../../store/slices/authSlice';
import { setRiskProfile } from '../../../store/slices/onboardingSlice';
import { ASSETS } from '../../../constants/assets';
import { FIXED_INCOME_UNIT_PRICE, RISK_PROFILE_ALLOCATIONS, RISK_PROFILE_NAMES, SPREAD_BY_LAYER } from '../../../constants/business';
import { calculateRiskProfile } from '../../../utils/riskProfile';
import type {
  AssetId,
  Holding,
  Loan,
  Protection,
  ProtectableHolding,
  ProtectionQuote,
  PremiumCurvePoint,
  AssetVolatility,
  TargetLayerPct,
  PortfolioStatus,
  TradePreview,
  RebalancePreview,
  Boundary,
  LoanInstallment,
} from '../../../types';

// Import response types from types file
import type {
  AuthResponse,
  QuestionnaireResponse,
  PortfolioResponse,
  ActivityResponse,
  LoanCapacityResponse,
  LoansResponse,
  ProtectionsResponse,
  EligibleAssetsResponse,
  PricesResponse,
  TradeExecuteResponse,
  UserProfile,
  UserSettings,
} from '../types';

// Simulated delay to mimic network latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MOCK_DELAY = 300;

// Helper to get current state
const getState = () => store.getState();

// Helper to calculate portfolio value
const calculatePortfolioValue = (holdings: Holding[], prices: Record<string, number>, fxRate: number): number => {
  return holdings.reduce((sum, h) => {
    if (h.assetId === 'IRR_FIXED_INCOME') {
      return sum + h.quantity * FIXED_INCOME_UNIT_PRICE;
    }
    const priceUSD = prices[h.assetId] || 0;
    return sum + h.quantity * priceUSD * fxRate;
  }, 0);
};

// Helper to classify trade boundary
const classifyBoundary = (driftPercent: number): Boundary => {
  const absDrift = Math.abs(driftPercent);
  if (absDrift < 0.05) return 'SAFE';
  if (absDrift < 0.10) return 'DRIFT';
  if (absDrift < 0.15) return 'STRUCTURAL';
  return 'STRESS';
};

// Authentication APIs
export const auth = {
  sendOtp: async (_phone: string): Promise<{ success: boolean }> => {
    await delay(MOCK_DELAY);
    return { success: true };
  },

  verifyOtp: async (_phone: string, code: string): Promise<AuthResponse> => {
    await delay(MOCK_DELAY);

    // Accept any 6-digit code in mock mode
    if (code.length !== 6) {
      throw new Error('Invalid OTP code');
    }

    // Check if user has completed onboarding previously
    const state = getState();
    const hasCompletedOnboarding = state.auth.onboardingComplete;

    // For new users or users who haven't completed onboarding,
    // don't load demo data - let them go through the real flow
    return {
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      isNewUser: !hasCompletedOnboarding,
      onboardingComplete: hasCompletedOnboarding,
    };
  },

  refresh: async (): Promise<AuthResponse> => {
    await delay(MOCK_DELAY);

    // Check current state to determine onboarding status
    const state = getState();
    const hasCompletedOnboarding = state.auth.onboardingComplete;

    return {
      accessToken: 'mock_access_token_refreshed',
      refreshToken: 'mock_refresh_token_refreshed',
      isNewUser: false,
      onboardingComplete: hasCompletedOnboarding,
    };
  },

  logout: async (): Promise<void> => {
    await delay(MOCK_DELAY);
    store.dispatch(logout());
  },
};

// Questionnaire answer type for type consistency with real API
interface QuestionnaireAnswer {
  questionId: string;
  answerId: string;
  value: number;
}

// Onboarding APIs
export const onboarding = {
  submitQuestionnaire: async (answers: QuestionnaireAnswer[]): Promise<QuestionnaireResponse> => {
    await delay(MOCK_DELAY);

    // Convert answers array to Record<string, number> for calculateRiskProfile
    // Uses option index (value) as the answer for each question
    const answerMap: Record<string, number> = {};
    answers.forEach(a => {
      answerMap[a.questionId] = a.value;
    });

    // Use the proper risk profile algorithm with conservative dominance
    // (min of capacity vs willingness, horizon caps, consistency checks, etc.)
    const riskProfile = calculateRiskProfile(answerMap);
    const riskScore = riskProfile.score;
    const riskTier = Math.ceil(riskScore / 2);
    const targetAllocation = riskProfile.targetAllocation;

    store.dispatch(setRiskProfile({
      score: riskScore,
      profileName: riskProfile.profileName,
      profileNameFarsi: riskProfile.profileNameFarsi,
      targetAllocation,
    }));

    return {
      riskScore,
      riskTier,
      profileName: riskProfile.profileName,
      riskProfile: {
        name: riskProfile.profileName,
        nameFa: riskProfile.profileNameFarsi,
      },
      targetAllocation,
    };
  },

  recordConsent: async (): Promise<{ success: boolean }> => {
    await delay(MOCK_DELAY);
    return { success: true };
  },

  createPortfolio: async (amountIrr: number): Promise<PortfolioResponse> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const { riskProfile } = state.onboarding;
    const { prices, fxRate } = state.prices;

    // Use user's risk profile allocation, or default to balanced (50/35/15)
    const targetAllocation = riskProfile?.targetAllocation || {
      FOUNDATION: 0.50,
      GROWTH: 0.35,
      UPSIDE: 0.15,
    };

    // Calculate amount per layer
    const foundationIRR = amountIrr * targetAllocation.FOUNDATION;
    const growthIRR = amountIrr * targetAllocation.GROWTH;
    const upsideIRR = amountIrr * targetAllocation.UPSIDE;

    // Asset distribution within layers:
    // Foundation: USDT 70%, IRR_FIXED_INCOME 30%
    // Growth: BTC 60%, ETH 40%
    // Upside: SOL 100%

    // Get prices with fallbacks
    const usdtPrice = prices['USDT'] || 1.0;
    const btcPrice = prices['BTC'] || 97500;
    const ethPrice = prices['ETH'] || 3200;
    const solPrice = prices['SOL'] || 185;

    // Calculate quantities (accounting for spread on Growth and Upside)
    const usdtAmount = foundationIRR * 0.70;
    const fixedIncomeAmount = foundationIRR * 0.30;
    const btcAmount = growthIRR * 0.60;
    const ethAmount = growthIRR * 0.40;
    const solAmount = upsideIRR;

    // Convert to quantities
    const usdtQuantity = usdtAmount / (usdtPrice * fxRate);
    const fixedIncomeQuantity = fixedIncomeAmount / FIXED_INCOME_UNIT_PRICE;

    // Apply spread for Growth and Upside assets
    const btcQuantity = (btcAmount * (1 - SPREAD_BY_LAYER.GROWTH)) / (btcPrice * fxRate);
    const ethQuantity = (ethAmount * (1 - SPREAD_BY_LAYER.GROWTH)) / (ethPrice * fxRate);
    const solQuantity = (solAmount * (1 - SPREAD_BY_LAYER.UPSIDE)) / (solPrice * fxRate);

    // Create holdings array
    const holdings: Holding[] = [];

    if (usdtQuantity > 0) {
      holdings.push({ assetId: 'USDT', quantity: usdtQuantity, frozen: false, layer: 'FOUNDATION' });
    }
    if (fixedIncomeQuantity > 0) {
      holdings.push({ assetId: 'IRR_FIXED_INCOME', quantity: fixedIncomeQuantity, frozen: false, layer: 'FOUNDATION' });
    }
    if (btcQuantity > 0) {
      holdings.push({ assetId: 'BTC', quantity: btcQuantity, frozen: false, layer: 'GROWTH' });
    }
    if (ethQuantity > 0) {
      holdings.push({ assetId: 'ETH', quantity: ethQuantity, frozen: false, layer: 'GROWTH' });
    }
    if (solQuantity > 0) {
      holdings.push({ assetId: 'SOL', quantity: solQuantity, frozen: false, layer: 'UPSIDE' });
    }

    // Initialize portfolio with calculated holdings
    store.dispatch(initializePortfolio({
      cashIRR: 0, // All money invested
      holdings,
      targetLayerPct: targetAllocation,
    }));

    // Log the portfolio creation
    store.dispatch(logAction({
      type: 'PORTFOLIO_CREATED',
      boundary: 'SAFE',
      message: `Started with ${amountIrr.toLocaleString()} IRR`,
      amountIRR: amountIrr,
    }));

    // Complete onboarding
    store.dispatch(completeOnboarding());

    const totalValue = calculatePortfolioValue(holdings, prices, fxRate);

    return {
      cashIrr: 0,
      holdings,
      targetAllocation,
      status: 'BALANCED',
      totalValueIrr: totalValue,
      dailyChangePercent: 0,
    };
  },
};

// Portfolio APIs
export const portfolio = {
  get: async (): Promise<PortfolioResponse> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const { holdings, targetLayerPct, status, cashIRR } = state.portfolio;
    const { prices, fxRate } = state.prices;
    const totalValue = calculatePortfolioValue(holdings, prices, fxRate) + cashIRR;

    return {
      cashIrr: cashIRR,
      holdings,
      targetAllocation: targetLayerPct,
      status,
      totalValueIrr: totalValue,
      dailyChangePercent: Math.random() * 4 - 2, // Random -2% to +2%
    };
  },

  addFunds: async (amountIrr: number): Promise<PortfolioResponse> => {
    await delay(MOCK_DELAY);

    store.dispatch(addFundsAction({ amountIRR: amountIrr }));

    return portfolio.get();
  },

  getAsset: async (assetId: AssetId): Promise<{
    holding: Holding;
    currentPriceUsd: number;
    valueIrr: number;
    changePercent24h: number;
  }> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const holding = state.portfolio.holdings.find((h) => h.assetId === assetId);
    const priceUsd = state.prices.prices[assetId] || 0;
    const fxRate = state.prices.fxRate;

    if (!holding) {
      throw new Error(`Asset ${assetId} not found in portfolio`);
    }

    const valueIrr = assetId === 'IRR_FIXED_INCOME'
      ? holding.quantity * FIXED_INCOME_UNIT_PRICE
      : holding.quantity * priceUsd * fxRate;

    return {
      holding,
      currentPriceUsd: priceUsd,
      valueIrr,
      changePercent24h: Math.random() * 10 - 5, // Random -5% to +5%
    };
  },
};

// Trade APIs
export const trade = {
  preview: async (assetId: AssetId, action: 'BUY' | 'SELL', amountIrr: number): Promise<TradePreview> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const { prices, fxRate } = state.prices;
    const { holdings, targetLayerPct, cashIRR } = state.portfolio;
    const asset = ASSETS[assetId];
    const side = action; // Use action as side internally for compatibility

    if (!asset) {
      throw new Error(`Unknown asset: ${assetId}`);
    }

    const priceUSD = prices[assetId] || 0;
    const priceIRR = priceUSD * fxRate;
    const spread = asset.layer === 'FOUNDATION' ? 0.0015 : asset.layer === 'GROWTH' ? 0.003 : 0.006;
    const quantity = amountIrr / priceIRR;

    // Calculate current allocation
    const totalValue = calculatePortfolioValue(holdings, prices, fxRate) + cashIRR;
    const layerValues: Record<string, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };

    holdings.forEach((h) => {
      const a = ASSETS[h.assetId];
      if (a) {
        const val = h.assetId === 'IRR_FIXED_INCOME'
          ? h.quantity * FIXED_INCOME_UNIT_PRICE
          : h.quantity * (prices[h.assetId] || 0) * fxRate;
        layerValues[a.layer] += val;
      }
    });

    const before: TargetLayerPct = {
      FOUNDATION: totalValue > 0 ? layerValues.FOUNDATION / totalValue : 0,
      GROWTH: totalValue > 0 ? layerValues.GROWTH / totalValue : 0,
      UPSIDE: totalValue > 0 ? layerValues.UPSIDE / totalValue : 0,
    };

    // Calculate after allocation
    const tradeValue = amountIrr * (1 - spread);
    const newLayerValues = { ...layerValues };

    if (side === 'BUY') {
      newLayerValues[asset.layer] += tradeValue;
    } else {
      newLayerValues[asset.layer] -= tradeValue;
    }

    const newTotalValue = totalValue + (side === 'BUY' ? 0 : -amountIrr);
    const after: TargetLayerPct = {
      FOUNDATION: newTotalValue > 0 ? newLayerValues.FOUNDATION / newTotalValue : 0,
      GROWTH: newTotalValue > 0 ? newLayerValues.GROWTH / newTotalValue : 0,
      UPSIDE: newTotalValue > 0 ? newLayerValues.UPSIDE / newTotalValue : 0,
    };

    // Calculate drift from target
    const driftFromTarget = Math.abs(after[asset.layer] - targetLayerPct[asset.layer]);
    const boundary = classifyBoundary(driftFromTarget);

    // Check if moving toward target
    const beforeDrift = Math.abs(before[asset.layer] - targetLayerPct[asset.layer]);
    const afterDrift = Math.abs(after[asset.layer] - targetLayerPct[asset.layer]);
    const movesTowardTarget = afterDrift < beforeDrift;

    // Generate friction copy based on boundary
    const frictionCopy: string[] = [];
    if (boundary === 'DRIFT') {
      frictionCopy.push('This trade moves your portfolio slightly off-target.');
    } else if (boundary === 'STRUCTURAL') {
      frictionCopy.push('This is a significant change to your allocation.');
      frictionCopy.push('Consider rebalancing after this trade.');
    } else if (boundary === 'STRESS') {
      frictionCopy.push('WARNING: This trade significantly deviates from your risk profile.');
      frictionCopy.push('Your portfolio may become unbalanced.');
    }

    return {
      side,
      assetId,
      amountIRR: amountIrr,
      quantity,
      priceUSD: priceUSD,
      spread,
      before,
      after,
      target: targetLayerPct,
      boundary,
      frictionCopy,
      movesTowardTarget,
    };
  },

  execute: async (assetId: AssetId, action: 'BUY' | 'SELL', amountIrr: number): Promise<TradeExecuteResponse> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const { prices, fxRate } = state.prices;
    const { holdings: currentHoldings, cashIRR: currentCash } = state.portfolio;

    // Mock backend calculation (in production, backend computes these values)
    const priceUSD = prices[assetId] || 0;
    const priceIRR = priceUSD * fxRate;
    const quantity = priceIRR > 0 ? amountIrr / priceIRR : 0;

    let newCashIRR: number;
    let newHoldings: typeof currentHoldings;

    if (action === 'BUY') {
      newCashIRR = currentCash - amountIrr;
      const existingIdx = currentHoldings.findIndex((h) => h.assetId === assetId);
      if (existingIdx >= 0) {
        newHoldings = currentHoldings.map((h, i) =>
          i === existingIdx ? { ...h, quantity: h.quantity + quantity } : h
        );
      } else {
        newHoldings = [...currentHoldings, {
          id: `holding_${Date.now()}`,
          assetId,
          quantity,
          frozen: false,
          layer: 'GROWTH' as const,
        }];
      }
    } else {
      newCashIRR = currentCash + amountIrr;
      newHoldings = currentHoldings.map((h) =>
        h.assetId === assetId ? { ...h, quantity: Math.max(0, h.quantity - quantity) } : h
      ).filter((h) => h.quantity > 0);
    }

    store.dispatch(executeTradeAction({
      side: action,
      assetId,
      amountIRR: amountIrr,
      newCashIRR,
      holdings: newHoldings,
      boundary: 'SAFE',
    }));

    const newState = getState();
    const holding = newState.portfolio.holdings.find((h) => h.assetId === assetId);

    return {
      success: true,
      tradeId: `trade_${Date.now()}`,
      assetId,
      side: action,
      amountIrr,
      quantity: holding?.quantity || 0,
      boundary: 'SAFE',
      newHoldingQuantity: holding?.quantity || 0,
    };
  },
};

// Activity APIs
export const activity = {
  getRecent: async (limit = 20): Promise<ActivityResponse> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const activities = state.portfolio.actionLog.slice(0, limit);

    return {
      activities,
      hasMore: state.portfolio.actionLog.length > limit,
      nextCursor: activities.length > 0 ? String(activities[activities.length - 1].id) : undefined,
    };
  },

  getAll: async (cursor?: string): Promise<ActivityResponse> => {
    await delay(MOCK_DELAY);

    const state = getState();
    let activities = state.portfolio.actionLog;

    if (cursor) {
      const cursorIndex = activities.findIndex((a) => String(a.id) === cursor);
      if (cursorIndex >= 0) {
        activities = activities.slice(cursorIndex + 1);
      }
    }

    const pageSize = 20;
    const page = activities.slice(0, pageSize);

    return {
      activities: page,
      hasMore: activities.length > pageSize,
      nextCursor: page.length > 0 ? String(page[page.length - 1].id) : undefined,
    };
  },
};

// Rebalance APIs
export const rebalance = {
  getStatus: async (): Promise<{
    needsRebalance: boolean;
    lastRebalanceAt: string | null;
    canRebalance: boolean;
    reason?: string;
  }> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const needsRebalance = state.portfolio.status !== 'BALANCED';

    return {
      needsRebalance,
      lastRebalanceAt: null,
      canRebalance: needsRebalance,
      reason: needsRebalance ? undefined : 'Portfolio is already balanced',
    };
  },

  preview: async (): Promise<RebalancePreview> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const { holdings, targetLayerPct, cashIRR } = state.portfolio;
    const { prices, fxRate } = state.prices;

    // Calculate current allocation
    const totalValue = calculatePortfolioValue(holdings, prices, fxRate) + cashIRR;
    const layerValues: Record<string, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };

    holdings.forEach((h) => {
      const a = ASSETS[h.assetId];
      if (a) {
        const val = h.assetId === 'IRR_FIXED_INCOME'
          ? h.quantity * FIXED_INCOME_UNIT_PRICE
          : h.quantity * (prices[h.assetId] || 0) * fxRate;
        layerValues[a.layer] += val;
      }
    });

    const before: TargetLayerPct = {
      FOUNDATION: totalValue > 0 ? layerValues.FOUNDATION / totalValue : 0,
      GROWTH: totalValue > 0 ? layerValues.GROWTH / totalValue : 0,
      UPSIDE: totalValue > 0 ? layerValues.UPSIDE / totalValue : 0,
    };

    return {
      mode: 'HOLDINGS_ONLY',
      before,
      after: targetLayerPct,
      target: targetLayerPct,
      trades: [],
      cashDeployed: 0,
      residualDrift: 0,
      hasLockedCollateral: false,
      insufficientCash: false,
    };
  },

  execute: async (): Promise<{
    success: boolean;
    tradesExecuted: number;
    newStatus: PortfolioStatus;
  }> => {
    await delay(MOCK_DELAY);

    store.dispatch(logAction({
      type: 'REBALANCE',
      boundary: 'SAFE',
      message: 'Portfolio rebalanced successfully',
    }));

    return {
      success: true,
      tradesExecuted: 3,
      newStatus: 'BALANCED',
    };
  },
};

// Protection APIs - Updated to match new quote-based flow
// Store for pending quotes (in real implementation this would be server-side)
const pendingQuotes = new Map<string, {
  assetId: AssetId;
  coveragePct: number;
  durationDays: number;
  notionalIrr: number;
  notionalUsd: number;
  premiumIrr: number;
  premiumUsd: number;
  strikeUsd: number;
  expiresAt: Date;
}>();

// Mock volatility data by asset
const MOCK_VOLATILITY: Record<string, number> = {
  BTC: 0.55,
  ETH: 0.65,
  SOL: 0.85,
  PAXG: 0.15,
  KAG: 0.18,
  QQQ: 0.22,
};

// Helper to calculate mock premium using simplified Black-Scholes approximation
const calculateMockPremium = (notionalUsd: number, durationDays: number, volatility: number): number => {
  // Simplified premium calculation: premium ≈ notional * volatility * sqrt(time)
  const timeYears = durationDays / 365;
  const premiumPct = volatility * Math.sqrt(timeYears) * 0.4; // 0.4 is ATM put approximation
  return notionalUsd * premiumPct;
};

export const protection = {
  // Get holdings eligible for protection
  getHoldings: async (): Promise<any[]> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const { holdings } = state.portfolio;
    const { prices, fxRate } = state.prices;

    const protectableAssets = ['BTC', 'ETH', 'SOL', 'PAXG', 'KAG', 'QQQ'];

    return holdings
      .filter((h) => protectableAssets.includes(h.assetId) && !h.frozen && h.quantity > 0)
      .map((h) => {
        const asset = ASSETS[h.assetId];
        const priceUsd = prices[h.assetId] || 0;
        const valueUsd = h.quantity * priceUsd;
        const valueIrr = valueUsd * fxRate;
        const iv = MOCK_VOLATILITY[h.assetId] || 0.5;

        // Check if already has active protection
        const hasProtection = state.portfolio.protections.some(
          (p: any) => p.assetId === h.assetId && p.status === 'ACTIVE'
        );

        return {
          assetId: h.assetId,
          name: asset?.name || h.assetId,
          layer: asset?.layer || 'GROWTH',
          quantity: h.quantity,
          valueIrr,
          valueUsd,
          priceUsd,
          priceIrr: priceUsd * fxRate,
          isProtectable: !hasProtection,
          hasExistingProtection: hasProtection,
          volatility: {
            iv,
            regime: iv < 0.3 ? 'LOW' : iv < 0.6 ? 'NORMAL' : iv < 0.8 ? 'ELEVATED' : 'HIGH',
            regimeColor: iv < 0.3 ? '#22C55E' : iv < 0.6 ? '#3B82F6' : iv < 0.8 ? '#F59E0B' : '#EF4444',
          },
          indicativePremium: {
            thirtyDayPct: calculateMockPremium(1, 30, iv),
            thirtyDayIrr: calculateMockPremium(valueUsd, 30, iv) * fxRate,
          },
        };
      });
  },

  // Get a quote for protection - signature matches real API (uses holdingId)
  getQuote: async (holdingId: string, coveragePct: number = 1.0, durationDays: number = 30): Promise<any> => {
    await delay(MOCK_DELAY);

    const state = getState();
    // holdingId in mock is typically the assetId (e.g., 'demo-BTC' or just 'BTC')
    const holding = state.portfolio.holdings.find((h: any) =>
      h.id === holdingId || h.assetId === holdingId || `demo-${h.assetId}` === holdingId
    );
    const { prices, fxRate } = state.prices;

    if (!holding) {
      throw new Error(`No holding found for ${holdingId}`);
    }

    const assetId = holding.assetId as AssetId;
    const priceUsd = prices[assetId] || 0;
    const holdingValueUsd = holding.quantity * priceUsd;
    const holdingValueIrr = holdingValueUsd * fxRate;

    const notionalUsd = holdingValueUsd * coveragePct;
    const notionalIrr = holdingValueIrr * coveragePct;

    const iv = MOCK_VOLATILITY[assetId] || 0.5;
    const premiumUsd = calculateMockPremium(notionalUsd, durationDays, iv);
    const premiumIrr = premiumUsd * fxRate;

    const strikeUsd = priceUsd; // ATM strike (100%)

    // Generate quote ID and store
    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    pendingQuotes.set(quoteId, {
      assetId,
      coveragePct,
      durationDays,
      notionalIrr,
      notionalUsd,
      premiumIrr,
      premiumUsd,
      strikeUsd,
      expiresAt,
    });

    // Calculate breakeven
    const breakevenDrop = premiumUsd / notionalUsd;

    return {
      quoteId,
      assetId,
      holdingValueIrr,
      holdingValueUsd,
      coveragePct,
      notionalIrr,
      notionalUsd,
      durationDays,
      strikeUsd,
      strikePct: 1.0,
      premiumIrr,
      premiumUsd,
      premiumPct: premiumUsd / notionalUsd,
      annualizedPct: (premiumUsd / notionalUsd) * (365 / durationDays),
      breakeven: {
        priceDrop: breakevenDrop,
        priceUsd: strikeUsd * (1 - breakevenDrop),
      },
      greeks: {
        delta: -0.5,
        gamma: 0.01,
        vega: notionalUsd * 0.01,
        theta: -premiumUsd / durationDays,
      },
      volatility: {
        iv,
        regime: iv < 0.3 ? 'LOW' : iv < 0.6 ? 'NORMAL' : iv < 0.8 ? 'ELEVATED' : 'HIGH',
      },
      expiresAt: expiresAt.toISOString(),
      validForSeconds: 300,
    };
  },

  // Get premium curve for all duration presets
  getPremiumCurve: async (assetId: AssetId, coveragePct: number = 1.0): Promise<any[]> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const holding = state.portfolio.holdings.find((h: any) => h.assetId === assetId);
    const { prices, fxRate } = state.prices;

    if (!holding) {
      throw new Error(`No holding found for ${assetId}`);
    }

    const priceUsd = prices[assetId] || 0;
    const holdingValueUsd = holding.quantity * priceUsd;
    const notionalUsd = holdingValueUsd * coveragePct;

    const iv = MOCK_VOLATILITY[assetId] || 0.5;

    const durations = [7, 14, 30, 60, 90, 180];

    return durations.map((durationDays) => {
      const premiumUsd = calculateMockPremium(notionalUsd, durationDays, iv);
      const premiumIrr = premiumUsd * fxRate;
      const premiumPct = premiumUsd / notionalUsd;

      return {
        durationDays,
        premiumIrr,
        premiumPct,
        annualizedPct: premiumPct * (365 / durationDays),
      };
    });
  },

  // Purchase protection using a quote - signature matches real API
  purchase: async (params: {
    quoteId: string;
    holdingId: string;
    coveragePct: number;
    durationDays: number;
    premiumIrr: number;
    acknowledgedPremium: boolean;
  }): Promise<Protection> => {
    await delay(MOCK_DELAY);

    const quote = pendingQuotes.get(params.quoteId);
    if (!quote) {
      throw new Error('Quote not found or expired');
    }

    if (new Date() > quote.expiresAt) {
      pendingQuotes.delete(params.quoteId);
      throw new Error('Quote has expired');
    }

    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + quote.durationDays);

    const asset = ASSETS[quote.assetId];

    const newProtection: Protection = {
      id: `protection_${Date.now()}`,
      assetId: quote.assetId,
      notionalIrr: quote.notionalIrr,
      notionalUsd: quote.notionalUsd,
      premiumIrr: quote.premiumIrr,
      premiumUsd: quote.premiumUsd,
      coveragePct: quote.coveragePct,
      durationDays: quote.durationDays,
      strikeUsd: quote.strikeUsd,
      startDate: now.toISOString(),
      expiryDate: expiryDate.toISOString(),
      status: 'ACTIVE',
      daysRemaining: quote.durationDays,
      // Aliases for API compatibility
      notionalIRR: quote.notionalIrr,
      premiumIRR: quote.premiumIrr,
      startISO: now.toISOString(),
      endISO: expiryDate.toISOString(),
    };

    // Clean up quote
    pendingQuotes.delete(params.quoteId);

    store.dispatch(addProtection(newProtection));
    store.dispatch(logAction({
      type: 'PROTECT',
      boundary: 'SAFE',
      message: `Added protection for ${asset?.name || quote.assetId}`,
      amountIRR: quote.premiumIrr,
      assetId: quote.assetId,
    }));

    return newProtection;
  },

  // Get active protections
  getActive: async (): Promise<Protection[]> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const protections = state.portfolio.protections || [];

    // Filter active and calculate days remaining with label
    return protections
      .filter((p: any) => p.status === 'ACTIVE')
      .map((p: any) => {
        const expiryDate = new Date(p.expiryDate || p.endISO);
        const daysRemaining = Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        // Human-readable label for days remaining
        const daysRemainingLabel = daysRemaining === 0 ? 'Expires today' :
          daysRemaining === 1 ? '1 day remaining' :
          `${daysRemaining} days remaining`;
        return {
          ...p,
          daysRemaining,
          daysRemainingLabel,
        };
      });
  },

  // Get protection history
  getHistory: async (_page: number = 1, _limit: number = 20): Promise<Protection[]> => {
    await delay(MOCK_DELAY);

    const state = getState();
    return state.portfolio.protections || [];
  },

  // Get volatility info for an asset
  getVolatility: async (assetId: AssetId): Promise<any> => {
    await delay(MOCK_DELAY);

    const iv = MOCK_VOLATILITY[assetId] || 0.5;
    const regime = iv < 0.3 ? 'LOW' : iv < 0.6 ? 'NORMAL' : iv < 0.8 ? 'ELEVATED' : 'HIGH';

    const descriptions: Record<string, string> = {
      LOW: 'Market volatility is unusually low. Protection is relatively cheap.',
      NORMAL: 'Market volatility is at normal levels.',
      ELEVATED: 'Market volatility is elevated. Protection costs more but may be valuable.',
      HIGH: 'Market volatility is high. Protection is expensive but risk is elevated.',
    };

    const colors: Record<string, string> = {
      LOW: '#22C55E',
      NORMAL: '#3B82F6',
      ELEVATED: '#F59E0B',
      HIGH: '#EF4444',
    };

    return {
      assetId,
      baseVolatility: iv,
      adjustedVolatility: iv,
      regime,
      regimeDescription: descriptions[regime],
      regimeColor: colors[regime],
      termStructure: [7, 14, 30, 60, 90, 180].map((days) => ({
        durationDays: days,
        multiplier: days <= 14 ? 1.15 : days <= 30 ? 1.0 : days <= 90 ? 0.95 : 0.90,
        adjustedIv: iv * (days <= 14 ? 1.15 : days <= 30 ? 1.0 : days <= 90 ? 0.95 : 0.90),
      })),
    };
  },

  // Cancel protection
  cancel: async (protectionId: string): Promise<{ success: boolean }> => {
    await delay(MOCK_DELAY);

    store.dispatch(removeProtection(protectionId));
    store.dispatch(logAction({
      type: 'CANCEL_PROTECTION',
      boundary: 'SAFE',
      message: 'Protection cancelled',
    }));

    return { success: true };
  },

  // Legacy: getEligible for backwards compatibility
  getEligible: async (): Promise<EligibleAssetsResponse> => {
    const holdings = await protection.getHoldings();
    return {
      assets: holdings.map((h) => ({
        assetId: h.assetId as AssetId,
        holdingQuantity: h.quantity,
        holdingValueIrr: h.valueIrr,
        premiumRatePerMonth: h.indicativePremium.thirtyDayPct,
        estimatedPremiumIrr: h.indicativePremium.thirtyDayIrr,
      })),
    };
  },
};

// Loans APIs
export const loans = {
  getAll: async (): Promise<LoansResponse> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const { holdings } = state.portfolio;
    const { prices, fxRate } = state.prices;

    // Enhance loans with computed fields: remainingIrr, ltv
    const enhancedLoans = state.portfolio.loans.map((loan: Loan) => {
      // Calculate remaining amount from unpaid installments
      const remainingIrr = loan.installments
        .filter((i) => i.status !== 'PAID')
        .reduce((sum, i) => sum + i.totalIRR - i.paidIRR, 0);

      // Calculate LTV based on current collateral value
      const collateralHolding = holdings.find((h: Holding) => h.assetId === loan.collateralAssetId);
      let collateralValueIrr = 0;
      if (collateralHolding) {
        if (loan.collateralAssetId === 'IRR_FIXED_INCOME') {
          collateralValueIrr = loan.collateralQuantity * FIXED_INCOME_UNIT_PRICE;
        } else {
          const priceUsd = prices[loan.collateralAssetId] || 0;
          collateralValueIrr = loan.collateralQuantity * priceUsd * fxRate;
        }
      }
      const ltv = collateralValueIrr > 0 ? loan.amountIRR / collateralValueIrr : 0;

      return {
        ...loan,
        remainingIrr,
        ltv,
      };
    });

    return {
      loans: enhancedLoans,
    };
  },

  getCapacity: async (): Promise<LoanCapacityResponse> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const { holdings, loans: existingLoans, cashIRR } = state.portfolio;
    const { prices, fxRate } = state.prices;

    const portfolioValue = calculatePortfolioValue(holdings, prices, fxRate) + cashIRR;
    const maxCapacity = portfolioValue * 0.25;
    const usedCapacity = existingLoans.reduce((sum, l) => {
      const remaining = l.installments
        .filter((i) => i.status !== 'PAID')
        .reduce((s, i) => s + i.totalIRR - i.paidIRR, 0);
      return sum + remaining;
    }, 0);

    return {
      availableIrr: Math.max(0, maxCapacity - usedCapacity),
      usedIrr: usedCapacity,
      maxCapacityIrr: maxCapacity,
      portfolioValueIrr: portfolioValue,
    };
  },

  // Preview endpoint - returns backend-calculated loan details
  // ⚠️ BUG-016 WARNING: MOCK/DEMO USE ONLY
  // This function performs client-side interest calculations (durationDays/30, interest math)
  // which violates the "no frontend calculations" rule for production.
  // This mock simulates backend behavior for offline demo mode only.
  // PRODUCTION: Backend /loans/preview endpoint is authoritative for all loan calculations.
  preview: async (collateralAssetId: string, amountIrr: number, durationDays: 90 | 180) => {
    await delay(MOCK_DELAY / 2); // Faster for preview

    const state = getState();
    const { holdings } = state.portfolio;
    const { prices, fxRate } = state.prices;

    // Find holding
    const holding = holdings.find((h) => h.assetId === collateralAssetId);
    if (!holding) {
      throw new Error('Holding not found');
    }

    // Calculate collateral value
    const priceUsd = prices[collateralAssetId as AssetId] || 0;
    const collateralValueIrr = collateralAssetId === 'IRR_FIXED_INCOME'
      ? holding.quantity * FIXED_INCOME_UNIT_PRICE
      : holding.quantity * priceUsd * fxRate;

    const asset = ASSETS[collateralAssetId as AssetId];
    const maxLtv = asset?.ltv || 0.5;
    const maxLoanIrr = collateralValueIrr * maxLtv;

    // PRD: 30% APR
    const interestRate = 0.30;
    const durationMonths = durationDays / 30;
    const totalInterestIrr = Math.round(amountIrr * interestRate * (durationMonths / 12));
    const totalRepaymentIrr = amountIrr + totalInterestIrr;

    // PRD: 6 installments
    const numInstallments = 6;
    const installmentAmountIrr = Math.ceil(totalRepaymentIrr / numInstallments);

    // Generate installment schedule
    const startDate = new Date();
    const installments = [];
    const daysPerInstallment = durationDays / numInstallments;

    for (let i = 1; i <= numInstallments; i++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + Math.round(daysPerInstallment * i));
      installments.push({
        number: i,
        dueDate: dueDate.toISOString(),
        principalIrr: Math.round(amountIrr / numInstallments),
        interestIrr: Math.round(totalInterestIrr / numInstallments),
        totalIrr: installmentAmountIrr,
      });
    }

    return {
      valid: amountIrr <= maxLoanIrr,
      collateralAssetId,
      collateralValueIrr,
      maxLtv,
      maxLoanIrr,
      principalIrr: amountIrr,
      interestRate,
      effectiveAPR: interestRate * 100,
      durationMonths,
      totalInterestIrr,
      totalRepaymentIrr,
      numInstallments,
      installmentAmountIrr,
      installments,
    };
  },

  // Signature matches real API: (collateralAssetId, amountIrr, durationDays)
  // Per PRD: 30% APR, 3/6 month terms (90/180 days), 6 installments
  create: async (collateralAssetId: string, amountIrr: number, durationDays: 90 | 180): Promise<Loan> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const { holdings } = state.portfolio;
    const { prices, fxRate } = state.prices;

    // Find the specified collateral holding, or auto-select if not found
    let collateralHolding = holdings.find((h) => h.assetId === collateralAssetId && !h.frozen && h.quantity > 0);

    if (!collateralHolding) {
      // Auto-select the best collateral (highest value unfrozen holding)
      const availableHoldings = holdings
        .filter((h) => !h.frozen && h.quantity > 0)
        .map((h) => {
          const priceUsd = prices[h.assetId] || 0;
          const valueIrr = h.assetId === 'IRR_FIXED_INCOME'
            ? h.quantity * FIXED_INCOME_UNIT_PRICE
            : h.quantity * priceUsd * fxRate;
          return { ...h, valueIrr };
        })
        .sort((a, b) => b.valueIrr - a.valueIrr);

      collateralHolding = availableHoldings[0];
    }

    if (!collateralHolding) {
      throw new Error('No available collateral found');
    }

    const finalCollateralAssetId = collateralHolding.assetId;

    // PRD: 30% APR
    const dailyRate = 0.30 / 365;
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + durationDays);

    const installments: LoanInstallment[] = [];
    // PRD: Always 6 installments
    const numInstallments = 6;
    const principalPerInstallment = amountIrr / numInstallments;
    const daysPerInstallment = durationDays / numInstallments;

    for (let i = 1; i <= numInstallments; i++) {
      const installmentDate = new Date(now);
      installmentDate.setDate(installmentDate.getDate() + Math.round(daysPerInstallment * i));

      const remainingPrincipal = amountIrr - (principalPerInstallment * (i - 1));
      const interestIrr = remainingPrincipal * dailyRate * daysPerInstallment;

      installments.push({
        number: i,
        dueISO: installmentDate.toISOString(),
        principalIRR: principalPerInstallment,
        interestIRR: interestIrr,
        totalIRR: principalPerInstallment + interestIrr,
        paidIRR: 0,
        status: 'PENDING',
      });
    }

    const totalInterest = amountIrr * dailyRate * durationDays;
    const newLoan: Loan = {
      id: `loan_${Date.now()}`,
      collateralAssetId: finalCollateralAssetId,
      collateralQuantity: collateralHolding.quantity * 0.5,
      amountIRR: amountIrr,
      dailyInterestRate: dailyRate,
      interestRate: 0.30, // 30% APR per PRD
      durationDays: durationDays as 90 | 180,
      startISO: now.toISOString(),
      dueISO: dueDate.toISOString(),
      status: 'ACTIVE',
      totalInterestIRR: totalInterest,
      totalRepaymentIRR: amountIrr + totalInterest,
      totalDueIRR: amountIrr + totalInterest,
      paidIRR: 0,
      installments,
      installmentsPaid: 0,
    };

    store.dispatch(addLoan(newLoan));
    store.dispatch(logAction({
      type: 'BORROW',
      boundary: 'SAFE',
      message: `Borrowed ${amountIrr.toLocaleString()} IRR`,
      amountIRR: amountIrr,
    }));

    return newLoan;
  },

  repay: async (loanId: string, amountIrr: number): Promise<{
    success: boolean;
    remainingBalance: number;
    installmentsPaid: number;
  }> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const loan = state.portfolio.loans.find((l) => l.id === loanId);

    if (!loan) {
      throw new Error(`Loan ${loanId} not found`);
    }

    let remainingPayment = amountIrr;
    const updatedInstallments = loan.installments.map((inst) => {
      if (inst.status === 'PAID' || remainingPayment <= 0) {
        return inst;
      }

      const owed = inst.totalIRR - inst.paidIRR;
      const payment = Math.min(remainingPayment, owed);
      remainingPayment -= payment;

      const newPaid = inst.paidIRR + payment;
      const newStatus: 'PENDING' | 'PARTIAL' | 'PAID' =
        newPaid >= inst.totalIRR ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'PENDING';

      return {
        ...inst,
        paidIRR: newPaid,
        status: newStatus,
      };
    });

    const installmentsPaid = updatedInstallments.filter((i) => i.status === 'PAID').length;
    const remainingBalance = updatedInstallments
      .filter((i) => i.status !== 'PAID')
      .reduce((sum, i) => sum + i.totalIRR - i.paidIRR, 0);

    const updatedLoan: Loan = {
      ...loan,
      installments: updatedInstallments,
      installmentsPaid,
      status: remainingBalance <= 0 ? 'REPAID' : 'ACTIVE',
    };

    store.dispatch(updateLoan(updatedLoan));
    store.dispatch(logAction({
      type: 'REPAY',
      boundary: 'SAFE',
      message: `Repaid ${amountIrr.toLocaleString()} IRR`,
      amountIRR: amountIrr,
    }));

    return {
      success: true,
      remainingBalance,
      installmentsPaid,
    };
  },
};

// Prices APIs
export const prices = {
  getAll: async (): Promise<PricesResponse> => {
    await delay(MOCK_DELAY);

    const state = getState();
    return {
      prices: state.prices.prices,
      fxRate: state.prices.fxRate,
      timestamp: state.prices.updatedAt,
    };
  },
};

// User APIs
export const user = {
  getProfile: async (): Promise<UserProfile> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const { riskProfile } = state.onboarding;

    return {
      id: 'demo_user',
      phone: '+989123456789',
      riskScore: riskProfile?.score || 6,
      riskTier: Math.ceil((riskProfile?.score || 6) / 2),
      profileName: riskProfile?.profileName || 'Balanced',
      profileNameFa: riskProfile?.profileNameFarsi || 'متعادل',
      createdAt: new Date().toISOString(),
    };
  },

  updateSettings: async (settings: Partial<UserSettings>): Promise<UserSettings> => {
    await delay(MOCK_DELAY);

    return {
      language: settings.language || 'en',
      notifications: settings.notifications ?? true,
      biometricEnabled: settings.biometricEnabled ?? false,
    };
  },
};
