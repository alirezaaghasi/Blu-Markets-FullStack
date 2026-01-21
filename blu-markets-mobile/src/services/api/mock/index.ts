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
import type {
  AssetId,
  Holding,
  Loan,
  Protection,
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

    // Calculate risk score from answers (simplified)
    const totalScore = answers.reduce((sum, a) => sum + a.value, 0);
    const avgScore = totalScore / answers.length;
    const riskScore = Math.min(10, Math.max(1, Math.round(avgScore)));
    const riskTier = Math.ceil(riskScore / 2);

    const profileNames = RISK_PROFILE_NAMES[riskScore] || { en: 'Balanced', fa: 'متعادل' };
    const targetAllocation = RISK_PROFILE_ALLOCATIONS[riskScore] || {
      FOUNDATION: 0.50,
      GROWTH: 0.35,
      UPSIDE: 0.15,
    };

    store.dispatch(setRiskProfile({
      score: riskScore,
      profileName: profileNames.en,
      profileNameFarsi: profileNames.fa,
      targetAllocation,
    }));

    return {
      riskScore,
      riskTier,
      profileName: profileNames.en,
      riskProfile: {
        name: profileNames.en,
        nameFa: profileNames.fa,
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

    store.dispatch(executeTradeAction({
      side: action,
      assetId,
      amountIRR: amountIrr,
      priceUSD: prices[assetId] || 0,
      fxRate,
    }));

    const newState = getState();
    const holding = newState.portfolio.holdings.find((h) => h.assetId === assetId);

    return {
      success: true,
      tradeId: `trade_${Date.now()}`,
      assetId,
      action,
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

// Protection APIs
export const protection = {
  getActive: async (): Promise<ProtectionsResponse> => {
    await delay(MOCK_DELAY);

    const state = getState();
    return {
      protections: state.portfolio.protections,
    };
  },

  getEligible: async (): Promise<EligibleAssetsResponse> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const { holdings } = state.portfolio;
    const { prices, fxRate } = state.prices;

    const eligibleAssets = holdings
      .filter((h) => {
        const asset = ASSETS[h.assetId];
        return asset?.protectionEligible && !h.frozen;
      })
      .map((h) => {
        const asset = ASSETS[h.assetId];
        const priceUsd = prices[h.assetId] || 0;
        const valueIrr = h.assetId === 'IRR_FIXED_INCOME'
          ? h.quantity * FIXED_INCOME_UNIT_PRICE
          : h.quantity * priceUsd * fxRate;

        const premiumRate = asset?.layer === 'FOUNDATION' ? 0.004 : asset?.layer === 'GROWTH' ? 0.008 : 0.012;

        return {
          assetId: h.assetId,
          holdingQuantity: h.quantity,
          holdingValueIrr: valueIrr,
          premiumRatePerMonth: premiumRate,
          estimatedPremiumIrr: valueIrr * premiumRate,
        };
      });

    return { assets: eligibleAssets };
  },

  purchase: async (assetId: AssetId, notionalIrr: number, durationMonths: number): Promise<Protection> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const holding = state.portfolio.holdings.find((h) => h.assetId === assetId);
    const { prices, fxRate } = state.prices;

    if (!holding) {
      throw new Error(`No holding found for ${assetId}`);
    }

    const asset = ASSETS[assetId];

    const premiumRate = asset?.layer === 'FOUNDATION' ? 0.004 : asset?.layer === 'GROWTH' ? 0.008 : 0.012;
    const premiumIrr = notionalIrr * premiumRate * durationMonths;

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    const newProtection: Protection = {
      id: `protection_${Date.now()}`,
      assetId,
      notionalIRR: notionalIrr,
      premiumIRR: premiumIrr,
      startISO: now.toISOString(),
      endISO: endDate.toISOString(),
      durationMonths,
    };

    store.dispatch(addProtection(newProtection));
    store.dispatch(logAction({
      type: 'PROTECT',
      boundary: 'SAFE',
      message: `Added protection for ${asset?.name || assetId}`,
      amountIRR: premiumIrr,
      assetId,
    }));

    return newProtection;
  },

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
};

// Loans APIs
export const loans = {
  getAll: async (): Promise<LoansResponse> => {
    await delay(MOCK_DELAY);

    const state = getState();
    return {
      loans: state.portfolio.loans,
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

  create: async (collateralAssetId: string, amountIrr: number, durationMonths: 3 | 6): Promise<Loan> => {
    await delay(MOCK_DELAY);

    const state = getState();
    const { holdings } = state.portfolio;

    // Find the specified collateral holding
    const collateralHolding = holdings.find((h) => h.assetId === collateralAssetId);

    if (!collateralHolding) {
      throw new Error(`Collateral asset ${collateralAssetId} not found`);
    }

    if (collateralHolding.frozen) {
      throw new Error('Asset is already used as collateral');
    }

    const interestRate = 0.30;
    const monthlyRate = interestRate / 12;
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setMonth(dueDate.getMonth() + durationMonths);

    const installments: LoanInstallment[] = [];
    const principalPerInstallment = amountIrr / durationMonths;

    for (let i = 1; i <= durationMonths; i++) {
      const installmentDate = new Date(now);
      installmentDate.setMonth(installmentDate.getMonth() + i);

      const remainingPrincipal = amountIrr - (principalPerInstallment * (i - 1));
      const interestIrr = remainingPrincipal * monthlyRate;

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

    const newLoan: Loan = {
      id: `loan_${Date.now()}`,
      collateralAssetId,
      collateralQuantity: collateralHolding.quantity * 0.5,
      amountIRR: amountIrr,
      interestRate,
      durationMonths,
      startISO: now.toISOString(),
      dueISO: dueDate.toISOString(),
      status: 'ACTIVE',
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
