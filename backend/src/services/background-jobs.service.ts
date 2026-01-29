// Background Jobs Service
// Handles periodic tasks: loan liquidation checks, protection expiry
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { getCurrentPrices } from './price-fetcher.service.js';
import { logger } from '../utils/logger.js';
import { toDecimal, multiply, subtract, divide, toNumber, max } from '../utils/money.js';
import { withLock } from './distributed-lock.service.js';
import { CRITICAL_LTV_THRESHOLD } from '../config/business-rules.js';
import type { AssetId } from '../types/domain.js';

let jobIntervals: {
  loanCheck: NodeJS.Timeout | null;
} = {
  loanCheck: null,
};

/**
 * Start all background jobs
 */
export function startBackgroundJobs(): void {
  if (!env.ENABLE_BACKGROUND_JOBS) {
    logger.info('Background jobs disabled');
    return;
  }

  logger.info('Starting background jobs');

  // Loan liquidation check every 5 minutes
  const loanIntervalMs = env.LOAN_CHECK_INTERVAL_MS || 5 * 60 * 1000;
  runLoanLiquidationCheck(); // Run immediately
  jobIntervals.loanCheck = setInterval(runLoanLiquidationCheck, loanIntervalMs);
  logger.info('Loan liquidation check scheduled', { intervalSec: loanIntervalMs / 1000 });

  // Note: Protection expiry is handled by protection-jobs.ts cron job (settlement-aware)
}

/**
 * Stop all background jobs
 */
export function stopBackgroundJobs(): void {
  if (jobIntervals.loanCheck) {
    clearInterval(jobIntervals.loanCheck);
    jobIntervals.loanCheck = null;
  }
  logger.info('Background jobs stopped');
}

/**
 * Check all active loans for critical LTV and trigger liquidation if needed
 * Uses distributed lock to prevent duplicate runs across instances.
 */
async function runLoanLiquidationCheck(): Promise<void> {
  // Acquire distributed lock (5-minute TTL matches check interval)
  const result = await withLock('loan-liquidation-check', 300, async () => {
    return runLoanLiquidationCheckImpl();
  });

  if (result === null) {
    logger.debug('Skipping loan check - another instance is running');
  }
}

/**
 * Implementation of loan liquidation check (called with lock held)
 */
async function runLoanLiquidationCheckImpl(): Promise<void> {
  try {
    // Get all active loans - only select fields needed for LTV calculation
    // Removed: portfolio.holdings include (unused, inflates query size)
    const activeLoans = await prisma.loan.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        portfolioId: true,
        collateralAssetId: true,
        collateralQuantity: true,
        totalDueIrr: true,
        paidIrr: true,
      },
    });

    if (activeLoans.length === 0) return;

    const prices = await getCurrentPrices();
    let liquidatedCount = 0;

    for (const loan of activeLoans) {
      const assetId = loan.collateralAssetId as AssetId;
      const price = prices.get(assetId);

      if (!price) {
        logger.warn('No price available, skipping LTV check', { assetId });
        continue;
      }

      // FINANCIAL FIX: Use Decimal arithmetic for precise LTV calculations
      // Prevents floating-point errors that could cause false liquidations
      const collateralQtyDecimal = toDecimal(loan.collateralQuantity);
      const collateralValueDecimal = multiply(collateralQtyDecimal, price.priceIrr);
      const collateralValueIrr = toNumber(collateralValueDecimal);

      // Guard against negative remaining due (e.g., overpayment edge case)
      const totalDueDecimal = toDecimal(loan.totalDueIrr);
      const paidDecimal = toDecimal(loan.paidIrr);
      const remainingDueDecimal = max(toDecimal(0), subtract(totalDueDecimal, paidDecimal));
      const remainingDue = toNumber(remainingDueDecimal);

      // Guard against division by zero
      if (collateralValueIrr <= 0) {
        logger.warn('Invalid collateral value for loan', { loanId: loan.id });
        await prisma.loan.update({ where: { id: loan.id }, data: { currentLtv: 1.0 } });
        continue;
      }

      // Calculate current LTV using Decimal arithmetic
      const currentLtvDecimal = divide(remainingDueDecimal, collateralValueDecimal);
      const currentLtv = toNumber(currentLtvDecimal);

      // Update LTV in database
      await prisma.loan.update({
        where: { id: loan.id },
        data: { currentLtv },
      });

      // Check if liquidation is needed
      if (currentLtv >= CRITICAL_LTV_THRESHOLD) {
        logger.info('Liquidating loan', { loanId: loan.id, ltvPct: (currentLtv * 100).toFixed(1) });
        await liquidateLoan(loan.id, collateralValueIrr, remainingDue);
        liquidatedCount++;
      }
    }

    if (liquidatedCount > 0) {
      logger.info('Loans liquidated', { count: liquidatedCount });
    }
  } catch (error) {
    logger.error('Loan liquidation check error', error);
  }
}

