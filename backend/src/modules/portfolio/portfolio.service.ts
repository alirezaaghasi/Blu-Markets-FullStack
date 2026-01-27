import { Decimal as PrismaDecimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';
import { getCurrentPrices } from '../../services/price-fetcher.service.js';
import type {
  AssetId,
  Layer,
  PortfolioSnapshot,
  PortfolioStatus,
  TargetAllocation,
  Boundary,
} from '../../types/domain.js';
import type { PortfolioSummary, HoldingResponse } from '../../types/api.js';
import {
  toDecimal,
  multiply,
  add,
  divide,
  roundIrr,
  toNumber,
  isGreaterThan,
  Decimal,
} from '../../utils/money.js';

// Asset layer mapping per PRD (synced with frontend assets.ts)
const ASSET_LAYERS: Record<AssetId, Layer> = {
  USDT: 'FOUNDATION',
  PAXG: 'FOUNDATION',
  IRR_FIXED_INCOME: 'FOUNDATION',
  BTC: 'GROWTH',
  ETH: 'GROWTH',
  BNB: 'GROWTH',
  XRP: 'GROWTH',
  KAG: 'GROWTH', // Kinesis Silver
  QQQ: 'GROWTH',
  SOL: 'UPSIDE',
  TON: 'UPSIDE',
  LINK: 'UPSIDE',
  AVAX: 'UPSIDE',
  MATIC: 'UPSIDE',
  ARB: 'UPSIDE',
};

const ASSET_NAMES: Record<AssetId, string> = {
  USDT: 'Tether USD',
  PAXG: 'Paxos Gold',
  IRR_FIXED_INCOME: 'Fixed Income',
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  BNB: 'BNB',
  XRP: 'XRP',
  KAG: 'Kinesis Silver',
  QQQ: 'Invesco QQQ',
  SOL: 'Solana',
  TON: 'Toncoin',
  LINK: 'Chainlink',
  AVAX: 'Avalanche',
  MATIC: 'Polygon',
  ARB: 'Arbitrum',
};

export function getAssetLayer(assetId: AssetId): Layer {
  return ASSET_LAYERS[assetId] || 'UPSIDE';
}

export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { userId },
    include: {
      holdings: true,
      loans: { where: { status: 'ACTIVE' } },
      protections: { where: { status: 'ACTIVE' } },
      user: true,
    },
  });

  if (!portfolio) {
    throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
  }

  const prices = await getCurrentPrices();

  // MONEY FIX M-02: Calculate holdings value using Decimal arithmetic
  let holdingsValueDecimal = toDecimal(0);
  for (const holding of portfolio.holdings) {
    const price = prices.get(holding.assetId as AssetId);
    if (price) {
      holdingsValueDecimal = add(holdingsValueDecimal, multiply(holding.quantity, price.priceIrr));
    }
  }

  const cashIrr = Number(portfolio.cashIrr);
  const holdingsValueIrr = toNumber(roundIrr(holdingsValueDecimal));
  const totalValueIrr = toNumber(roundIrr(add(cashIrr, holdingsValueDecimal)));

  // DRIFT FIX: Calculate allocation based on HOLDINGS VALUE ONLY
  // Cash is "unallocated dry powder" - not part of any layer
  // This ensures adding cash doesn't create artificial drift
  const allocation = calculateAllocation(portfolio.holdings, prices, holdingsValueIrr);

  // Get target allocation
  const targetAllocation: TargetAllocation = {
    foundation: Number(portfolio.user.targetFoundation) || 50,
    growth: Number(portfolio.user.targetGrowth) || 35,
    upside: Number(portfolio.user.targetUpside) || 15,
  };

  // Calculate drift
  const driftPct = calculateDrift(allocation, targetAllocation);

  // Determine status (pass holdingsValueIrr to handle edge case of no holdings)
  const status = determineStatus(driftPct, allocation, holdingsValueIrr);

  // MONEY FIX M-02: Build holdings response with values using Decimal
  // HIGH-2 FIX: Filter out zero-balance holdings from response
  const holdingsResponse: HoldingResponse[] = portfolio.holdings
    .filter((h) => Number(h.quantity) > 0) // Exclude zero-balance holdings
    .map((h) => {
      const assetId = h.assetId as AssetId;
      const price = prices.get(assetId);
      const quantity = Number(h.quantity);
      const valueIrrDecimal = price ? multiply(quantity, price.priceIrr) : toDecimal(0);
      const valueUsdDecimal = price ? multiply(quantity, price.priceUsd) : toDecimal(0);
      const valueIrr = toNumber(roundIrr(valueIrrDecimal));
      const valueUsd = toNumber(valueUsdDecimal);

      return {
        id: h.id,
        assetId,
        name: ASSET_NAMES[assetId] || assetId,
        quantity,
        layer: h.layer as Layer,
        frozen: h.frozen,
        valueIrr,
        valueUsd,
        priceIrr: price?.priceIrr || 0,
        priceUsd: price?.priceUsd || 0,
        change24hPct: price?.change24hPct || 0,
        pctOfPortfolio: totalValueIrr > 0 ? toNumber(multiply(divide(valueIrrDecimal, totalValueIrr), 100)) : 0,
        purchasedAt: h.purchaseDate?.toISOString(),  // For Fixed Income accrual
      };
    });

  return {
    id: portfolio.id,
    cashIrr,
    totalValueIrr,
    holdingsValueIrr,
    allocation,
    // Uppercase aliases for mobile compatibility
    Allocation: {
      Foundation: allocation.foundation,
      Growth: allocation.growth,
      Upside: allocation.upside,
    },
    targetAllocation,
    TargetAllocation: {
      Foundation: targetAllocation.foundation,
      Growth: targetAllocation.growth,
      Upside: targetAllocation.upside,
    },
    status,
    driftPct,
    holdingsCount: portfolio.holdings.length,
    activeLoansCount: portfolio.loans.length,
    activeProtectionsCount: portfolio.protections.length,
    holdings: holdingsResponse,
  };
}

