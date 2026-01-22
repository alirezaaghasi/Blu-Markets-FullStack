/**
 * Protection Scheduled Jobs
 * Handles protection expiry processing and settlement
 *
 * @module jobs/protection-jobs
 */

import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { getCurrentPrices } from '../services/price-fetcher.service.js';
import { calculateSettlement } from '../services/protection-pricing.service.js';
import type { AssetId } from '../types/domain.js';

// ============================================================================
// JOB INITIALIZATION
// ============================================================================

/**
 * Initialize all protection-related scheduled jobs
 */
export function initializeProtectionJobs(): void {
  console.log('[PROTECTION JOBS] Initializing scheduled jobs...');

  // Process expired protections daily at midnight UTC
  cron.schedule(
    '0 0 * * *',
    async () => {
      console.log('[CRON] Running protection expiry processing...');
      try {
        const result = await processExpiredProtections();
        console.log('[CRON] Expiry processing completed:', result);
      } catch (error) {
        console.error('[CRON] Expiry processing failed:', error);
      }
    },
    { timezone: 'UTC' }
  );

  // Risk exposure check every 6 hours
  cron.schedule(
    '0 */6 * * *',
    async () => {
      console.log('[CRON] Running risk exposure check...');
      try {
        const exposure = await checkRiskExposure();
        console.log('[CRON] Risk exposure:', exposure);
      } catch (error) {
        console.error('[CRON] Risk exposure check failed:', error);
      }
    },
    { timezone: 'UTC' }
  );

  console.log('[PROTECTION JOBS] Scheduled jobs initialized');
}

// ============================================================================
// EXPIRY PROCESSING
// ============================================================================

interface ExpiryResult {
  processed: number;
  exercised: number;
  expired: number;
  totalSettlementIrr: number;
  errors: number;
}

/**
 * Process all expired protections
 * - Check if protection is ITM (in the money)
 * - If ITM: credit user with settlement amount
 * - Update protection status
 */
export async function processExpiredProtections(): Promise<ExpiryResult> {
  const now = new Date();
  const result: ExpiryResult = {
    processed: 0,
    exercised: 0,
    expired: 0,
    totalSettlementIrr: 0,
    errors: 0,
  };

  // Find all active protections that have expired
  const expiredProtections = await prisma.protection.findMany({
    where: {
      status: 'ACTIVE',
      expiryDate: { lte: now },
    },
    include: {
      portfolio: true,
    },
  });

  console.log(`[EXPIRY] Found ${expiredProtections.length} expired protections to process`);

  // Get current prices
  const prices = await getCurrentPrices();

  for (const protection of expiredProtections) {
    try {
      await processProtectionExpiry(protection, prices, result);
      result.processed++;
    } catch (error) {
      console.error(`[EXPIRY] Failed to process protection ${protection.id}:`, error);
      result.errors++;
    }
  }

  return result;
}

/**
 * Process a single protection expiry
 */
async function processProtectionExpiry(
  protection: any,
  prices: Map<string, any>,
  result: ExpiryResult
): Promise<void> {
  const assetId = protection.assetId as AssetId;
  const priceData = prices.get(assetId);

  if (!priceData) {
    console.error(`[EXPIRY] No price data for ${assetId}, marking as expired`);
    await markProtectionExpired(protection, 0);
    result.expired++;
    return;
  }

  const currentPriceUsd = priceData.priceUsd;
  const strikeUsd = Number(protection.strikeUsd);
  const notionalUsd = Number(protection.notionalUsd);
  const fxRate = priceData.priceIrr / priceData.priceUsd;

  // Calculate settlement
  const settlement = calculateSettlement(strikeUsd, currentPriceUsd, notionalUsd, fxRate);

  if (settlement.isITM) {
    // Protection is in the money - credit user
    await exerciseProtection(protection, settlement.payoutIrr, settlement.payoutUsd);
    result.exercised++;
    result.totalSettlementIrr += settlement.payoutIrr;

    console.log(
      `[EXPIRY] Protection ${protection.id} exercised: ${assetId} dropped below strike. ` +
        `Payout: ${settlement.payoutIrr.toLocaleString()} IRR`
    );
  } else {
    // Protection expired worthless
    await markProtectionExpired(protection, 0);
    result.expired++;

    console.log(
      `[EXPIRY] Protection ${protection.id} expired worthless: ${assetId} above strike`
    );
  }
}

/**
 * Exercise a protection (ITM settlement)
 */
async function exerciseProtection(
  protection: any,
  settlementIrr: number,
  settlementUsd: number
): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Update protection status
    await tx.protection.update({
      where: { id: protection.id },
      data: {
        status: 'EXERCISED',
        settlementIrr,
        settlementUsd,
        settlementDate: now,
      },
    });

    // Credit user's cash balance
    await tx.portfolio.update({
      where: { id: protection.portfolioId },
      data: {
        cashIrr: { increment: settlementIrr },
      },
    });

    // Get updated cash balance for snapshot
    const updatedPortfolio = await tx.portfolio.findUnique({
      where: { id: protection.portfolioId },
    });

    // Create ledger entry
    await tx.ledgerEntry.create({
      data: {
        portfolioId: protection.portfolioId,
        entryType: 'PROTECTION_SETTLEMENT',
        beforeSnapshot: { cashIrr: Number(updatedPortfolio?.cashIrr || 0) - settlementIrr },
        afterSnapshot: { cashIrr: Number(updatedPortfolio?.cashIrr || 0) },
        amountIrr: settlementIrr,
        assetId: protection.assetId,
        protectionId: protection.id,
        boundary: 'SAFE',
        message: `Protection exercised: ${protection.assetId} settled at ${settlementIrr.toLocaleString()} IRR`,
      },
    });

    // Create action log
    await tx.actionLog.create({
      data: {
        portfolioId: protection.portfolioId,
        actionType: 'PROTECTION_EXERCISED',
        boundary: 'SAFE',
        message: `Protection payout: ${settlementIrr.toLocaleString()} IRR`,
        amountIrr: settlementIrr,
        assetId: protection.assetId,
      },
    });

    // Create hedge log for closure
    await tx.hedgeLog.create({
      data: {
        protectionId: protection.id,
        hedgeType: 'NAKED',
        action: 'CLOSE',
        notionalUsd: Number(protection.notionalUsd),
        hedgeRatio: 0,
      },
    });
  });
}

