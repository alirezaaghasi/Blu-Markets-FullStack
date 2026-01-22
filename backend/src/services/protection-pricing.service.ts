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

/** Minimum notional in IRR */
export const MIN_NOTIONAL_IRR = 1_000_000;

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
 */
const MIN_PREMIUM_30D: Record<string, number> = {
  BTC: 0.015, // 1.5%
  ETH: 0.018, // 1.8%
  SOL: 0.025, // 2.5%
  PAXG: 0.004, // 0.4%
  KAG: 0.005, // 0.5%
  QQQ: 0.006, // 0.6%
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
// QUOTE CACHE (In-memory for MVP, consider Redis for production)
// ============================================================================

interface CachedQuote {
  quote: ProtectionQuote;
  userId: string;
  createdAt: Date;
}

/** In-memory quote cache with TTL */
const quoteCache = new Map<string, CachedQuote>();

/** Clean up expired quotes periodically */
function cleanupExpiredQuotes(): void {
  const now = new Date();
  for (const [quoteId, cached] of quoteCache.entries()) {
    if (now > cached.quote.validUntil) {
      quoteCache.delete(quoteId);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupExpiredQuotes, 60_000);

/**
 * Store a quote in the cache
 */
function cacheQuote(quote: ProtectionQuote, userId: string): void {
  quoteCache.set(quote.quoteId, {
    quote,
    userId,
    createdAt: new Date(),
  });
}

/**
 * Retrieve and validate a cached quote
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
    quoteCache.delete(quoteId); // Clean up expired quote
    throw new AppError('QUOTE_EXPIRED', 'Quote has expired, please request a new quote', 410, {
      quoteId,
      expiredAt: cached.quote.validUntil.toISOString(),
    });
  }

  return cached.quote;
}

/**
 * Consume a quote (remove from cache after successful purchase)
 */
export function consumeQuote(quoteId: string): void {
  quoteCache.delete(quoteId);
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
  const holding = await prisma.holding.findUnique({
    where: { id: holdingId },
    include: {
      portfolio: {
        include: {
          protections: { where: { status: 'ACTIVE' } },
        },
      },
    },
  });

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

  // Apply bounds
  const minPremium = (MIN_PREMIUM_30D[assetId] || 0.015) * (durationDays / 30);
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
  const quotes: QuoteCurveItem[] = [];

  for (const durationDays of DURATION_PRESETS) {
    try {
      const quote = await getProtectionQuote(holdingId, coveragePct, durationDays, userId);
      quotes.push({
        durationDays,
        premiumPct: quote.premiumPct,
        premiumIrr: quote.premiumIrr,
        premiumPerDayPct: quote.premiumPct / durationDays,
        impliedVolatility: quote.impliedVolatility,
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

    // Apply bounds
    const minPremium = MIN_PREMIUM_30D[assetId] || 0.015;
    const maxPremium = MAX_PREMIUM_30D[assetId] || 0.10;
    estimatedPremiumPct = Math.max(minPremium, Math.min(maxPremium, estimatedPremiumPct));

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
 * Validate premium hasn't changed too much
 */
export function isPremiumWithinTolerance(
  quotedPremiumIrr: number,
  currentPremiumIrr: number
): boolean {
  const diff = Math.abs(quotedPremiumIrr - currentPremiumIrr);
  return diff / quotedPremiumIrr <= PREMIUM_TOLERANCE;
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
