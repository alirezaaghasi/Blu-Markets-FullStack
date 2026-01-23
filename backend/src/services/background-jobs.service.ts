// Background Jobs Service
// Handles periodic tasks: loan liquidation checks, protection expiry
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { getCurrentPrices } from './price-fetcher.service.js';
import type { AssetId } from '../types/domain.js';

// Critical LTV threshold for auto-liquidation (90%)
const CRITICAL_LTV_THRESHOLD = 0.90;

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
    console.log('Background jobs disabled');
    return;
  }

  console.log('Starting background jobs');

  // Loan liquidation check every 5 minutes
  const loanIntervalMs = env.LOAN_CHECK_INTERVAL_MS || 5 * 60 * 1000;
  runLoanLiquidationCheck(); // Run immediately
  jobIntervals.loanCheck = setInterval(runLoanLiquidationCheck, loanIntervalMs);
  console.log('  Loan liquidation check: every ' + (loanIntervalMs / 1000) + 's');

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
  console.log('Background jobs stopped');
}

/**
 * Check all active loans for critical LTV and trigger liquidation if needed
 */
async function runLoanLiquidationCheck(): Promise<void> {
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
        console.warn('No price available for ' + assetId + ', skipping LTV check');
        continue;
      }

      // Calculate current collateral value
      const collateralValueIrr = Number(loan.collateralQuantity) * price.priceIrr;
      // Guard against negative remaining due (e.g., overpayment edge case)
      const remainingDue = Math.max(0, Number(loan.totalDueIrr) - Number(loan.paidIrr));

      // Guard against division by zero
      if (collateralValueIrr <= 0) {
        console.warn(`Invalid collateral value for loan ${loan.id}`);
        await prisma.loan.update({ where: { id: loan.id }, data: { currentLtv: 1.0 } });
        continue;
      }

      // Calculate current LTV
      const currentLtv = remainingDue / collateralValueIrr;

      // Update LTV in database
      await prisma.loan.update({
        where: { id: loan.id },
        data: { currentLtv },
      });

      // Check if liquidation is needed
      if (currentLtv >= CRITICAL_LTV_THRESHOLD) {
        console.log('Liquidating loan ' + loan.id + ': LTV ' + (currentLtv * 100).toFixed(1) + '%');
        await liquidateLoan(loan.id, collateralValueIrr, remainingDue);
        liquidatedCount++;
      }
    }

    if (liquidatedCount > 0) {
      console.log('Liquidated ' + liquidatedCount + ' loan(s)');
    }
  } catch (error) {
    console.error('Loan liquidation check error:', error);
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
    // CRITICAL: Re-fetch loan with status check to prevent race conditions
    // Another process might have already liquidated or repaid this loan
    const loan = await tx.loan.findFirst({
      where: {
        id: loanId,
        status: 'ACTIVE', // Only liquidate if still active
      },
      include: { portfolio: true },
    });

    // If loan not found or not active, it was already processed
    if (!loan) {
      console.log(`[LIQUIDATION] Loan ${loanId} already processed or not found, skipping`);
      return;
    }

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
