import { Decimal } from '@prisma/client/runtime/library';
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

// Asset layer mapping per PRD
const ASSET_LAYERS: Record<AssetId, Layer> = {
  USDT: 'FOUNDATION',
  PAXG: 'FOUNDATION',
  IRR_FIXED_INCOME: 'FOUNDATION',
  BTC: 'GROWTH',
  ETH: 'GROWTH',
  BNB: 'GROWTH',
  XRP: 'GROWTH',
  GOLD: 'GROWTH',
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
  GOLD: 'Gold',
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

  // Calculate holdings value
  let holdingsValueIrr = 0;
  for (const holding of portfolio.holdings) {
    const price = prices.get(holding.assetId as AssetId);
    if (price) {
      holdingsValueIrr += Number(holding.quantity) * price.priceIrr;
    }
  }

  const cashIrr = Number(portfolio.cashIrr);
  const totalValueIrr = cashIrr + holdingsValueIrr;

  // Calculate allocation
  const allocation = calculateAllocation(portfolio.holdings, prices, totalValueIrr);

  // Get target allocation
  const targetAllocation: TargetAllocation = {
    foundation: Number(portfolio.user.targetFoundation) || 50,
    growth: Number(portfolio.user.targetGrowth) || 35,
    upside: Number(portfolio.user.targetUpside) || 15,
  };

  // Calculate drift
  const driftPct = calculateDrift(allocation, targetAllocation);

  // Determine status
  const status = determineStatus(driftPct);

  return {
    id: portfolio.id,
    cashIrr,
    totalValueIrr,
    holdingsValueIrr,
    allocation,
    targetAllocation,
    status,
    driftPct,
    holdingsCount: portfolio.holdings.length,
    activeLoansCount: portfolio.loans.length,
    activeProtectionsCount: portfolio.protections.length,
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

  // Calculate total for percentage
  let totalValueIrr = Number(portfolio.cashIrr);
  for (const holding of portfolio.holdings) {
    const price = prices.get(holding.assetId as AssetId);
    if (price) {
      totalValueIrr += Number(holding.quantity) * price.priceIrr;
    }
  }

  const holdings: HoldingResponse[] = portfolio.holdings.map((h) => {
    const assetId = h.assetId as AssetId;
    const price = prices.get(assetId);
    const quantity = Number(h.quantity);
    const valueIrr = price ? quantity * price.priceIrr : 0;
    const valueUsd = price ? quantity * price.priceUsd : 0;

    return {
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
      pctOfPortfolio: totalValueIrr > 0 ? (valueIrr / totalValueIrr) * 100 : 0,
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
): Promise<{ newCashIrr: number; ledgerEntryId: string }> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { userId },
  });

  if (!portfolio) {
    throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
  }

  if (amountIrr < 1000000) {
    throw new AppError('VALIDATION_ERROR', 'Minimum deposit is 1,000,000 IRR', 400);
  }

  const beforeCash = Number(portfolio.cashIrr);
  const newCashIrr = beforeCash + amountIrr;

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

  return { newCashIrr, ledgerEntryId: ledgerEntry.id };
}

function calculateAllocation(
  holdings: { assetId: string; quantity: Decimal; layer: string }[],
  prices: Map<AssetId, { priceIrr: number }>,
  totalValueIrr: number
): TargetAllocation {
  if (totalValueIrr === 0) {
    return { foundation: 0, growth: 0, upside: 0 };
  }

  const layerValues = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };

  for (const holding of holdings) {
    const price = prices.get(holding.assetId as AssetId);
    if (price) {
      const value = Number(holding.quantity) * price.priceIrr;
      layerValues[holding.layer as Layer] += value;
    }
  }

  return {
    foundation: (layerValues.FOUNDATION / totalValueIrr) * 100,
    growth: (layerValues.GROWTH / totalValueIrr) * 100,
    upside: (layerValues.UPSIDE / totalValueIrr) * 100,
  };
}

function calculateDrift(current: TargetAllocation, target: TargetAllocation): number {
  const foundationDrift = Math.abs(current.foundation - target.foundation);
  const growthDrift = Math.abs(current.growth - target.growth);
  const upsideDrift = Math.abs(current.upside - target.upside);

  return Math.max(foundationDrift, growthDrift, upsideDrift);
}

function determineStatus(driftPct: number): PortfolioStatus {
  if (driftPct <= 5) return 'BALANCED';
  if (driftPct <= 10) return 'SLIGHTLY_OFF';
  return 'ATTENTION_REQUIRED';
}

function formatIrr(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + ' IRR';
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