export async function getPortfolioHoldings(userId: string): Promise<HoldingResponse[]> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { userId },
    include: { holdings: true },
  });

  if (!portfolio) {
    throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
  }

  const prices = await getCurrentPrices();

  // MONEY FIX M-02: Calculate total for percentage using Decimal
  let totalValueDecimal = toDecimal(portfolio.cashIrr);
  for (const holding of portfolio.holdings) {
    const price = prices.get(holding.assetId as AssetId);
    if (price) {
      totalValueDecimal = add(totalValueDecimal, multiply(holding.quantity, price.priceIrr));
    }
  }
  const totalValueIrr = toNumber(roundIrr(totalValueDecimal));

  // HIGH-2 FIX: Filter out zero-balance holdings from response
  const holdings: HoldingResponse[] = portfolio.holdings
    .filter((h) => Number(h.quantity) > 0) // Exclude zero-balance holdings
    .map((h) => {
      const assetId = h.assetId as AssetId;
      const price = prices.get(assetId);
      const quantity = Number(h.quantity);
      const valueIrrDecimal = price ? multiply(quantity, price.priceIrr) : toDecimal(0);
      const valueUsdDecimal = price ? multiply(quantity, price.priceUsd) : toDecimal(0);
      const valueIrr = toNumber(roundIrr(valueIrrDecimal));
      const valueUsd = toNumber(valueUsdDecimal);

      return {
        id: h.id,
        assetId,
        name: ASSET_NAMES[assetId] || assetId,
        quantity,
        layer: h.layer as Layer,
        frozen: h.frozen,
        valueIrr,
        valueUsd,
        priceUsd: price?.priceUsd || 0,
        priceIrr: price?.priceIrr || 0,
        change24hPct: price?.change24hPct,
        pctOfPortfolio: isGreaterThan(totalValueDecimal, 0) ? toNumber(multiply(divide(valueIrrDecimal, totalValueDecimal), 100)) : 0,
        purchasedAt: h.purchaseDate?.toISOString(),  // For Fixed Income accrual
      };
    });

  return holdings;
}

