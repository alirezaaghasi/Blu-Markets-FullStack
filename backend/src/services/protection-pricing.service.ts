/**
 * Protection Pricing Service
 * Generates dynamic protection quotes using Black-Scholes pricing
 *
 * @module services/protection-pricing.service
 */

import { randomUUID } from 'crypto';
import { prisma } from '../config/database.js';
import {
  blackScholesPut,
  calculatePutGreeks,
  daysToYears,
  RISK_FREE_RATE,
  type PutGreeks,
} from './options-math.js';
import {
  getImpliedVolatility,
  getVolatilityRegime,
  getAssetLayer,
  type VolatilityRegime,
} from './volatility.service.js';
import { getCurrentPrices } from './price-fetcher.service.js';
import { AppError } from '../middleware/error-handler.js';
import type { AssetId, Layer } from '../types/domain.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Duration presets in days */
export const DURATION_PRESETS = [7, 14, 30, 60, 90, 180] as const;
export type DurationDays = (typeof DURATION_PRESETS)[number];

/** Coverage limits */
export const MIN_COVERAGE_PCT = 0.1; // 10%
export const MAX_COVERAGE_PCT = 1.0; // 100%
export const DEFAULT_COVERAGE_PCT = 1.0;

/** Strike (fixed at ATM for MVP) */
export const DEFAULT_STRIKE_PCT = 1.0;

/** Quote validity duration (5 minutes) */
export const QUOTE_VALIDITY_MS = 5 * 60 * 1000;

/** Premium tolerance for purchase validation (5%) */
export const PREMIUM_TOLERANCE = 0.05;

/** Maximum cache size to prevent memory exhaustion (DoS protection) */
export const MAX_QUOTE_CACHE_SIZE = 10_000;

/** Minimum notional in IRR */
export const MIN_NOTIONAL_IRR = 1_000_000;

/** Global minimum premium floor (2.5% per 30 days, non-negotiable) */
export const GLOBAL_MIN_PREMIUM_FLOOR_30D = 0.025;

/** Assets eligible for protection */
export const PROTECTION_ELIGIBLE_ASSETS: AssetId[] = ['BTC', 'ETH', 'PAXG', 'KAG', 'QQQ', 'SOL'];

/**
 * Execution spread by asset (bid-ask spread cost)
 */
const EXECUTION_SPREAD: Record<string, number> = {
  BTC: 0.004, // 0.4%
  ETH: 0.005, // 0.5%
  SOL: 0.008, // 0.8%
  PAXG: 0.003, // 0.3%
  KAG: 0.004, // 0.4%
  QQQ: 0.002, // 0.2%
};

/**
 * Profit margin per day by layer
 */
const PROFIT_MARGIN_PER_DAY: Record<Layer, number> = {
  FOUNDATION: 0.00003, // 0.003% per day
  GROWTH: 0.00007, // 0.007% per day
  UPSIDE: 0.0001, // 0.01% per day
};

/**
 * Premium bounds (per 30 days)
 * These prevent unrealistic pricing in edge cases
 * IMPORTANT: All values must be >= GLOBAL_MIN_PREMIUM_FLOOR_30D (2.5%)
 */
const MIN_PREMIUM_30D: Record<string, number> = {
  BTC: 0.025, // 2.5% (floor)
  ETH: 0.025, // 2.5% (floor)
  SOL: 0.025, // 2.5% (floor)
  PAXG: 0.025, // 2.5% (floor)
  KAG: 0.025, // 2.5% (floor)
  QQQ: 0.025, // 2.5% (floor)
};

const MAX_PREMIUM_30D: Record<string, number> = {
  BTC: 0.08, // 8%
  ETH: 0.10, // 10%
  SOL: 0.12, // 12%
  PAXG: 0.03, // 3%
  KAG: 0.035, // 3.5%
  QQQ: 0.04, // 4%
};