/**
 * Liquidate a loan - sell collateral to repay debt
 */
async function liquidateLoan(
  loanId: string,
  collateralValueIrr: number,
  remainingDue: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // RACE CONDITION FIX: Use FOR UPDATE to lock the row and prevent concurrent processing
    // This prevents races between repayment and liquidation flows
    const lockedLoans = await tx.$queryRaw<Array<{
      id: string;
      status: string;
      portfolio_id: string;
      collateral_asset_id: string;
      collateral_quantity: string;
      total_due_irr: string;
      paid_irr: string;
    }>>`
      SELECT l.*, p.id as portfolio_id
      FROM loans l
      JOIN portfolios p ON l.portfolio_id = p.id
      WHERE l.id = ${loanId}::uuid AND l.status = 'ACTIVE'
      FOR UPDATE
    `;

    // If loan not found or not active, it was already processed
    if (!lockedLoans || lockedLoans.length === 0) {
      logger.info('Loan already processed or not found, skipping', { loanId });
      return;
    }

    const loanRow = lockedLoans[0];
    // Reconstruct loan object from raw query result
    const loan = {
      id: loanRow.id,
      status: loanRow.status,
      portfolioId: loanRow.portfolio_id,
      collateralAssetId: loanRow.collateral_asset_id,
      collateralQuantity: loanRow.collateral_quantity,
      totalDueIrr: loanRow.total_due_irr,
      paidIrr: loanRow.paid_irr,
      portfolio: { id: loanRow.portfolio_id },
    };

    // Calculate proceeds (collateral value minus any excess)
    const proceeds = Math.min(collateralValueIrr, remainingDue);
    const excess = Math.max(0, collateralValueIrr - remainingDue);
    const shortfallIrr = Math.max(0, remainingDue - collateralValueIrr);

    // Mark loan as liquidated with accurate paid amount
    // paidIrr should reflect actual proceeds from collateral sale, not total due
    const actualPaidFromLiquidation = proceeds;
    const previouslyPaid = Number(loan.paidIrr) || 0;

    await tx.loan.update({
      where: { id: loanId },
      data: {
        status: 'LIQUIDATED',
        paidIrr: previouslyPaid + actualPaidFromLiquidation, // Actual amount recovered
        shortfallIrr: shortfallIrr > 0 ? shortfallIrr : null,
      },
    });

    // Remove only the collateralized quantity from the holding, not all holdings of this asset
    // Users may have purchased more of the same asset after taking the loan
    const holding = await tx.holding.findFirst({
      where: {
        portfolioId: loan.portfolioId,
        assetId: loan.collateralAssetId,
      },
    });

    if (holding) {
      const collateralQty = Number(loan.collateralQuantity);
      const remainingQty = Number(holding.quantity) - collateralQty;

      if (remainingQty <= 0) {
        // All of this asset was collateralized, delete the holding
        await tx.holding.delete({
          where: { id: holding.id },
        });
      } else {
        // User has additional units beyond collateral, keep them
        await tx.holding.update({
          where: { id: holding.id },
          data: {
            quantity: remainingQty,
            frozen: false, // Unfreeze remaining quantity
          },
        });
      }
    }

    // If there's excess, return as cash
    if (excess > 0) {
      await tx.portfolio.update({
        where: { id: loan.portfolioId },
        data: { cashIrr: { increment: excess } },
      });
    }

    // Mark all installments as paid
    await tx.loanInstallment.updateMany({
      where: { loanId: loanId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    // Create ledger entry
    await tx.ledgerEntry.create({
      data: {
        portfolioId: loan.portfolioId,
        entryType: 'LOAN_LIQUIDATE',
        beforeSnapshot: {
          loanStatus: 'ACTIVE',
          collateralAssetId: loan.collateralAssetId,
          collateralQuantity: Number(loan.collateralQuantity),
        },
        afterSnapshot: {
          loanStatus: 'LIQUIDATED',
          collateralSold: true,
          excessReturned: excess,
        },
        amountIrr: collateralValueIrr,
        loanId: loanId,
        boundary: 'STRESS',
        message: 'Loan auto-liquidated: collateral ' + loan.collateralAssetId + ' sold to repay ' + remainingDue.toLocaleString() + ' IRR',
      },
    });

    // Create action log
    await tx.actionLog.create({
      data: {
        portfolioId: loan.portfolioId,
        actionType: 'LOAN_LIQUIDATE',
        boundary: 'STRESS',
        message: 'Loan liquidated (LTV exceeded 90%)',
        amountIrr: remainingDue,
        assetId: loan.collateralAssetId,
      },
    });
  });
}

/**
 * Check if background jobs are running
 */
export function areBackgroundJobsActive(): boolean {
  return jobIntervals.loanCheck !== null;
}

/**
 * Manually trigger loan liquidation check (for testing)
 */
export async function triggerLoanCheck(): Promise<void> {
  await runLoanLiquidationCheck();
}