/**
 * Mark protection as expired (OTM)
 */
async function markProtectionExpired(protection: any, settlementIrr: number): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Update protection status
    await tx.protection.update({
      where: { id: protection.id },
      data: {
        status: 'EXPIRED',
        settlementIrr: 0,
        settlementUsd: 0,
        settlementDate: now,
      },
    });

    // Create ledger entry
    await tx.ledgerEntry.create({
      data: {
        portfolioId: protection.portfolioId,
        entryType: 'PROTECTION_EXPIRE',
        beforeSnapshot: {},
        afterSnapshot: {},
        amountIrr: 0,
        assetId: protection.assetId,
        protectionId: protection.id,
        boundary: 'SAFE',
        message: `Protection expired: ${protection.assetId} (no payout)`,
      },
    });

    // Create action log
    await tx.actionLog.create({
      data: {
        portfolioId: protection.portfolioId,
        actionType: 'PROTECTION_EXPIRED',
        boundary: 'SAFE',
        message: `Protection expired (no payout)`,
        amountIrr: 0,
        assetId: protection.assetId,
      },
    });

    // Create hedge log for closure
    await tx.hedgeLog.create({
      data: {
        protectionId: protection.id,
        hedgeType: 'NAKED',
        action: 'CLOSE',
        notionalUsd: Number(protection.notionalUsd),
        hedgeRatio: 0,
      },
    });
  });
}

// ============================================================================
// RISK EXPOSURE
// ============================================================================

interface RiskExposure {
  totalNotionalUsd: number;
  totalNotionalIrr: number;
  activeCount: number;
  byAsset: Record<string, { notionalUsd: number; count: number }>;
  expiringNext7Days: number;
  expiringNext30Days: number;
}

/**
 * Check current risk exposure from active protections
 */
export async function checkRiskExposure(): Promise<RiskExposure> {
  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Get all active protections
  const activeProtections = await prisma.protection.findMany({
    where: { status: 'ACTIVE' },
  });

  const exposure: RiskExposure = {
    totalNotionalUsd: 0,
    totalNotionalIrr: 0,
    activeCount: activeProtections.length,
    byAsset: {},
    expiringNext7Days: 0,
    expiringNext30Days: 0,
  };

  for (const protection of activeProtections) {
    const notionalUsd = Number(protection.notionalUsd) || 0;
    const notionalIrr = Number(protection.notionalIrr);

    exposure.totalNotionalUsd += notionalUsd;
    exposure.totalNotionalIrr += notionalIrr;

    // By asset
    if (!exposure.byAsset[protection.assetId]) {
      exposure.byAsset[protection.assetId] = { notionalUsd: 0, count: 0 };
    }
    exposure.byAsset[protection.assetId].notionalUsd += notionalUsd;
    exposure.byAsset[protection.assetId].count++;

    // Expiring soon
    if (protection.expiryDate <= next7Days) {
      exposure.expiringNext7Days++;
    }
    if (protection.expiryDate <= next30Days) {
      exposure.expiringNext30Days++;
    }
  }

  // Log warning if exposure is high
  const WARN_THRESHOLD_USD = 100_000;
  if (exposure.totalNotionalUsd > WARN_THRESHOLD_USD) {
    console.warn(
      `[RISK] High naked exposure: $${exposure.totalNotionalUsd.toFixed(0)} ` +
        `(threshold: $${WARN_THRESHOLD_USD})`
    );
  }

  return exposure;
}

// ============================================================================
// MANUAL TRIGGERS (for testing/admin)
// ============================================================================

/**
 * Manually trigger expiry processing (for testing)
 */
export async function triggerExpiryProcessing(): Promise<ExpiryResult> {
  console.log('[MANUAL] Triggering expiry processing...');
  return processExpiredProtections();
}

/**
 * Get current risk summary (for dashboard)
 */
export async function getCurrentRiskSummary(): Promise<RiskExposure> {
  return checkRiskExposure();
}

/**
 * Process a specific protection (for testing)
 */
export async function processSpecificProtection(protectionId: string): Promise<void> {
  const protection = await prisma.protection.findUnique({
    where: { id: protectionId },
    include: { portfolio: true },
  });

  if (!protection) {
    throw new Error('Protection not found');
  }

  if (protection.status !== 'ACTIVE') {
    throw new Error('Protection is not active');
  }

  const prices = await getCurrentPrices();
  const result: ExpiryResult = {
    processed: 0,
    exercised: 0,
    expired: 0,
    totalSettlementIrr: 0,
    errors: 0,
  };

  await processProtectionExpiry(protection, prices, result);
}