// ============================================================================
// QUOTE CACHE (In-memory for MVP)
// ============================================================================
// NOTE: For production multi-instance deployments, replace with Redis or
// database-backed quotes. The current implementation uses atomic reservation
// to prevent race conditions within a single instance.

type QuoteStatus = 'available' | 'reserved' | 'consumed';

interface CachedQuote {
  quote: ProtectionQuote;
  userId: string;
  createdAt: Date;
  status: QuoteStatus;
  reservedAt?: Date;
}

/** In-memory quote cache with TTL and size limit */
const quoteCache = new Map<string, CachedQuote>();

/** Index of quotes by holdingId for fast invalidation */
const quotesByHolding = new Map<string, Set<string>>();

/**
 * Clean up expired quotes periodically.
 *
 * Reservation expiration is tied to quote validity (not a fixed timeout) to prevent
 * releasing a reservation while a transaction is still running. This is safer because:
 * 1. Quote validity (5 min) is longer than any reasonable transaction time
 * 2. If quote expires during transaction, the transaction will fail on quote validation anyway
 * 3. DB-level check for existing active protection provides additional safety net
 */
function cleanupExpiredQuotes(): void {
  const now = new Date();
  for (const [quoteId, cached] of quoteCache.entries()) {
    // Remove expired quotes (this also handles reserved quotes that expired)
    // When a quote expires, any reservation on it is implicitly released
    if (now > cached.quote.validUntil) {
      removeQuoteFromCache(quoteId, cached.quote.holdingId);
      continue;
    }
    // Note: We intentionally do NOT release reservations based on a fixed timeout.
    // Reserved quotes remain reserved until:
    // 1. Transaction succeeds (consumeQuote called)
    // 2. Transaction fails (releaseQuote called)
    // 3. Quote expires (removed by cleanup above)
  }
}

// Run cleanup every minute
setInterval(cleanupExpiredQuotes, 60_000);

/**
 * Remove a quote from cache and holding index
 */
function removeQuoteFromCache(quoteId: string, holdingId: string): void {
  quoteCache.delete(quoteId);
  const holdingQuotes = quotesByHolding.get(holdingId);
  if (holdingQuotes) {
    holdingQuotes.delete(quoteId);
    if (holdingQuotes.size === 0) {
      quotesByHolding.delete(holdingId);
    }
  }
}

/**
 * Evict oldest quotes when cache exceeds size limit (LRU eviction)
 */
function evictOldestQuotes(): void {
  if (quoteCache.size <= MAX_QUOTE_CACHE_SIZE) {
    return;
  }

  // Sort by creation time and evict oldest 10%
  const entries = Array.from(quoteCache.entries());
  entries.sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());

  const evictCount = Math.max(1, Math.floor(quoteCache.size * 0.1));
  for (let i = 0; i < evictCount && i < entries.length; i++) {
    const [quoteId, cached] = entries[i];
    removeQuoteFromCache(quoteId, cached.quote.holdingId);
  }
}

/**
 * Store a quote in the cache
 */
function cacheQuote(quote: ProtectionQuote, userId: string): void {
  // Evict old quotes if cache is full
  evictOldestQuotes();

  quoteCache.set(quote.quoteId, {
    quote,
    userId,
    createdAt: new Date(),
    status: 'available',
  });

  // Index by holdingId for fast invalidation
  let holdingQuotes = quotesByHolding.get(quote.holdingId);
  if (!holdingQuotes) {
    holdingQuotes = new Set();
    quotesByHolding.set(quote.holdingId, holdingQuotes);
  }
  holdingQuotes.add(quote.quoteId);
}

/**
 * Retrieve and validate a cached quote (read-only, does not reserve)
 * @throws AppError if quote not found, expired, or belongs to different user
 */
