// Portfolio Metrics Worker
// Periodically recalculates portfolio metrics (allocation, drift, status)
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { getCurrentPrices } from './price-fetcher.service.js';
import { logger } from '../utils/logger.js';
import type { AssetId, Layer, TargetAllocation, PortfolioStatus } from '../types/domain.js';
// AUDIT FIX #3: Import Decimal utilities for precise financial math
import { toDecimal, add, multiply, divide, toNumber } from '../utils/money.js';

// Prisma Decimal type alias for cleaner signatures
type Decimal = Prisma.Decimal;

let metricsInterval: NodeJS.Timeout | null = null;

/**
 * Start the portfolio metrics worker
 */
export function startPortfolioMetricsWorker(): void {
  if (!env.ENABLE_PORTFOLIO_METRICS) {
    logger.info('Portfolio metrics worker disabled');
    return;
  }

  const intervalMs = env.PORTFOLIO_METRICS_INTERVAL_MS || 60000; // 1 minute default
  logger.info('Starting portfolio metrics worker', { intervalSec: intervalMs / 1000 });

  // Run immediately
  updateAllPortfolioMetrics();

  // Then run at intervals
  metricsInterval = setInterval(updateAllPortfolioMetrics, intervalMs);
}

/**
 * Stop the portfolio metrics worker
 */
export function stopPortfolioMetricsWorker(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
    logger.info('Portfolio metrics worker stopped');
  }
}

/**
 * Check if metrics worker is active
 */
export function isMetricsWorkerActive(): boolean {
  return metricsInterval !== null;
}

/**
 * Update metrics for all portfolios
 */
async function updateAllPortfolioMetrics(): Promise<void> {
  try {
    const startTime = Date.now();

    // Get all portfolios with holdings and user target allocations
    const portfolios = await prisma.portfolio.findMany({
      include: {
        holdings: true,
        user: {
          select: {
            targetFoundation: true,
            targetGrowth: true,
            targetUpside: true,
          },
        },
      },
    });

    if (portfolios.length === 0) return;

    // Get current prices once
    const prices = await getCurrentPrices();

    let updatedCount = 0;
    let statusChangedCount = 0;

    for (const portfolio of portfolios) {
      const result = await updatePortfolioMetrics(portfolio, prices);
      if (result.updated) updatedCount++;
      if (result.statusChanged) statusChangedCount++;
    }

    const duration = Date.now() - startTime;
    if (updatedCount > 0 || statusChangedCount > 0) {
      logger.info('Portfolio metrics updated', { updatedCount, statusChangedCount, durationMs: duration });
    }
  } catch (error) {
    logger.error('Portfolio metrics update error', error);
  }
}

/**
 * Update metrics for a single portfolio
 */
async function updatePortfolioMetrics(
  portfolio: {
    id: string;
    cashIrr: Decimal | number | string;
    status: PortfolioStatus;
    holdings: { assetId: string; quantity: Decimal | number | string; layer: string }[];
    user: {
      targetFoundation: Decimal | number | string | null;
      targetGrowth: Decimal | number | string | null;
      targetUpside: Decimal | number | string | null;
    };
  },
  prices: Map<AssetId, { priceIrr: number; priceUsd: number }>
): Promise<{ updated: boolean; statusChanged: boolean }> {
  // AUDIT FIX #3: Use Decimal arithmetic to prevent floating-point drift
  const cashDecimal = toDecimal(portfolio.cashIrr);

  // Calculate holdings value by layer using Decimal
  const layerValues = {
    FOUNDATION: toDecimal(0),
    GROWTH: toDecimal(0),
    UPSIDE: toDecimal(0),
  };
  let holdingsValueDecimal = toDecimal(0);

  for (const holding of portfolio.holdings) {
    const price = prices.get(holding.assetId as AssetId);
    if (price) {
      const valueDecimal = multiply(toDecimal(holding.quantity), price.priceIrr);
      holdingsValueDecimal = add(holdingsValueDecimal, valueDecimal);
      layerValues[holding.layer as Layer] = add(layerValues[holding.layer as Layer], valueDecimal);
    }
  }

  const holdingsValueIrr = toNumber(holdingsValueDecimal);
  const totalValueIrr = toNumber(add(cashDecimal, holdingsValueDecimal));

  // DRIFT FIX: Calculate allocation percentages based on HOLDINGS VALUE ONLY
  // Cash is "unallocated dry powder" - not part of any layer
  // This ensures adding cash doesn't create artificial drift
  // Allocation represents how invested holdings are distributed across layers
  let foundationPct = 0;
  let growthPct = 0;
  let upsidePct = 0;

  if (holdingsValueIrr > 0) {
    foundationPct = toNumber(multiply(divide(layerValues.FOUNDATION, holdingsValueDecimal), 100));
    growthPct = toNumber(multiply(divide(layerValues.GROWTH, holdingsValueDecimal), 100));
    upsidePct = toNumber(multiply(divide(layerValues.UPSIDE, holdingsValueDecimal), 100));
  }

  // Get target allocation
  const target: TargetAllocation = {
    foundation: Number(portfolio.user.targetFoundation) || 50,
    growth: Number(portfolio.user.targetGrowth) || 35,
    upside: Number(portfolio.user.targetUpside) || 15,
  };

  // Calculate drift (max difference from target)
  const driftPct = Math.max(
    Math.abs(foundationPct - target.foundation),
    Math.abs(growthPct - target.growth),
    Math.abs(upsidePct - target.upside)
  );

  // Determine status
  // DRIFT FIX: If no holdings, portfolio is "balanced" (nothing to be misallocated)
  let newStatus: PortfolioStatus;
  if (holdingsValueIrr === 0) {
    newStatus = 'BALANCED';
  } else if (driftPct <= 5) {
    newStatus = 'BALANCED';
  } else if (driftPct <= 10) {
    newStatus = 'SLIGHTLY_OFF';
  } else {
    newStatus = 'ATTENTION_REQUIRED';
  }

  const statusChanged = portfolio.status !== newStatus;

  // Update portfolio with new metrics
  await prisma.portfolio.update({
    where: { id: portfolio.id },
    data: {
      totalValueIrr,
      holdingsValueIrr,
      foundationPct,
      growthPct,
      upsidePct,
      status: newStatus,
      driftDetectedAt: statusChanged && newStatus !== 'BALANCED' ? new Date() : undefined,
    },
  });

  // If status changed to non-balanced, create an action log entry
  if (statusChanged && newStatus !== 'BALANCED') {
    await prisma.actionLog.create({
      data: {
        portfolioId: portfolio.id,
        actionType: 'DRIFT_DETECTED',
        boundary: newStatus === 'SLIGHTLY_OFF' ? 'DRIFT' : 'STRUCTURAL',
        message: 'Portfolio drift detected: ' + driftPct.toFixed(1) + '% from target',
      },
    });
  }

  return { updated: true, statusChanged };
}

/**
 * Manually trigger metrics update for a specific portfolio
 */
export async function triggerPortfolioMetricsUpdate(portfolioId: string): Promise<void> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: {
      holdings: true,
      user: {
        select: {
          targetFoundation: true,
          targetGrowth: true,
          targetUpside: true,
        },
      },
    },
  });

  if (!portfolio) {
    throw new Error('Portfolio not found');
  }

  const prices = await getCurrentPrices();
  await updatePortfolioMetrics(portfolio, prices);
}
