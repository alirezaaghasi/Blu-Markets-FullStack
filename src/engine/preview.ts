import type { AppState, Holding, Layer, AssetId, TradeSide, RebalanceMode, RebalanceTrade, TargetLayerPct, IntraLayerWeightResult, StrategyPreset, LoanInstallment } from '../types';
import { computeSnapshot } from './snapshot';
import { calcPremiumIRR, calcLiquidationIRR } from './pricing';
import { ASSET_LAYER, LAYER_ASSETS } from '../state/domain';
import { COLLATERAL_LTV_BY_LAYER, LAYERS, DEFAULT_PRICES, DEFAULT_FX_RATE, WEIGHTS, STRATEGY_PRESETS, LOAN_INTEREST_RATE } from '../constants/index';
import { irrToFixedIncomeUnits } from './fixedIncome';
import { getAssetPriceUSD } from '../helpers';
import { IntraLayerBalancer, MarketDataProvider } from './intraLayerBalancer';

/**
 * Generate 6 installment schedule for a loan
 */
function generateInstallments(
  principalIRR: number,
  startISO: string,
  durationMonths: 3 | 6,
  interestRate: number = LOAN_INTEREST_RATE
): LoanInstallment[] {
  const INSTALLMENT_COUNT = 6;
  const installments: LoanInstallment[] = [];

  // Calculate total interest for full term
  const totalInterest = Math.floor(principalIRR * interestRate * (durationMonths / 12));

  // Equal principal + interest per installment
  const principalPerInstallment = Math.floor(principalIRR / INSTALLMENT_COUNT);
  const interestPerInstallment = Math.floor(totalInterest / INSTALLMENT_COUNT);

  // Days between installments
  const totalDays = durationMonths * 30;
  const daysPerInstallment = Math.floor(totalDays / INSTALLMENT_COUNT);

  const startDate = new Date(startISO);

  for (let i = 0; i < INSTALLMENT_COUNT; i++) {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + (daysPerInstallment * (i + 1)));

    // Last installment gets rounding remainder
    const isLast = i === INSTALLMENT_COUNT - 1;
    const principal = isLast
      ? principalIRR - (principalPerInstallment * (INSTALLMENT_COUNT - 1))
      : principalPerInstallment;
    const interest = isLast
      ? totalInterest - (interestPerInstallment * (INSTALLMENT_COUNT - 1))
      : interestPerInstallment;

    installments.push({
      number: i + 1,
      dueISO: dueDate.toISOString().slice(0, 10),
      principalIRR: principal,
      interestIRR: interest,
      totalIRR: principal + interest,
      status: 'PENDING',
      paidIRR: 0,
    });
  }

  return installments;
}

export interface GapAnalysis {
  hasFrozenAssets: boolean;
  frozenByLayer: Record<Layer, number>;
  currentPct: TargetLayerPct;
  achievablePct: Record<Layer, number>;
  remainingGapPct: number;
  gapByLayer: Record<Layer, number>;
  canAchievePerfectBalance: boolean;
  canAchieveWithCash: boolean;
  cashNeededForPerfectBalance: number;
  currentCash: number;
  cashSufficient: boolean;
  cashShortfall: number;
  cashWouldHelp: boolean;
  partialCashBenefit: number;
  targetPct: TargetLayerPct;
}

interface RebalanceMetaInternal {
  hasLockedCollateral: boolean;
  insufficientCash: boolean;
  residualDrift: number;
  trades: RebalanceTrade[];
  cashDeployed: number;
  intraLayerWeights: Record<Layer, IntraLayerWeightResult>;
  strategy: string;
}

// Extended holding type with computed value
interface HoldingWithComputed extends Holding {
  _computedIRR?: number;
}

// Extended app state with rebalance meta
interface AppStateWithMeta extends AppState {
  _rebalanceMeta?: RebalanceMetaInternal;
}

/**
 * Calculate rebalance gap - determines if locked collateral prevents full rebalancing
 * and how much additional capital could close the gap.
 */