export function getAndValidateCachedQuote(quoteId: string, userId: string): ProtectionQuote {
  const cached = quoteCache.get(quoteId);

  if (!cached) {
    throw new AppError('QUOTE_NOT_FOUND', 'Quote not found or already used', 404, { quoteId });
  }

  if (cached.userId !== userId) {
    throw new AppError('UNAUTHORIZED', 'Quote does not belong to user', 401);
  }

  if (!isQuoteValid(cached.quote)) {
    removeQuoteFromCache(quoteId, cached.quote.holdingId);
    throw new AppError('QUOTE_EXPIRED', 'Quote has expired, please request a new quote', 410, {
      quoteId,
      expiredAt: cached.quote.validUntil.toISOString(),
    });
  }

  // Check if already consumed or reserved by another transaction
  if (cached.status === 'consumed') {
    throw new AppError('QUOTE_NOT_FOUND', 'Quote has already been used', 404, { quoteId });
  }

  if (cached.status === 'reserved') {
    throw new AppError('QUOTE_IN_USE', 'Quote is being processed by another transaction', 409, { quoteId });
  }

  return cached.quote;
}

/**
 * Atomically reserve a quote for purchase (prevents race conditions)
 * Must be called BEFORE starting the database transaction.
 * @returns The quote if reservation successful
 * @throws AppError if quote not found, expired, already reserved, or belongs to different user
 */
export function reserveQuote(quoteId: string, userId: string): ProtectionQuote {
  const cached = quoteCache.get(quoteId);

  if (!cached) {
    throw new AppError('QUOTE_NOT_FOUND', 'Quote not found or already used', 404, { quoteId });
  }

  if (cached.userId !== userId) {
    throw new AppError('UNAUTHORIZED', 'Quote does not belong to user', 401);
  }

  if (!isQuoteValid(cached.quote)) {
    removeQuoteFromCache(quoteId, cached.quote.holdingId);
    throw new AppError('QUOTE_EXPIRED', 'Quote has expired, please request a new quote', 410, {
      quoteId,
      expiredAt: cached.quote.validUntil.toISOString(),
    });
  }

  // Atomic status check and update (synchronous, single-threaded in Node.js)
  if (cached.status === 'consumed') {
    throw new AppError('QUOTE_NOT_FOUND', 'Quote has already been used', 404, { quoteId });
  }

  if (cached.status === 'reserved') {
    throw new AppError('QUOTE_IN_USE', 'Quote is being processed by another transaction', 409, { quoteId });
  }

  // Reserve the quote atomically
  cached.status = 'reserved';
  cached.reservedAt = new Date();

  return cached.quote;
}

/**
 * Release a reserved quote (call on transaction failure)
 */
export function releaseQuote(quoteId: string): void {
  const cached = quoteCache.get(quoteId);
  if (cached && cached.status === 'reserved') {
    cached.status = 'available';
    cached.reservedAt = undefined;
  }
}

/**
 * Consume a quote (mark as consumed after successful purchase)
 * Also invalidates all other quotes for the same holding to prevent duplicate purchases.
 * Call this AFTER the transaction succeeds.
 */
export function consumeQuote(quoteId: string): void {
  const cached = quoteCache.get(quoteId);
  if (cached) {
    // Mark as consumed (not just deleted, for debugging/audit)
    cached.status = 'consumed';
    // Invalidate ALL quotes for this holding to prevent duplicate protection purchases
    invalidateQuotesForHolding(cached.quote.holdingId);
  }
}

/**
 * Invalidate all cached quotes for a specific holding
 * Called after purchase to prevent duplicate protection purchases
 */