export async function getPortfolioSnapshot(userId: string): Promise<PortfolioSnapshot> {
  const summary = await getPortfolioSummary(userId);
  const holdings = await getPortfolioHoldings(userId);

  return {
    id: summary.id,
    userId,
    cashIrr: summary.cashIrr,
    holdings: holdings.map((h) => ({
      assetId: h.assetId,
      quantity: h.quantity,
      layer: h.layer,
      frozen: h.frozen,
      valueIrr: h.valueIrr,
      valueUsd: h.valueUsd,
    })),
    totalValueIrr: summary.totalValueIrr,
    holdingsValueIrr: summary.holdingsValueIrr,
    allocation: summary.allocation,
    targetAllocation: summary.targetAllocation,
    status: summary.status,
    driftPct: summary.driftPct,
  };
}

export async function addFunds(
  userId: string,
  amountIrr: number
): Promise<{ previousCashIrr: number; newCashIrr: number; amountAdded: number; ledgerEntryId: string }> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { userId },
  });

  if (!portfolio) {
    throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
  }

  if (amountIrr < 1000000) {
    throw new AppError('VALIDATION_ERROR', 'Minimum deposit is 1,000,000 IRR', 400);
  }

  // MONEY FIX M-02: Use Decimal for cash calculation
  const beforeCash = Number(portfolio.cashIrr);
  const newCashIrr = toNumber(roundIrr(add(beforeCash, amountIrr)));

  // Update portfolio
  await prisma.portfolio.update({
    where: { id: portfolio.id },
    data: {
      cashIrr: newCashIrr,
      totalValueIrr: { increment: amountIrr },
    },
  });

  // Create ledger entry
  const ledgerEntry = await prisma.ledgerEntry.create({
    data: {
      portfolioId: portfolio.id,
      entryType: 'ADD_FUNDS',
      beforeSnapshot: { cashIrr: beforeCash },
      afterSnapshot: { cashIrr: newCashIrr },
      amountIrr,
      boundary: 'SAFE',
      message: `Added ${formatIrr(amountIrr)} to portfolio`,
    },
  });

  // Create action log
  await prisma.actionLog.create({
    data: {
      portfolioId: portfolio.id,
      actionType: 'ADD_FUNDS',
      boundary: 'SAFE',
      message: `Added ${formatIrr(amountIrr)}`,
      amountIrr,
    },
  });

  return { previousCashIrr: beforeCash, newCashIrr, amountAdded: amountIrr, ledgerEntryId: ledgerEntry.id };
}

// MONEY FIX M-02: Use Decimal for allocation calculations
// DRIFT FIX: Allocation is calculated based on holdings value only (excluding cash)
// Cash is "unallocated dry powder" - not part of any layer
// Allocation percentages represent how invested holdings are distributed, summing to 100%
function calculateAllocation(
  holdings: { assetId: string; quantity: PrismaDecimal; layer: string }[],
  prices: Map<AssetId, { priceIrr: number }>,
  holdingsValueIrr: number
): TargetAllocation {
  if (holdingsValueIrr === 0) {
    return { foundation: 0, growth: 0, upside: 0 };
  }

  const layerValues = {
    FOUNDATION: toDecimal(0),
    GROWTH: toDecimal(0),
    UPSIDE: toDecimal(0),
  };

  for (const holding of holdings) {
    const price = prices.get(holding.assetId as AssetId);
    if (price) {
      const valueDecimal = multiply(holding.quantity, price.priceIrr);
      layerValues[holding.layer as Layer] = add(layerValues[holding.layer as Layer], valueDecimal);
    }
  }

  // DRIFT FIX: Use holdings value as denominator, not total value (which includes cash)
  const holdingsDecimal = toDecimal(holdingsValueIrr);
  return {
    foundation: toNumber(multiply(divide(layerValues.FOUNDATION, holdingsDecimal), 100)),
    growth: toNumber(multiply(divide(layerValues.GROWTH, holdingsDecimal), 100)),
    upside: toNumber(multiply(divide(layerValues.UPSIDE, holdingsDecimal), 100)),
  };
}

