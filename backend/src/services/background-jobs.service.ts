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
  protectionCheck: NodeJS.Timeout | null;
} = {
  loanCheck: null,
  protectionCheck: null,
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

  // Protection expiry check every hour
  const protectionIntervalMs = env.PROTECTION_CHECK_INTERVAL_MS || 60 * 60 * 1000;
  runProtectionExpiryCheck(); // Run immediately
  jobIntervals.protectionCheck = setInterval(runProtectionExpiryCheck, protectionIntervalMs);
  console.log('  Protection expiry check: every ' + (protectionIntervalMs / 1000) + 's');
}

/**
 * Stop all background jobs
 */
export function stopBackgroundJobs(): void {
  if (jobIntervals.loanCheck) {
    clearInterval(jobIntervals.loanCheck);
    jobIntervals.loanCheck = null;
  }
  if (jobIntervals.protectionCheck) {
    clearInterval(jobIntervals.protectionCheck);
    jobIntervals.protectionCheck = null;
  }
  console.log('Background jobs stopped');
}

/**
 * Check all active loans for critical LTV and trigger liquidation if needed
 */
async function runLoanLiquidationCheck(): Promise<void> {
  try {
    // Get all active loans
    const activeLoans = await prisma.loan.findMany({
      where: { status: 'ACTIVE' },
      include: {
        portfolio: {
          include: { holdings: true },
        },
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
      const remainingDue = Number(loan.totalDueIrr) - Number(loan.paidIrr);

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
    const loan = await tx.loan.findUniqueOrThrow({
      where: { id: loanId },
      include: { portfolio: true },
    });

    // Calculate proceeds (collateral value minus any excess)
    const proceeds = Math.min(collateralValueIrr, remainingDue);
    const excess = Math.max(0, collateralValueIrr - remainingDue);

    // Mark loan as liquidated
    await tx.loan.update({
      where: { id: loanId },
      data: {
        status: 'LIQUIDATED',
        paidIrr: Number(loan.totalDueIrr), // Mark as fully paid via liquidation
      },
    });

    // Remove collateral holding (selling it)
    await tx.holding.deleteMany({
      where: {
        portfolioId: loan.portfolioId,
        assetId: loan.collateralAssetId,
      },
    });

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
 * Check for expired protections and update their status
 */
async function runProtectionExpiryCheck(): Promise<void> {
  try {
    const now = new Date();

    // Find active protections that have expired
    const expiredProtections = await prisma.protection.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: { lte: now },
      },
      include: { portfolio: true },
    });

    if (expiredProtections.length === 0) return;

    console.log('Processing ' + expiredProtections.length + ' expired protection(s)');

    for (const protection of expiredProtections) {
      await prisma.$transaction(async (tx) => {
        // Update protection status
        await tx.protection.update({
          where: { id: protection.id },
          data: { status: 'EXPIRED' },
        });

        // Create ledger entry
        await tx.ledgerEntry.create({
          data: {
            portfolioId: protection.portfolioId,
            entryType: 'PROTECTION_EXPIRE',
            beforeSnapshot: { status: 'ACTIVE' },
            afterSnapshot: { status: 'EXPIRED' },
            assetId: protection.assetId,
            protectionId: protection.id,
            boundary: 'SAFE',
            message: 'Protection expired for ' + protection.assetId,
          },
        });

        // Create action log
        await tx.actionLog.create({
          data: {
            portfolioId: protection.portfolioId,
            actionType: 'PROTECTION_EXPIRE',
            boundary: 'SAFE',
            message: 'Protection expired for ' + protection.assetId,
            assetId: protection.assetId,
          },
        });
      });
    }

    console.log('Marked ' + expiredProtections.length + ' protection(s) as expired');
  } catch (error) {
    console.error('Protection expiry check error:', error);
  }
}

/**
 * Check if background jobs are running
 */
export function areBackgroundJobsActive(): boolean {
  return jobIntervals.loanCheck !== null || jobIntervals.protectionCheck !== null;
}

/**
 * Manually trigger loan liquidation check (for testing)
 */
export async function triggerLoanCheck(): Promise<void> {
  await runLoanLiquidationCheck();
}

/**
 * Manually trigger protection expiry check (for testing)
 */
export async function triggerProtectionCheck(): Promise<void> {
  await runProtectionExpiryCheck();
}