export function calculateRebalanceGap(
  state: AppState,
  prices: Record<string, number> = DEFAULT_PRICES,
  fxRate: number = DEFAULT_FX_RATE
): GapAnalysis {
  const snap = computeSnapshot(state.holdings, state.cashIRR, prices, fxRate);
  const holdingsTotal = snap.holdingsIRR || 1;
  const assetIRRMap = snap.holdingsIRRByAsset || {};

  // Find frozen (locked) assets and their values
  const frozenByLayer: Record<Layer, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  const unfrozenByLayer: Record<Layer, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  let hasFrozenAssets = false;

  for (const h of state.holdings) {
    const layer = ASSET_LAYER[h.assetId] as Layer;
    const holdingIRR = assetIRRMap[h.assetId] || 0;
    if (layer && holdingIRR > 0) {
      if (h.frozen) {
        frozenByLayer[layer] += holdingIRR;
        hasFrozenAssets = true;
      } else {
        unfrozenByLayer[layer] += holdingIRR;
      }
    }
  }

  // Current layer values
  const currentIRR = { ...snap.layerIRR };

  // Consolidated single-pass calculation of targets, movables, and deficits
  const targetIRR: Record<string, number> = {};
  const movableFromLayer: Record<string, number> = {};
  const deficitByLayer: Record<string, number> = {};
  let totalMovable = 0;
  let totalDeficit = 0;

  for (const layer of LAYERS) {
    // Target values for current holdings total
    targetIRR[layer] = (state.targetLayerPct[layer as Layer] / 100) * holdingsTotal;

    // Calculate surplus and movable amount (can only sell unfrozen portion)
    const surplus = Math.max(0, currentIRR[layer as Layer] - targetIRR[layer]);
    const movable = Math.min(surplus, unfrozenByLayer[layer as Layer]);
    movableFromLayer[layer] = movable;
    totalMovable += movable;

    // Calculate deficit
    const deficit = Math.max(0, targetIRR[layer] - currentIRR[layer as Layer]);
    deficitByLayer[layer] = deficit;
    totalDeficit += deficit;
  }

  // Simulate what HOLDINGS_ONLY rebalance can achieve
  const achievableIRR = { ...currentIRR };

  // Amount that can actually be rebalanced
  const actuallyMovable = Math.min(totalMovable, totalDeficit);

  // Apply the moves to get achievable allocation
  if (actuallyMovable > 0 && totalMovable > 0 && totalDeficit > 0) {
    for (const layer of LAYERS) {
      if (movableFromLayer[layer] > 0) {
        const proportion = movableFromLayer[layer] / totalMovable;
        achievableIRR[layer as Layer] -= actuallyMovable * proportion;
      }
    }
    for (const layer of LAYERS) {
      if (deficitByLayer[layer] > 0) {
        const proportion = deficitByLayer[layer] / totalDeficit;
        achievableIRR[layer as Layer] += actuallyMovable * proportion;
      }
    }
  }

  // Convert achievable to percentages
  const achievablePct: Record<Layer, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  for (const layer of LAYERS) {
    achievablePct[layer as Layer] = Math.round((achievableIRR[layer as Layer] / holdingsTotal) * 100);
  }

  // Calculate remaining gap after HOLDINGS_ONLY rebalance
  let remainingGapPct = 0;
  const gapByLayer: Record<Layer, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  for (const layer of LAYERS) {
    const gap = Math.abs(achievablePct[layer as Layer] - state.targetLayerPct[layer as Layer]);
    gapByLayer[layer as Layer] = gap;
    remainingGapPct += gap;
  }

  // Calculate how much cash would achieve perfect balance
  let cashNeededForPerfectBalance = 0;

  for (const layer of LAYERS) {
    const layerValue = achievableIRR[layer as Layer];
    const targetPct = state.targetLayerPct[layer as Layer] / 100;
    const targetValue = targetPct * holdingsTotal;

    if (layerValue > targetValue + 1) {
      const requiredTotal = layerValue / targetPct;
      const additionalNeeded = requiredTotal - holdingsTotal;
      if (additionalNeeded > cashNeededForPerfectBalance) {
        cashNeededForPerfectBalance = additionalNeeded;
      }
    }
  }

  cashNeededForPerfectBalance = Math.ceil(Math.max(0, cashNeededForPerfectBalance));

  const currentCash = state.cashIRR;
  const cashSufficient = currentCash >= cashNeededForPerfectBalance;
  const cashShortfall = Math.max(0, cashNeededForPerfectBalance - currentCash);

  // Determine if using available cash would help
  let cashWouldHelp = false;
  let partialCashBenefit = 0;

  if (currentCash > 0 && remainingGapPct > 0) {
    const deficits: Record<string, number> = {};
    let localTotalDeficit = 0;
    for (const layer of LAYERS) {
      const targetValue = (state.targetLayerPct[layer as Layer] / 100) * (holdingsTotal + currentCash);
      const deficit = Math.max(0, targetValue - achievableIRR[layer as Layer]);
      deficits[layer] = deficit;
      localTotalDeficit += deficit;
    }

    const newLayerValues = { ...achievableIRR };
    if (localTotalDeficit > 0) {
      const cashToDeploy = Math.min(currentCash, localTotalDeficit);
      for (const layer of LAYERS) {
        if (deficits[layer] > 0) {
          const portion = (deficits[layer] / localTotalDeficit) * cashToDeploy;
          newLayerValues[layer as Layer] += portion;
        }
      }
    }

    const newTotal = holdingsTotal + Math.min(currentCash, localTotalDeficit);
    let newGapPct = 0;
    for (const layer of LAYERS) {
      const newLayerPct = (newLayerValues[layer as Layer] / newTotal) * 100;
      newGapPct += Math.abs(newLayerPct - state.targetLayerPct[layer as Layer]);
    }

    if (newGapPct < remainingGapPct) {
      cashWouldHelp = true;
      partialCashBenefit = remainingGapPct - newGapPct;
    }
  }

  const canAchieveWithHoldingsOnly = remainingGapPct < 1;
  const canAchieveWithCash = cashSufficient || cashNeededForPerfectBalance === 0;

  return {
    hasFrozenAssets,
    frozenByLayer,
    currentPct: snap.layerPct,
    achievablePct,
    remainingGapPct: Math.round(remainingGapPct),
    gapByLayer,
    canAchievePerfectBalance: canAchieveWithHoldingsOnly,
    canAchieveWithCash,
    cashNeededForPerfectBalance,
    currentCash,
    cashSufficient,
    cashShortfall: Math.ceil(cashShortfall),
    cashWouldHelp,
    partialCashBenefit: Math.round(partialCashBenefit),
    targetPct: state.targetLayerPct,
  };
}