function calculateDrift(current: TargetAllocation, target: TargetAllocation): number {
  const foundationDrift = Math.abs(current.foundation - target.foundation);
  const growthDrift = Math.abs(current.growth - target.growth);
  const upsideDrift = Math.abs(current.upside - target.upside);

  return Math.max(foundationDrift, growthDrift, upsideDrift);
}

function determineStatus(
  driftPct: number,
  allocation?: TargetAllocation,
  holdingsValueIrr?: number
): PortfolioStatus {
  // DRIFT FIX: If no holdings, portfolio is "balanced" (nothing to be misallocated)
  // User just has cash waiting to be invested
  if (holdingsValueIrr !== undefined && holdingsValueIrr === 0) {
    return 'BALANCED';
  }

  // Per PRD Section 20.1:
  // ATTENTION_REQUIRED: Foundation < 30% OR Upside > 25%
  if (allocation) {
    if (allocation.foundation < 30 || allocation.upside > 25) {
      return 'ATTENTION_REQUIRED';
    }
  }

  // BALANCED: All layers within 5% of target
  if (driftPct <= 5) return 'BALANCED';

  // SLIGHTLY_OFF: Any layer > 5% drift, no hard limits breached
  if (driftPct <= 10) return 'SLIGHTLY_OFF';

  return 'ATTENTION_REQUIRED';
}

function formatIrr(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + ' IRR';
}

export async function getAssetHolding(
  userId: string,
  assetId: string
): Promise<{
  holding: {
    assetId: string;
    quantity: number;
    frozen: boolean;
    layer: string;
  };
  currentPriceUsd: number;
  valueIrr: number;
  changePercent24h: number;
}> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { userId },
    include: { holdings: true },
  });

  if (!portfolio) {
    throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
  }

  const holding = portfolio.holdings.find((h) => h.assetId === assetId);
  if (!holding) {
    throw new AppError('NOT_FOUND', 'Holding not found', 404);
  }

  const prices = await getCurrentPrices();
  const price = prices.get(assetId as AssetId);

  // MONEY FIX M-02: Use Decimal for value calculation
  const quantity = Number(holding.quantity);
  const valueIrr = price ? toNumber(roundIrr(multiply(quantity, price.priceIrr))) : 0;

  return {
    holding: {
      assetId: holding.assetId,
      quantity,
      frozen: holding.frozen,
      layer: holding.layer,
    },
    currentPriceUsd: price?.priceUsd || 0,
    valueIrr,
    changePercent24h: price?.change24hPct || 0,
  };
}

// Boundary classification per PRD Section 20
export function classifyBoundary(
  beforeStatus: PortfolioStatus,
  afterStatus: PortfolioStatus,
  movesTowardTarget: boolean
): Boundary {
  // Moving toward target from any state is SAFE
  if (movesTowardTarget) {
    return 'SAFE';
  }

  // Matrix per PRD
  if (beforeStatus === 'BALANCED') {
    if (afterStatus === 'BALANCED') return 'SAFE';
    if (afterStatus === 'SLIGHTLY_OFF') return 'DRIFT';
    return 'STRUCTURAL';
  }

  if (beforeStatus === 'SLIGHTLY_OFF') {
    if (afterStatus === 'BALANCED') return 'SAFE';
    if (afterStatus === 'SLIGHTLY_OFF') return 'DRIFT';
    return 'STRUCTURAL';
  }

  // ATTENTION_REQUIRED
  if (afterStatus === 'BALANCED') return 'SAFE';
  if (afterStatus === 'SLIGHTLY_OFF') return 'DRIFT';
  if (afterStatus === 'ATTENTION_REQUIRED') return 'STRESS';
  return 'STRESS';
}