export function invalidateQuotesForHolding(holdingId: string): void {
  const holdingQuotes = quotesByHolding.get(holdingId);
  if (holdingQuotes) {
    for (const quoteId of holdingQuotes) {
      quoteCache.delete(quoteId);
    }
    quotesByHolding.delete(holdingId);
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface ProtectionQuote {
  quoteId: string;
  holdingId: string;
  assetId: AssetId;

  // Coverage
  coveragePct: number;
  notionalIrr: number;
  notionalUsd: number;

  // Strike
  strikePct: number;
  strikeUsd: number;
  strikeIrr: number;

  // Duration
  durationDays: number;

  // Spot price at quote time
  spotPriceUsd: number;
  spotPriceIrr: number;

  // Premium breakdown
  premiumPct: number;
  premiumIrr: number;
  premiumUsd: number;
  fairValuePct: number;
  executionSpreadPct: number;
  profitMarginPct: number;

  // Volatility info
  impliedVolatility: number;
  volatilityRegime: VolatilityRegime;

  // Greeks
  greeks: PutGreeks;

  // Validity
  quotedAt: Date;
  validUntil: Date;
}

export interface QuoteCurveItem {
  durationDays: number;
  premiumPct: number;
  premiumIrr: number;
  premiumPerDayPct: number;
  impliedVolatility: number;
}

export interface HoldingForProtection {
  holdingId: string;
  assetId: AssetId;
  quantity: number;
  valueIrr: number;
  valueUsd: number;
  layer: Layer;
  alreadyProtected: boolean;
  estimatedPremiumPct: number;
}

// ============================================================================
// MAIN QUOTE GENERATION
// ============================================================================

/**
 * Generate a protection quote for a holding
 *
 * @param holdingId - ID of the holding to protect
 * @param coveragePct - Percentage of holding to protect (0.1-1.0)
 * @param durationDays - Protection duration in days
 * @param userId - User ID for validation
 */
export async function getProtectionQuote(
  holdingId: string,
  coveragePct: number,
  durationDays: number,
  userId: string
): Promise<ProtectionQuote> {
  // Validate coverage
  if (coveragePct < MIN_COVERAGE_PCT || coveragePct > MAX_COVERAGE_PCT) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Coverage must be between ${MIN_COVERAGE_PCT * 100}% and ${MAX_COVERAGE_PCT * 100}%`,
      400,
      { min: MIN_COVERAGE_PCT, max: MAX_COVERAGE_PCT, provided: coveragePct }
    );
  }

  // Validate duration
  if (!DURATION_PRESETS.includes(durationDays as DurationDays)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Duration must be one of: ${DURATION_PRESETS.join(', ')} days`,
      400,
      { validDurations: DURATION_PRESETS, provided: durationDays }
    );
  }

  // Get holding with portfolio
  // Handle both UUID holdingId and demo-prefixed IDs (e.g., "demo-ETH")
  let holding;
  const isDemoHoldingId = holdingId.startsWith('demo-');

  if (isDemoHoldingId) {
    // Extract assetId from demo holding ID (e.g., "demo-ETH" -> "ETH")
    const extractedAssetId = holdingId.replace('demo-', '');

    // Look up by portfolio + assetId
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId },
      include: {
        holdings: { where: { assetId: extractedAssetId } },
        protections: { where: { status: 'ACTIVE' } },
      },
    });

    if (!portfolio || portfolio.holdings.length === 0) {
      throw new AppError('NOT_FOUND', 'Holding not found', 404, { holdingId, assetId: extractedAssetId });
    }

    // Construct the holding object with the portfolio reference for compatibility
    holding = {
      ...portfolio.holdings[0],
      portfolio: {
        userId: portfolio.userId,
        protections: portfolio.protections,
      },
    };
  } else {
    // Standard UUID lookup
    holding = await prisma.holding.findUnique({
      where: { id: holdingId },
      include: {
        portfolio: {
          include: {
            protections: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });
  }

  if (!holding) {
    throw new AppError('NOT_FOUND', 'Holding not found', 404, { holdingId });
  }

  if (holding.portfolio.userId !== userId) {
    throw new AppError('UNAUTHORIZED', 'Holding does not belong to user', 401);
  }

  const assetId = holding.assetId as AssetId;

  // Check if asset is eligible
  if (!PROTECTION_ELIGIBLE_ASSETS.includes(assetId)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Asset ${assetId} is not eligible for protection`,
      400,
      { assetId, eligibleAssets: PROTECTION_ELIGIBLE_ASSETS }
    );
  }

  // Check if already protected
  const existingProtection = holding.portfolio.protections.find(
    (p) => p.holdingId === holdingId && p.status === 'ACTIVE'
  );
  if (existingProtection) {
    throw new AppError(
      'CONFLICT',
      'This holding already has active protection',
      409,
      { existingProtectionId: existingProtection.id }
    );
  }

  // Get current price
  const prices = await getCurrentPrices();
  const priceData = prices.get(assetId);

  if (!priceData) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      `No price data available for ${assetId}`,
      503,
      { assetId }
    );
  }

  const spotPriceUsd = priceData.priceUsd;
  const spotPriceIrr = priceData.priceIrr;

  // Guard against division by zero or invalid prices
  if (!spotPriceUsd || spotPriceUsd <= 0 || !isFinite(spotPriceUsd)) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      `Invalid USD price for ${assetId}`,
      503,
      { assetId, priceUsd: spotPriceUsd }
    );
  }

  const fxRate = priceData.priceIrr / priceData.priceUsd;

  // Calculate notional
  const holdingValueUsd = Number(holding.quantity) * spotPriceUsd;
  const holdingValueIrr = Number(holding.quantity) * spotPriceIrr;
  const notionalUsd = holdingValueUsd * coveragePct;
  const notionalIrr = holdingValueIrr * coveragePct;

  // Validate minimum notional
  if (notionalIrr < MIN_NOTIONAL_IRR) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Minimum protected value is ${MIN_NOTIONAL_IRR.toLocaleString()} IRR`,
      400,
      { minNotionalIrr: MIN_NOTIONAL_IRR, providedNotionalIrr: notionalIrr }
    );
  }

  // Calculate strike (ATM for MVP)
  const strikePct = DEFAULT_STRIKE_PCT;
  const strikeUsd = spotPriceUsd * strikePct;
  const strikeIrr = spotPriceIrr * strikePct;

  // Get volatility
  const volData = getImpliedVolatility(assetId, durationDays, strikePct);
  const impliedVolatility = volData.adjustedVolatility;
  const volatilityRegime = volData.regime;

  // Calculate time to expiry in years
  const timeYears = daysToYears(durationDays);

  // Get layer for profit margin
  const layer = getAssetLayer(assetId);

  // Calculate premium components
  const executionSpreadPct = EXECUTION_SPREAD[assetId] || 0.005;
  const profitMarginPct = PROFIT_MARGIN_PER_DAY[layer] * durationDays;

  // Calculate Black-Scholes fair value
  const fairValuePct = blackScholesPut(1, strikePct, timeYears, impliedVolatility, RISK_FREE_RATE);

  // Total premium
  let totalPremiumPct = fairValuePct + executionSpreadPct + profitMarginPct;

  // Apply bounds with global floor enforcement
  const assetMinPremium = MIN_PREMIUM_30D[assetId] || GLOBAL_MIN_PREMIUM_FLOOR_30D;
  const effectiveMinPremium = Math.max(assetMinPremium, GLOBAL_MIN_PREMIUM_FLOOR_30D);
  const minPremium = effectiveMinPremium * (durationDays / 30);
  const maxPremium = (MAX_PREMIUM_30D[assetId] || 0.10) * (durationDays / 30);
  totalPremiumPct = Math.max(minPremium, Math.min(maxPremium, totalPremiumPct));

  // Calculate premium amounts
  const premiumUsd = notionalUsd * totalPremiumPct;
  const premiumIrr = notionalIrr * totalPremiumPct;

  // Calculate Greeks
  const greeks = calculatePutGreeks(spotPriceUsd, strikeUsd, timeYears, impliedVolatility, RISK_FREE_RATE);

  // Generate quote
  const now = new Date();
  const quote: ProtectionQuote = {
    quoteId: `PQ-${randomUUID().slice(0, 8)}`,
    holdingId,
    assetId,

    coveragePct,
    notionalIrr,
    notionalUsd,

    strikePct,
    strikeUsd,
    strikeIrr,

    durationDays,

    spotPriceUsd,
    spotPriceIrr,

    premiumPct: totalPremiumPct,
    premiumIrr,
    premiumUsd,
    fairValuePct,
    executionSpreadPct,
    profitMarginPct,

    impliedVolatility,
    volatilityRegime,

    greeks,

    quotedAt: now,
    validUntil: new Date(now.getTime() + QUOTE_VALIDITY_MS),
  };

  // Cache the quote for later validation during purchase
  cacheQuote(quote, userId);

  return quote;
}

// ============================================================================
// PREMIUM CURVES
// ============================================================================

/**
 * Get quotes for all duration presets
 */
export async function getPremiumCurve(
  holdingId: string,
  coveragePct: number,
  userId: string
): Promise<QuoteCurveItem[]> {
  // OPTIMIZATION: Fetch holding and prices once, then compute all durations in memory
  // This avoids redundant DB and price lookups for each duration variant

  // Fetch holding once - handle both UUID and demo-prefixed IDs
  let holding;
  const isDemoHoldingId = holdingId.startsWith('demo-');

  if (isDemoHoldingId) {
    // Extract assetId from demo holding ID (e.g., "demo-ETH" -> "ETH")
    const extractedAssetId = holdingId.replace('demo-', '');

    // Look up by portfolio + assetId
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId },
      include: {
        holdings: { where: { assetId: extractedAssetId } },
      },
    });

    if (!portfolio || portfolio.holdings.length === 0) {
      throw new AppError('NOT_FOUND', 'Holding not found', 404, { holdingId, assetId: extractedAssetId });
    }

    holding = {
      ...portfolio.holdings[0],
      portfolio: { userId: portfolio.userId },
    };
  } else {
    holding = await prisma.holding.findUnique({
      where: { id: holdingId },
      include: { portfolio: true },
    });
  }

  if (!holding) {
    throw new AppError('NOT_FOUND', 'Holding not found', 404, { holdingId });
  }

  if (holding.portfolio.userId !== userId) {
    throw new AppError('UNAUTHORIZED', 'Holding does not belong to user', 401);
  }

  const assetId = holding.assetId as AssetId;

  // Check if asset is eligible
  if (!PROTECTION_ELIGIBLE_ASSETS.includes(assetId)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Asset ${assetId} is not eligible for protection`,
      400,
      { assetId, eligibleAssets: PROTECTION_ELIGIBLE_ASSETS }
    );
  }

  // Fetch prices once
  const prices = await getCurrentPrices();
  const priceData = prices.get(assetId);

  if (!priceData || !priceData.priceUsd || priceData.priceUsd <= 0) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      `No valid price data for ${assetId}`,
      503,
      { assetId }
    );
  }

  const spotPriceUsd = priceData.priceUsd;
  const spotPriceIrr = priceData.priceIrr;
  const holdingValueUsd = Number(holding.quantity) * spotPriceUsd;
  const holdingValueIrr = Number(holding.quantity) * spotPriceIrr;
  const notionalUsd = holdingValueUsd * coveragePct;
  const notionalIrr = holdingValueIrr * coveragePct;
  const strikePct = DEFAULT_STRIKE_PCT;
  const layer = getAssetLayer(assetId);
  const executionSpreadPct = EXECUTION_SPREAD[assetId] || 0.005;

  // Calculate quotes for all durations using pre-fetched data
  const quotes: QuoteCurveItem[] = [];

  for (const durationDays of DURATION_PRESETS) {
    try {
      // Get volatility for this duration
      const volData = getImpliedVolatility(assetId, durationDays, strikePct);
      const impliedVolatility = volData.adjustedVolatility;

      // Calculate time and premium
      const timeYears = daysToYears(durationDays);
      const profitMarginPct = PROFIT_MARGIN_PER_DAY[layer] * durationDays;
      const fairValuePct = blackScholesPut(1, strikePct, timeYears, impliedVolatility, RISK_FREE_RATE);

      let totalPremiumPct = fairValuePct + executionSpreadPct + profitMarginPct;

      // Apply bounds with global floor enforcement
      const assetMinPremium = MIN_PREMIUM_30D[assetId] || GLOBAL_MIN_PREMIUM_FLOOR_30D;
      const effectiveMinPremium = Math.max(assetMinPremium, GLOBAL_MIN_PREMIUM_FLOOR_30D);
      const minPremium = effectiveMinPremium * (durationDays / 30);
      const maxPremium = (MAX_PREMIUM_30D[assetId] || 0.10) * (durationDays / 30);
      totalPremiumPct = Math.max(minPremium, Math.min(maxPremium, totalPremiumPct));

      const premiumIrr = notionalIrr * totalPremiumPct;

      quotes.push({
        durationDays,
        premiumPct: totalPremiumPct,
        premiumIrr,
        premiumPerDayPct: totalPremiumPct / durationDays,
        impliedVolatility,
      });
    } catch (error) {
      // Skip invalid durations
      console.error(`Failed to generate quote for ${durationDays} days:`, error);
    }
  }

  return quotes;
}

// ============================================================================
// HOLDINGS FOR PROTECTION
// ============================================================================

/**
 * Get all holdings eligible for protection for a user
 */
export async function getProtectableHoldings(userId: string): Promise<HoldingForProtection[]> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { userId },
    include: {
      holdings: true,
      protections: { where: { status: 'ACTIVE' } },
    },
  });

  if (!portfolio) {
    return [];
  }

  const prices = await getCurrentPrices();
  const result: HoldingForProtection[] = [];

  for (const holding of portfolio.holdings) {
    const assetId = holding.assetId as AssetId;

    // Skip non-eligible assets
    if (!PROTECTION_ELIGIBLE_ASSETS.includes(assetId)) {
      continue;
    }

    // Skip zero quantity holdings
    if (Number(holding.quantity) <= 0) {
      continue;
    }

    const priceData = prices.get(assetId);
    if (!priceData) continue;

    const valueUsd = Number(holding.quantity) * priceData.priceUsd;
    const valueIrr = Number(holding.quantity) * priceData.priceIrr;

    // Skip if below minimum
    if (valueIrr < MIN_NOTIONAL_IRR) {
      continue;
    }

    // Check if already protected
    const alreadyProtected = portfolio.protections.some(
      (p) => p.holdingId === holding.id && p.status === 'ACTIVE'
    );

    // Estimate 30-day premium
    const volData = getImpliedVolatility(assetId, 30);
    const timeYears = daysToYears(30);
    const layer = getAssetLayer(assetId);
    const fairValue = blackScholesPut(1, 1.0, timeYears, volData.adjustedVolatility, RISK_FREE_RATE);
    const executionSpread = EXECUTION_SPREAD[assetId] || 0.005;
    const profitMargin = PROFIT_MARGIN_PER_DAY[layer] * 30;
    let estimatedPremiumPct = fairValue + executionSpread + profitMargin;

    // Apply bounds with global floor enforcement
    const assetMinPremium = MIN_PREMIUM_30D[assetId] || GLOBAL_MIN_PREMIUM_FLOOR_30D;
    const effectiveMinPremium = Math.max(assetMinPremium, GLOBAL_MIN_PREMIUM_FLOOR_30D);
    const maxPremium = MAX_PREMIUM_30D[assetId] || 0.10;
    estimatedPremiumPct = Math.max(effectiveMinPremium, Math.min(maxPremium, estimatedPremiumPct));

    result.push({
      holdingId: holding.id,
      assetId,
      quantity: Number(holding.quantity),
      valueIrr,
      valueUsd,
      layer,
      alreadyProtected,
      estimatedPremiumPct,
    });
  }

  return result;
}

// ============================================================================
// QUOTE VALIDATION
// ============================================================================

/**
 * Check if a quote is still valid
 */
export function isQuoteValid(quote: ProtectionQuote): boolean {
  return new Date() < quote.validUntil;
}

/**
 * Validate that client-provided premium is within tolerance of server-quoted premium.
 *
 * IMPORTANT: The server-quoted premium MUST be the first parameter (baseline) to:
 * 1. Prevent divide-by-zero if client sends 0
 * 2. Ensure tolerance calculation is server-controlled, not client-controlled
 *
 * @param serverQuotedPremiumIrr - The premium from the server's cached quote (baseline)
 * @param clientProvidedPremiumIrr - The premium sent by the client for validation
 * @returns true if within PREMIUM_TOLERANCE (5%)
 */
export function isPremiumWithinTolerance(
  serverQuotedPremiumIrr: number,
  clientProvidedPremiumIrr: number
): boolean {
  // Guard against divide-by-zero (server quote should never be 0, but be safe)
  if (serverQuotedPremiumIrr <= 0) {
    return false;
  }
  const diff = Math.abs(serverQuotedPremiumIrr - clientProvidedPremiumIrr);
  return diff / serverQuotedPremiumIrr <= PREMIUM_TOLERANCE;
}

/**
 * Get seconds until quote expires
 */
export function getQuoteSecondsRemaining(quote: ProtectionQuote): number {
  const remaining = quote.validUntil.getTime() - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
}

// ============================================================================
// BREAKEVEN CALCULATION
// ============================================================================

export interface BreakevenInfo {
  breakEvenUsd: number;
  breakEvenIrr: number;
  breakEvenPct: number; // How much price needs to drop
  description: string;
  descriptionFa: string;
}

/**
 * Calculate break-even price for a protection quote
 * This is the price at which the payout equals the premium paid
 */
export function calculateBreakeven(quote: ProtectionQuote): BreakevenInfo {
  // For a put option, break-even = strike - premium
  // But for protection where we're buying notional protection,
  // break-even is where payout = premium

  // If price drops by X%, payout = X% * notional
  // Break-even when X% * notional = premium
  // X = premium / notional = premiumPct
  const breakEvenPct = quote.premiumPct;
  const breakEvenUsd = quote.spotPriceUsd * (1 - breakEvenPct);
  const breakEvenIrr = quote.spotPriceIrr * (1 - breakEvenPct);

  return {
    breakEvenUsd,
    breakEvenIrr,
    breakEvenPct,
    description: `Protected if ${quote.assetId} drops more than ${(breakEvenPct * 100).toFixed(1)}%`,
    descriptionFa: `محافظت می‌شود اگر ${quote.assetId} بیش از ${(breakEvenPct * 100).toFixed(1)}% افت کند`,
  };
}

// ============================================================================
// SETTLEMENT CALCULATION
// ============================================================================

/**
 * Calculate settlement amount for an expiring protection
 *
 * @param strikeUsd - Strike price in USD
 * @param currentPriceUsd - Current spot price in USD
 * @param notionalUsd - Protected notional in USD
 * @param fxRate - USD/IRR exchange rate
 */
export function calculateSettlement(
  strikeUsd: number,
  currentPriceUsd: number,
  notionalUsd: number,
  fxRate: number
): { isITM: boolean; payoutUsd: number; payoutIrr: number } {
  // Guard against invalid strike price (prevents division by zero)
  if (strikeUsd <= 0) {
    console.error(`Invalid strike price for settlement: ${strikeUsd}`);
    return { isITM: false, payoutUsd: 0, payoutIrr: 0 };
  }

  const isITM = currentPriceUsd < strikeUsd;

  if (!isITM) {
    return { isITM: false, payoutUsd: 0, payoutIrr: 0 };
  }

  // Payout = (strike - spot) / strike * notional
  // This represents the percentage loss protection
  const payoutPct = (strikeUsd - currentPriceUsd) / strikeUsd;
  const payoutUsd = payoutPct * notionalUsd;
  const payoutIrr = payoutUsd * fxRate;

  return { isITM: true, payoutUsd, payoutIrr };
}