/**
 * Create a deep clone of state for preview mutations
 */
export function cloneState(state: AppState): AppState {
  return {
    ...state,
    holdings: state.holdings.map((h) => ({ ...h })),
    protections: state.protections.map((p) => ({ ...p })),
    loans: (state.loans || []).map((l) => ({ ...l })),
    ledger: state.ledger.slice(),
    pendingAction: null,
  };
}

interface AddFundsPayload {
  amountIRR: number;
}

/**
 * Preview adding funds to cash balance
 */
export function previewAddFunds(state: AppState, { amountIRR }: AddFundsPayload): AppState {
  const next = cloneState(state);
  next.cashIRR += amountIRR;
  return next;
}

interface TradePayload {
  side: TradeSide;
  assetId: AssetId;
  amountIRR: number;
  prices?: Record<string, number>;
  fxRate?: number;
}

/**
 * Preview a trade action (BUY or SELL)
 * v10: Updates quantity instead of valueIRR for quantity-based holdings
 */
export function previewTrade(
  state: AppState,
  { side, assetId, amountIRR, prices = DEFAULT_PRICES, fxRate = DEFAULT_FX_RATE }: TradePayload
): AppState {
  const next = cloneState(state);
  const h = next.holdings.find((x) => x.assetId === assetId);
  if (!h) return next;

  let quantityChange: number;
  if (assetId === 'IRR_FIXED_INCOME') {
    quantityChange = irrToFixedIncomeUnits(amountIRR);
  } else {
    const priceUSD = getAssetPriceUSD(assetId, prices) || 1;
    quantityChange = amountIRR / (priceUSD * fxRate);
  }

  if (side === 'BUY') {
    next.cashIRR -= amountIRR;
    h.quantity += quantityChange;
  } else {
    h.quantity = Math.max(0, h.quantity - quantityChange);
    next.cashIRR += amountIRR;
  }
  return next;
}

interface ProtectPayload {
  assetId: AssetId;
  months: number;
  prices?: Record<string, number>;
  fxRate?: number;
}

