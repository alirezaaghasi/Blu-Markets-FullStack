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
import { logger } from '../utils/logger.js';
import type { AssetId } from '../types/domain.js';
import type { Protection } from '@prisma/client';

// Protection type alias (portfolio no longer eagerly loaded)
type ProtectionRecord = Protection;

// Type for price data from getCurrentPrices
interface PriceData {
  priceUsd: number;
  priceIrr: number;
  change24hPct?: number;
}

// ============================================================================
// JOB INITIALIZATION
// ============================================================================

/**
 * Initialize all protection-related scheduled jobs
 */
export function initializeProtectionJobs(): void {
  logger.info('Initializing protection scheduled jobs');

  // Process expired protections daily at midnight UTC
  cron.schedule(
    '0 0 * * *',
    async () => {
      logger.info('Running protection expiry processing');
      try {
        const result = await processExpiredProtections();
        logger.info('Expiry processing completed', { ...result });
      } catch (error) {
        logger.error('Expiry processing failed', error);
      }
    },
    { timezone: 'UTC' }
  );

  // Risk exposure check every 6 hours
  cron.schedule(
    '0 */6 * * *',
    async () => {
      logger.info('Running risk exposure check');
      try {
        const exposure = await checkRiskExposure();
        logger.info('Risk exposure calculated', { ...exposure });
      } catch (error) {
        logger.error('Risk exposure check failed', error);
      }
    },
    { timezone: 'UTC' }
  );

  logger.info('Protection scheduled jobs initialized');
}

// ============================================================================
// EXPIRY PROCESSING
// ============================================================================

interface ExpiryResult {
  processed: number;
  exercised: number;
  expired: number;
  pendingPriceData: number;
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
    pendingPriceData: 0,
    totalSettlementIrr: 0,
    errors: 0,
  };

  // Find all active protections that have expired
  // OPTIMIZATION: Removed portfolio include (not used, only portfolioId needed)
  const expiredProtections = await prisma.protection.findMany({
    where: {
      status: 'ACTIVE',
      expiryDate: { lte: now },
    },
  });

  logger.info('Found expired protections to process', { count: expiredProtections.length });

  // Get current prices
  const prices = await getCurrentPrices();

  for (const protection of expiredProtections) {
    try {
      const wasProcessed = await processProtectionExpiry(protection, prices, result);
      if (wasProcessed) {
        result.processed++;
      }
    } catch (error) {
      logger.error('Failed to process protection', error, { protectionId: protection.id });
      result.errors++;
    }
  }

  return result;
}

/**
 * Process a single protection expiry
 * @returns true if the protection was actually settled/expired, false if skipped
 */
async function processProtectionExpiry(
  protection: ProtectionRecord,
  prices: Map<string, PriceData>,
  result: ExpiryResult
): Promise<boolean> {
  const assetId = protection.assetId as AssetId;
  const priceData = prices.get(assetId);

  if (!priceData) {
    // IMPORTANT: Do not expire protections when price data is unavailable.
    // This could be a transient price feed outage - retry on next job run.
    logger.warn('No price data for asset, skipping protection', {
      assetId,
      protectionId: protection.id,
      note: 'Will retry on next scheduled run',
    });
    result.pendingPriceData++;
    return false; // Not processed - will retry
  }

  // Use captured expiry price if available, otherwise capture current price
  // This ensures settlement uses the price at expiry moment, not runtime
  const expiryPriceUsd = protection.expiryPriceUsd
    ? Number(protection.expiryPriceUsd)
    : priceData.priceUsd;
  const expiryPriceIrr = protection.expiryPriceIrr
    ? Number(protection.expiryPriceIrr)
    : priceData.priceIrr;

  // Capture expiry price if not already captured
  if (!protection.expiryPriceUsd) {
    await prisma.protection.update({
      where: { id: protection.id },
      data: {
        expiryPriceUsd: priceData.priceUsd,
        expiryPriceIrr: priceData.priceIrr,
      },
    });
  }

  const strikeUsd = Number(protection.strikeUsd);
  const notionalUsd = Number(protection.notionalUsd);

  // Guard against division by zero for FX rate calculation
  if (expiryPriceUsd <= 0) {
    logger.error('Invalid expiry price USD, skipping protection', undefined, {
      expiryPriceUsd,
      protectionId: protection.id,
    });
    result.errors++;
    return false;
  }
  const fxRate = expiryPriceIrr / expiryPriceUsd;

  // Calculate settlement using expiry price
  const settlement = calculateSettlement(strikeUsd, expiryPriceUsd, notionalUsd, fxRate);

  if (settlement.isITM) {
    // Protection is in the money - credit user
    await exerciseProtection(protection, settlement.payoutIrr, settlement.payoutUsd);
    result.exercised++;
    result.totalSettlementIrr += settlement.payoutIrr;

    logger.info('Protection exercised', {
      protectionId: protection.id,
      assetId,
      payoutIrr: settlement.payoutIrr,
    });
  } else {
    // Protection expired worthless
    await markProtectionExpired(protection, 0);
    result.expired++;

    logger.info('Protection expired worthless', {
      protectionId: protection.id,
      assetId,
    });
  }

  return true; // Successfully processed
}

/**
 * Exercise a protection (ITM settlement)
 */
async function exerciseProtection(
  protection: ProtectionRecord,
  settlementIrr: number,
  settlementUsd: number
): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // CRITICAL: Use conditional update to prevent double-processing
    // Only update if status is still ACTIVE (guards against race conditions)
    const updateResult = await tx.protection.updateMany({
      where: {
        id: protection.id,
        status: 'ACTIVE', // Only process if still active
      },
      data: {
        status: 'EXERCISED',
        settlementIrr,
        settlementUsd,
        settlementDate: now,
      },
    });

    // If no rows updated, protection was already processed
    if (updateResult.count === 0) {
      logger.warn('Protection already processed, skipping', { protectionId: protection.id });
      return;
    }

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
async function markProtectionExpired(protection: ProtectionRecord, settlementIrr: number): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // CRITICAL: Use conditional update to prevent double-processing
    // Only update if status is still ACTIVE (guards against race conditions)
    const updateResult = await tx.protection.updateMany({
      where: {
        id: protection.id,
        status: 'ACTIVE', // Only process if still active
      },
      data: {
        status: 'EXPIRED',
        settlementIrr: 0,
        settlementUsd: 0,
        settlementDate: now,
      },
    });

    // If no rows updated, protection was already processed
    if (updateResult.count === 0) {
      logger.warn('Protection already processed, skipping', { protectionId: protection.id });
      return;
    }

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
    logger.warn('High naked exposure', {
      totalNotionalUsd: exposure.totalNotionalUsd,
      thresholdUsd: WARN_THRESHOLD_USD,
    });
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
  logger.info('Manually triggering expiry processing');
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
    pendingPriceData: 0,
    totalSettlementIrr: 0,
    errors: 0,
  };

  await processProtectionExpiry(protection, prices, result);
}
