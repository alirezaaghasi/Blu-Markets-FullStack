// Portfolio Metrics Worker
// Periodically recalculates portfolio metrics (allocation, drift, status)
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { getCurrentPrices } from './price-fetcher.service.js';
import { logger } from '../utils/logger.js';
import type { AssetId, Layer, TargetAllocation, PortfolioStatus } from '../types/domain.js';

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
  const cashIrr = Number(portfolio.cashIrr);

  // Calculate holdings value by layer
  const layerValues = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  let holdingsValueIrr = 0;

  for (const holding of portfolio.holdings) {
    const price = prices.get(holding.assetId as AssetId);
    if (price) {
      const value = Number(holding.quantity) * price.priceIrr;
      holdingsValueIrr += value;
      layerValues[holding.layer as Layer] += value;
    }
  }

  const totalValueIrr = cashIrr + holdingsValueIrr;

  // Calculate allocation percentages
  const foundationPct = totalValueIrr > 0 ? (layerValues.FOUNDATION / totalValueIrr) * 100 : 0;
  const growthPct = totalValueIrr > 0 ? (layerValues.GROWTH / totalValueIrr) * 100 : 0;
  const upsidePct = totalValueIrr > 0 ? (layerValues.UPSIDE / totalValueIrr) * 100 : 0;

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
  let newStatus: PortfolioStatus;
  if (driftPct <= 5) {
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