/**
 * Preview a protect action
 * v10: Computes notionalIRR from quantity × price × fxRate
 */
export function previewProtect(
  state: AppState,
  { assetId, months, prices = DEFAULT_PRICES, fxRate = DEFAULT_FX_RATE }: ProtectPayload
): AppState {
  const next = cloneState(state);
  const h = next.holdings.find((x) => x.assetId === assetId);
  if (!h) return next;

  const snap = computeSnapshot([h], 0, prices, fxRate);
  const notionalIRR = snap.holdingsIRRByAsset[assetId] || 0;

  const premiumIRR = calcPremiumIRR({ assetId, notionalIRR, months });
  next.cashIRR = Math.max(0, next.cashIRR - premiumIRR);
  return next;
}

interface BorrowPayload {
  assetId: AssetId;
  amountIRR: number;
  durationMonths?: 3 | 6;
}

/**
 * Preview a borrow action
 */
export function previewBorrow(state: AppState, { assetId, amountIRR, durationMonths = 3 }: BorrowPayload): AppState {
  const next = cloneState(state);
  const h = next.holdings.find((x) => x.assetId === assetId);
  if (!h) return next;

  const layer = ASSET_LAYER[assetId] as Layer;
  const ltv = COLLATERAL_LTV_BY_LAYER[layer] || 0.3;

  h.frozen = true;
  next.cashIRR += amountIRR;

  const liquidationIRR = calcLiquidationIRR({ amountIRR, ltv });
  const startDate = new Date();
  const todayISO = startDate.toISOString().slice(0, 10);
  const dueDate = new Date(startDate);
  dueDate.setMonth(dueDate.getMonth() + durationMonths);
  const dueISO = dueDate.toISOString().slice(0, 10);
  const loanId = `loan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Generate installment schedule
  const installments = generateInstallments(amountIRR, todayISO, durationMonths, LOAN_INTEREST_RATE);
  const totalInterestIRR = installments.reduce((sum, inst) => sum + inst.interestIRR, 0);

  next.loans = [
    ...next.loans,
    {
      id: loanId,
      amountIRR,
      originalAmountIRR: amountIRR,  // Store original for progress tracking
      collateralAssetId: assetId,
      collateralQuantity: h.quantity,
      ltv,
      interestRate: LOAN_INTEREST_RATE,
      liquidationIRR,
      startISO: todayISO,
      dueISO,
      durationMonths,
      status: 'ACTIVE' as const,
      // Installment fields
      installments,
      installmentsPaid: 0,
      totalPaidIRR: 0,
      totalInterestIRR,
    },
  ];

  return next;
}

interface RepayPayload {
  loanId: string;
  amountIRR: number;
}

/**
 * Preview a repay action
 */
export function previewRepay(state: AppState, { loanId, amountIRR }: RepayPayload): AppState {
  const next = cloneState(state);
  const loanIndex = next.loans.findIndex((l) => l.id === loanId);
  if (loanIndex === -1) return next;

  const loan = { ...next.loans[loanIndex] };
  const repay = Math.min(amountIRR, next.cashIRR, loan.amountIRR + (loan.accruedInterestIRR || 0));

  if (repay <= 0) return next;

  next.cashIRR -= repay;
  loan.totalPaidIRR = (loan.totalPaidIRR || 0) + repay;

  // Update installment statuses based on total paid
  if (loan.installments) {
    let remaining = loan.totalPaidIRR;
    let paidCount = 0;

    loan.installments = loan.installments.map(inst => {
      if (remaining >= inst.totalIRR) {
        remaining -= inst.totalIRR;
        paidCount++;
        return {
          ...inst,
          status: 'PAID' as const,
          paidIRR: inst.totalIRR,
          paidISO: new Date().toISOString().slice(0, 10),
        };
      } else if (remaining > 0) {
        const partial = remaining;
        remaining = 0;
        return {
          ...inst,
          status: 'PARTIAL' as const,
          paidIRR: partial,
        };
      }
      return inst;
    });

    loan.installmentsPaid = paidCount;
  }

  // Reduce principal
  loan.amountIRR = Math.max(0, loan.amountIRR - repay);

  if (loan.amountIRR <= 0) {
    const collateral = next.holdings.find((x) => x.assetId === loan.collateralAssetId);
    if (collateral) collateral.frozen = false;
    next.loans = next.loans.filter((l) => l.id !== loanId);
  } else {
    next.loans[loanIndex] = loan;
  }

  return next;
}

/**
 * Helper: Execute sells from overweight layers
 */
function executeSells(
  surpluses: Record<string, number>,
  totalSurplus: number,
  amountToMove: number,
  sellableByLayer: Record<string, HoldingWithComputed[]>,
  prices: Record<string, number>,
  fxRate: number,
  meta: RebalanceMetaInternal
): void {
  const sellByLayer: Record<string, number> = {};
  for (const layer of Object.keys(surpluses)) {
    sellByLayer[layer] = Math.min(surpluses[layer], (surpluses[layer] / totalSurplus) * amountToMove);
  }

  for (const layer of Object.keys(sellByLayer)) {
    const toSell = sellByLayer[layer];
    if (toSell <= 0) continue;

    const assets = sellableByLayer[layer];
    if (!assets.length) continue;

    const layerTotal = assets.reduce((sum, h) => sum + (h._computedIRR || 0), 0);
    for (const h of assets) {
      const holdingIRR = h._computedIRR || 0;
      const proportion = holdingIRR / layerTotal;
      const sellAmountIRR = Math.min(toSell * proportion, holdingIRR);
      if (sellAmountIRR > 0) {
        if (h.assetId === 'IRR_FIXED_INCOME') {
          h.quantity -= irrToFixedIncomeUnits(sellAmountIRR);
        } else {
          const priceUSD = getAssetPriceUSD(h.assetId, prices) || 1;
          h.quantity -= sellAmountIRR / (priceUSD * fxRate);
        }
        h.quantity = Math.max(0, h.quantity);
        meta.trades.push({ layer: layer as Layer, assetId: h.assetId, amountIRR: -sellAmountIRR, side: 'SELL' });
      }
    }
  }
}

/**
 * Helper: Execute buys into underweight layers using weighted distribution
 */
function executeBuys(
  deficits: Record<string, number>,
  totalDeficit: number,
  amountToAllocate: number,
  holdingsByLayer: Record<string, HoldingWithComputed[]>,
  prices: Record<string, number>,
  fxRate: number,
  meta: RebalanceMetaInternal,
  dynamicWeights: Record<string, IntraLayerWeightResult> | null = null
): void {
  for (const layer of Object.keys(deficits)) {
    const layerBuy = (deficits[layer] / totalDeficit) * amountToAllocate;
    if (layerBuy <= 0) continue;

    const assets = holdingsByLayer[layer];
    if (!assets.length) continue;

    const layerWeights = dynamicWeights?.[layer]?.weights || WEIGHTS[layer as Layer] || {};
    const weightedAssets = assets.filter(h => layerWeights[h.assetId]);

    if (weightedAssets.length > 0) {
      const totalWeight = weightedAssets.reduce((sum, h) => sum + (layerWeights[h.assetId] || 0), 0);
      for (const h of weightedAssets) {
        const assetWeight = layerWeights[h.assetId] || 0;
        const assetPortionIRR = layerBuy * (assetWeight / totalWeight);
        if (assetPortionIRR > 0) {
          if (h.assetId === 'IRR_FIXED_INCOME') {
            h.quantity += irrToFixedIncomeUnits(assetPortionIRR);
          } else {
            const priceUSD = getAssetPriceUSD(h.assetId, prices) || 1;
            h.quantity += assetPortionIRR / (priceUSD * fxRate);
          }
          meta.trades.push({ layer: layer as Layer, assetId: h.assetId, amountIRR: assetPortionIRR, side: 'BUY' });
        }
      }
    } else {
      const perAssetIRR = layerBuy / assets.length;
      for (const h of assets) {
        if (h.assetId === 'IRR_FIXED_INCOME') {
          h.quantity += irrToFixedIncomeUnits(perAssetIRR);
        } else {
          const priceUSD = getAssetPriceUSD(h.assetId, prices) || 1;
          h.quantity += perAssetIRR / (priceUSD * fxRate);
        }
        meta.trades.push({ layer: layer as Layer, assetId: h.assetId, amountIRR: perAssetIRR, side: 'BUY' });
      }
    }
  }
}

/**
 * Helper: Calculate surpluses and deficits from current vs target layer values
 */
function calculateSurplusesAndDeficits(
  curIRR: Record<Layer, number>,
  targetIRR: Record<string, number>
): { surpluses: Record<string, number>; deficits: Record<string, number>; totalSurplus: number; totalDeficit: number } {
  const surpluses: Record<string, number> = {};
  const deficits: Record<string, number> = {};

  for (const layer of LAYERS) {
    const diff = curIRR[layer as Layer] - targetIRR[layer];
    if (diff > 0) {
      surpluses[layer] = diff;
    } else if (diff < 0) {
      deficits[layer] = Math.abs(diff);
    }
  }

  const totalSurplus = Object.values(surpluses).reduce((a, b) => a + b, 0);
  const totalDeficit = Object.values(deficits).reduce((a, b) => a + b, 0);

  return { surpluses, deficits, totalSurplus, totalDeficit };
}

/**
 * Helper: Execute holdings-only rebalancing (sell overweight, buy underweight)
 */
function executeHoldingsOnlyRebalance(
  curIRR: Record<Layer, number>,
  targetIRR: Record<string, number>,
  sellableByLayer: Record<string, HoldingWithComputed[]>,
  holdingsByLayer: Record<string, HoldingWithComputed[]>,
  prices: Record<string, number>,
  fxRate: number,
  meta: RebalanceMetaInternal,
  dynamicWeights: Record<string, IntraLayerWeightResult> | null = null
): void {
  const { surpluses, deficits, totalSurplus, totalDeficit } = calculateSurplusesAndDeficits(curIRR, targetIRR);
  const amountToMove = Math.min(totalSurplus, totalDeficit);

  if (amountToMove > 0) {
    executeSells(surpluses, totalSurplus, amountToMove, sellableByLayer, prices, fxRate, meta);
    executeBuys(deficits, totalDeficit, amountToMove, holdingsByLayer, prices, fxRate, meta, dynamicWeights);
  }
}

interface RebalancePayload {
  mode: RebalanceMode | 'SMART';
  useCashAmount?: number;
  prices?: Record<string, number>;
  fxRate?: number;
  strategy?: string;
  priceHistory?: Record<string, Array<{ price: number }>>;
}

/**
 * Deterministic rebalance for prototype
 */
export function previewRebalance(
  state: AppState,
  { mode, useCashAmount = 0, prices = DEFAULT_PRICES, fxRate = DEFAULT_FX_RATE, strategy = 'BALANCED', priceHistory = {} }: RebalancePayload
): AppStateWithMeta {
  const next = cloneState(state) as AppStateWithMeta;
  const snap = computeSnapshot(next.holdings, next.cashIRR, prices, fxRate);
  const holdingsTotal = snap.holdingsIRR || 1;

  const assetIRRMap = snap.holdingsIRRByAsset || {};
  const holdingsByLayer: Record<string, HoldingWithComputed[]> = { FOUNDATION: [], GROWTH: [], UPSIDE: [] };
  const sellableByLayer: Record<string, HoldingWithComputed[]> = { FOUNDATION: [], GROWTH: [], UPSIDE: [] };
  let hasLockedCollateral = false;

  for (const h of next.holdings as HoldingWithComputed[]) {
    const layer = ASSET_LAYER[h.assetId] as Layer;
    const holdingIRR = assetIRRMap[h.assetId] || 0;
    if (layer && holdingsByLayer[layer]) {
      h._computedIRR = holdingIRR;
      holdingsByLayer[layer].push(h);
      if (!h.frozen && holdingIRR > 0) {
        sellableByLayer[layer].push(h);
      } else if (h.frozen && holdingIRR > 0) {
        hasLockedCollateral = true;
      }
    }
  }

  const strategyConfig = STRATEGY_PRESETS[strategy as StrategyPreset] || STRATEGY_PRESETS.BALANCED;
  const marketData = new MarketDataProvider(priceHistory);
  const balancer = new IntraLayerBalancer(marketData, strategyConfig);

  const intraLayerWeights: Record<Layer, IntraLayerWeightResult> = {} as Record<Layer, IntraLayerWeightResult>;
  for (const layer of LAYERS) {
    const layerAssets = LAYER_ASSETS[layer as Layer] || [];
    intraLayerWeights[layer as Layer] = balancer.calculateWeights(layer, layerAssets);
  }

  const meta: RebalanceMetaInternal = {
    hasLockedCollateral,
    insufficientCash: false,
    residualDrift: 0,
    trades: [],
    cashDeployed: 0,
    intraLayerWeights,
    strategy,
  };

  const targetIRR: Record<string, number> = {
    FOUNDATION: (state.targetLayerPct.FOUNDATION / 100) * holdingsTotal,
    GROWTH: (state.targetLayerPct.GROWTH / 100) * holdingsTotal,
    UPSIDE: (state.targetLayerPct.UPSIDE / 100) * holdingsTotal,
  };
  const curIRR = { ...snap.layerIRR };

  if (mode === 'HOLDINGS_ONLY' || mode === 'SMART') {
    executeHoldingsOnlyRebalance(curIRR, targetIRR, sellableByLayer, holdingsByLayer, prices, fxRate, meta, intraLayerWeights as Record<string, IntraLayerWeightResult>);
  }

  if (mode === 'SMART' && useCashAmount > 0 && next.cashIRR >= useCashAmount) {
    const midSnap = computeSnapshot(next.holdings, next.cashIRR, prices, fxRate);
    const newTotal = midSnap.holdingsIRR + useCashAmount;
    const newTargetIRR: Record<string, number> = {
      FOUNDATION: (state.targetLayerPct.FOUNDATION / 100) * newTotal,
      GROWTH: (state.targetLayerPct.GROWTH / 100) * newTotal,
      UPSIDE: (state.targetLayerPct.UPSIDE / 100) * newTotal,
    };

    const cashDeficits: Record<string, number> = {};
    let totalCashDeficit = 0;
    for (const layer of LAYERS) {
      const deficit = Math.max(0, newTargetIRR[layer] - midSnap.layerIRR[layer as Layer]);
      cashDeficits[layer] = deficit;
      totalCashDeficit += deficit;
    }

    if (totalCashDeficit > 0) {
      const actualSpend = Math.min(useCashAmount, totalCashDeficit, next.cashIRR);
      executeBuys(cashDeficits, totalCashDeficit, actualSpend, holdingsByLayer, prices, fxRate, meta, intraLayerWeights as Record<string, IntraLayerWeightResult>);
      meta.cashDeployed = actualSpend;
      next.cashIRR -= actualSpend;
    }
  }

  if (mode === 'HOLDINGS_PLUS_CASH' && next.cashIRR > 0) {
    const newTotal = holdingsTotal + next.cashIRR;
    const newTargetIRR: Record<string, number> = {
      FOUNDATION: (state.targetLayerPct.FOUNDATION / 100) * newTotal,
      GROWTH: (state.targetLayerPct.GROWTH / 100) * newTotal,
      UPSIDE: (state.targetLayerPct.UPSIDE / 100) * newTotal,
    };

    const deficits: Record<string, number> = {
      FOUNDATION: Math.max(0, newTargetIRR.FOUNDATION - curIRR.FOUNDATION),
      GROWTH: Math.max(0, newTargetIRR.GROWTH - curIRR.GROWTH),
      UPSIDE: Math.max(0, newTargetIRR.UPSIDE - curIRR.UPSIDE),
    };

    const totalDef = deficits.FOUNDATION + deficits.GROWTH + deficits.UPSIDE;
    if (totalDef > 0) {
      const spend = Math.min(next.cashIRR, totalDef);
      if (next.cashIRR < totalDef) meta.insufficientCash = true;

      executeBuys(deficits, totalDef, spend, holdingsByLayer, prices, fxRate, meta, intraLayerWeights as Record<string, IntraLayerWeightResult>);
      meta.cashDeployed = spend;
      next.cashIRR -= spend;
    }
  }

  const afterSnap = computeSnapshot(next.holdings, next.cashIRR, prices, fxRate);
  meta.residualDrift = LAYERS.reduce((sum, layer) => {
    return sum + Math.abs(state.targetLayerPct[layer as Layer] - afterSnap.layerPct[layer as Layer]);
  }, 0);

  next._rebalanceMeta = meta;
  return next;
}
