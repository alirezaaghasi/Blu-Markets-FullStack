/**
 * Protection Routes
 * API endpoints for dynamic protection pricing feature
 *
 * @module modules/protection/protection.routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';
import {
  getProtectionQuote,
  getPremiumCurve,
  getProtectableHoldings,
  calculateBreakeven,
  isQuoteValid,
  isPremiumWithinTolerance,
  getQuoteSecondsRemaining,
  calculateSettlement,
  getAndValidateCachedQuote,
  reserveQuote,
  releaseQuote,
  consumeQuote,
  DURATION_PRESETS,
  MIN_COVERAGE_PCT,
  MAX_COVERAGE_PCT,
  MIN_NOTIONAL_IRR,
  type ProtectionQuote,
} from '../../services/protection-pricing.service.js';
import { getImpliedVolatility, getRegimeDescription } from '../../services/volatility.service.js';
import { calculatePutGreeks, daysToYears } from '../../services/options-math.js';
import { PROTECTION_ELIGIBLE_ASSETS, type AssetId } from '../../types/domain.js';

// ============================================================================
// SCHEMAS
// ============================================================================

// holdingId can be UUID or a prefixed ID like "demo-BTC" for development
const holdingIdSchema = z.string().min(1);

const getQuoteSchema = z.object({
  holdingId: holdingIdSchema,
  coveragePct: z.number().min(MIN_COVERAGE_PCT).max(MAX_COVERAGE_PCT).default(1.0),
  durationDays: z.number().refine((d) => DURATION_PRESETS.includes(d as any), {
    message: `Duration must be one of: ${DURATION_PRESETS.join(', ')}`,
  }),
});

const getQuoteCurveSchema = z.object({
  holdingId: holdingIdSchema,
  coveragePct: z.number().min(MIN_COVERAGE_PCT).max(MAX_COVERAGE_PCT).default(1.0),
});

const purchaseSchema = z.object({
  quoteId: z.string().min(1),
  holdingId: holdingIdSchema,
  coveragePct: z.number().min(MIN_COVERAGE_PCT).max(MAX_COVERAGE_PCT),
  durationDays: z.number().refine((d) => DURATION_PRESETS.includes(d as any)),
  premiumIrr: z.number().min(0),
  acknowledgedPremium: z.boolean().refine((v) => v === true, {
    message: 'Must acknowledge premium amount',
  }),
});

// ============================================================================
// ROUTES
// ============================================================================

export const protectionRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All protection routes require authentication
  app.addHook('preHandler', authenticate);

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/protection/holdings
  // Get holdings eligible for protection with pricing estimates
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/holdings', {
    schema: {
      description: 'Get holdings eligible for protection',
      tags: ['Protection'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const userId = request.userId;
      const holdings = await getProtectableHoldings(userId);

      return {
        holdings: holdings.map((h) => ({
          holdingId: h.holdingId,
          assetId: h.assetId,
          quantity: h.quantity,
          valueIrr: h.valueIrr,
          valueUsd: h.valueUsd,
          layer: h.layer,
          alreadyProtected: h.alreadyProtected,
          estimatedPremiumPct: h.estimatedPremiumPct,
          estimatedPremiumPctDisplay: `${(h.estimatedPremiumPct * 100).toFixed(1)}%`,
        })),
        durationPresets: DURATION_PRESETS,
        coverageRange: {
          min: MIN_COVERAGE_PCT,
          max: MAX_COVERAGE_PCT,
          step: 0.1,
        },
        minNotionalIrr: MIN_NOTIONAL_IRR,
      };
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/protection/quote
  // Get a price quote for protection
  // ──────────────────────────────────────────────────────────────────────────
  app.get<{
    Querystring: {
      holdingId: string;
      coveragePct?: string;
      durationDays: string;
    };
  }>('/quote', {
    schema: {
      description: 'Get protection price quote',
      tags: ['Protection'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['holdingId', 'durationDays'],
        properties: {
          holdingId: { type: 'string' },
          coveragePct: { type: 'string' },
          durationDays: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const params = getQuoteSchema.parse({
        holdingId: request.query.holdingId,
        coveragePct: request.query.coveragePct ? parseFloat(request.query.coveragePct) : 1.0,
        durationDays: parseInt(request.query.durationDays),
      });

      const quote = await getProtectionQuote(
        params.holdingId,
        params.coveragePct,
        params.durationDays,
        request.userId
      );

      const breakeven = calculateBreakeven(quote);
      const secondsRemaining = getQuoteSecondsRemaining(quote);

      return {
        quote: formatQuoteResponse(quote),
        breakeven: {
          priceDropPct: breakeven.breakEvenPct,
          priceDropPctDisplay: `${(breakeven.breakEvenPct * 100).toFixed(1)}%`,
          breakEvenUsd: breakeven.breakEvenUsd,
          breakEvenIrr: breakeven.breakEvenIrr,
          description: breakeven.description,
          descriptionFa: breakeven.descriptionFa,
        },
        validity: {
          secondsRemaining,
          validUntil: quote.validUntil.toISOString(),
        },
      };
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/protection/quote/curve
  // Get quotes for all duration presets
  // ──────────────────────────────────────────────────────────────────────────
  app.get<{
    Querystring: {
      holdingId: string;
      coveragePct?: string;
    };
  }>('/quote/curve', {
    schema: {
      description: 'Get protection quotes for all durations',
      tags: ['Protection'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['holdingId'],
        properties: {
          holdingId: { type: 'string' },
          coveragePct: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const params = getQuoteCurveSchema.parse({
        holdingId: request.query.holdingId,
        coveragePct: request.query.coveragePct ? parseFloat(request.query.coveragePct) : 1.0,
      });

      const quotes = await getPremiumCurve(params.holdingId, params.coveragePct, request.userId);

      return {
        holdingId: params.holdingId,
        coveragePct: params.coveragePct,
        quotes: quotes.map((q) => ({
          durationDays: q.durationDays,
          durationLabel: getDurationLabel(q.durationDays),
          premiumPct: q.premiumPct,
          premiumPctDisplay: `${(q.premiumPct * 100).toFixed(2)}%`,
          premiumIrr: q.premiumIrr,
          premiumPerDayPct: q.premiumPerDayPct,
          impliedVolatility: q.impliedVolatility,
          impliedVolatilityPct: `${(q.impliedVolatility * 100).toFixed(1)}%`,
        })),
      };
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/v1/protection/purchase
  // Purchase protection
  // ──────────────────────────────────────────────────────────────────────────
  app.post<{ Body: z.infer<typeof purchaseSchema> }>('/purchase', {
    schema: {
      description: 'Purchase protection for a holding',
      tags: ['Protection'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['quoteId', 'holdingId', 'coveragePct', 'durationDays', 'premiumIrr', 'acknowledgedPremium'],
        properties: {
          quoteId: { type: 'string' },
          holdingId: { type: 'string' },
          coveragePct: { type: 'number' },
          durationDays: { type: 'number' },
          premiumIrr: { type: 'number' },
          acknowledgedPremium: { type: 'boolean' },
        },
      },
    },
    handler: async (request, reply) => {
      const body = purchaseSchema.parse(request.body);
      const userId = request.userId;

      // CRITICAL: Reject demo holding IDs - they must NOT persist to database
      if (body.holdingId.startsWith('demo-')) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Demo holdings cannot be protected. Please use real holdings.',
          400,
          { holdingId: body.holdingId, reason: 'Demo holding IDs are not allowed in purchases' }
        );
      }

      // CRITICAL: Atomically reserve the quote BEFORE starting any transaction
      // This prevents race conditions where multiple requests use the same quote
      const reservedQuote = await reserveQuote(body.quoteId, userId);

      try {
        // Verify the quote parameters match what was requested
        if (reservedQuote.holdingId !== body.holdingId) {
          throw new AppError('VALIDATION_ERROR', 'Quote holding does not match request', 400, {
            quoteHoldingId: reservedQuote.holdingId,
            requestHoldingId: body.holdingId,
          });
        }

        if (Math.abs(reservedQuote.coveragePct - body.coveragePct) > 0.001) {
          throw new AppError('VALIDATION_ERROR', 'Quote coverage does not match request', 400, {
            quoteCoveragePct: reservedQuote.coveragePct,
            requestCoveragePct: body.coveragePct,
          });
        }

        if (reservedQuote.durationDays !== body.durationDays) {
          throw new AppError('VALIDATION_ERROR', 'Quote duration does not match request', 400, {
            quoteDurationDays: reservedQuote.durationDays,
            requestDurationDays: body.durationDays,
          });
        }

        // Validate premium matches (within tolerance for minor display rounding)
        // IMPORTANT: Server-quoted premium must be the baseline (first param) to prevent
        // divide-by-zero if client sends 0 and to ensure tolerance is server-controlled
        if (!isPremiumWithinTolerance(reservedQuote.premiumIrr, body.premiumIrr)) {
          throw new AppError('VALIDATION_ERROR', 'Premium does not match quote', 400, {
            quotedPremium: reservedQuote.premiumIrr,
            providedPremium: body.premiumIrr,
          });
        }

        // Use the reserved quote for the purchase
        const freshQuote = reservedQuote;

        // Calculate dates
        const startDate = new Date();
        const expiryDate = new Date(startDate);
        expiryDate.setDate(expiryDate.getDate() + body.durationDays);

        // Create protection in transaction
        // FINANCIAL FIX: All checks moved inside transaction to prevent race conditions
        const protection = await prisma.$transaction(async (tx) => {
          // DATA INTEGRITY FIX: Acquire row-level locks to prevent race conditions
          // Lock portfolio row first, then holding row to prevent double-spend on concurrent purchases
          await tx.$executeRaw`
            SELECT 1 FROM "portfolios" WHERE user_id = ${userId}::uuid FOR UPDATE
          `;
          await tx.$executeRaw`
            SELECT 1 FROM "holdings" WHERE id = ${body.holdingId}::uuid FOR UPDATE
          `;

          // CRITICAL: Fetch portfolio inside transaction to get consistent cash balance
          const portfolio = await tx.portfolio.findUnique({
            where: { userId },
            include: {
              holdings: true,
              protections: { where: { status: 'ACTIVE' } },
            },
          });

          if (!portfolio) {
            throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
          }

          // FINANCIAL FIX: Verify cash balance inside transaction to prevent double-spend
          if (Number(portfolio.cashIrr) < freshQuote.premiumIrr) {
            throw new AppError('INSUFFICIENT_CASH', 'Not enough cash for premium', 400, {
              required: freshQuote.premiumIrr,
              available: Number(portfolio.cashIrr),
            });
          }

          // CRITICAL: Re-check that holding doesn't already have active protection
          // This prevents duplicate purchases from multiple cached quotes
          const existingProtection = await tx.protection.findFirst({
            where: {
              holdingId: body.holdingId,
              status: 'ACTIVE',
            },
          });

          if (existingProtection) {
            throw new AppError(
              'CONFLICT',
              'This holding already has active protection',
              409,
              { existingProtectionId: existingProtection.id }
            );
          }

          // HIGH-3 FIX: Re-validate quote expiry inside transaction before DB write
          // Quote might have expired between reservation and reaching this point
          if (!isQuoteValid(freshQuote)) {
            throw new AppError(
              'QUOTE_EXPIRED',
              'Quote expired during transaction, please request a new quote',
              410,
              { quoteId: body.quoteId, expiredAt: freshQuote.validUntil.toISOString() }
            );
          }

          // Deduct premium from cash
          await tx.portfolio.update({
            where: { id: portfolio.id },
            data: {
              cashIrr: { decrement: freshQuote.premiumIrr },
            },
          });

          // Create protection record
          const newProtection = await tx.protection.create({
            data: {
              portfolioId: portfolio.id,
              holdingId: body.holdingId,
              assetId: freshQuote.assetId,

              coveragePct: body.coveragePct,
              notionalIrr: freshQuote.notionalIrr,
              notionalUsd: freshQuote.notionalUsd,

              strikePct: freshQuote.strikePct,
              strikeUsd: freshQuote.strikeUsd,
              strikeIrr: freshQuote.strikeIrr,

              premiumPct: freshQuote.premiumPct,
              premiumIrr: freshQuote.premiumIrr,
              premiumUsd: freshQuote.premiumUsd,

              durationDays: body.durationDays,
              startDate,
              expiryDate,

              impliedVolatility: freshQuote.impliedVolatility,
              quoteId: body.quoteId,

              hedgeType: 'NAKED', // No real hedging for MVP
              hedgeRatio: 0,

              status: 'ACTIVE',
            },
          });

          // Create ledger entry
          await tx.ledgerEntry.create({
            data: {
              portfolioId: portfolio.id,
              entryType: 'PROTECTION_PURCHASE',
              beforeSnapshot: { cashIrr: Number(portfolio.cashIrr) },
              afterSnapshot: { cashIrr: Number(portfolio.cashIrr) - freshQuote.premiumIrr },
              amountIrr: -freshQuote.premiumIrr,
              assetId: freshQuote.assetId,
              protectionId: newProtection.id,
              boundary: 'SAFE',
              message: `Purchased ${body.durationDays}-day protection for ${freshQuote.assetId} (${(body.coveragePct * 100).toFixed(0)}% coverage)`,
            },
          });

          // Create action log
          await tx.actionLog.create({
            data: {
              portfolioId: portfolio.id,
              actionType: 'PROTECTION_PURCHASE',
              boundary: 'SAFE',
              message: `${body.durationDays}D protection for ${freshQuote.assetId}`,
              amountIrr: freshQuote.premiumIrr,
              assetId: freshQuote.assetId,
            },
          });

          // Create hedge log (mock)
          await tx.hedgeLog.create({
            data: {
              protectionId: newProtection.id,
              hedgeType: 'NAKED',
              action: 'OPEN',
              notionalUsd: freshQuote.notionalUsd,
              hedgeRatio: 0,
              delta: freshQuote.greeks.delta,
              gamma: freshQuote.greeks.gamma,
              vega: freshQuote.greeks.vega,
              theta: freshQuote.greeks.theta,
            },
          });

          // Return both protection and the new cash balance
          const newCashIrr = Number(portfolio.cashIrr) - freshQuote.premiumIrr;
          return { protection: newProtection, newCashIrr };
        });

        // SUCCESS: Consume the quote to prevent reuse
        await consumeQuote(body.quoteId);

        return {
          protection: {
            id: protection.protection.id,
            assetId: protection.protection.assetId,
            coveragePct: Number(protection.protection.coveragePct),
            notionalIrr: Number(protection.protection.notionalIrr),
            strikeIrr: Number(protection.protection.strikeIrr),
            premiumIrr: Number(protection.protection.premiumIrr),
            premiumPct: Number(protection.protection.premiumPct),
            durationDays: protection.protection.durationDays,
            startDate: protection.protection.startDate.toISOString(),
            expiryDate: protection.protection.expiryDate.toISOString(),
            status: protection.protection.status,
          },
          newCashIrr: protection.newCashIrr,
        };
      } catch (error) {
        // FAILURE: Release the quote so it can be used again
        await releaseQuote(body.quoteId);
        throw error;
      }
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/protection/active
  // Get all active protections for user
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/active', {
    schema: {
      description: 'Get all active protections',
      tags: ['Protection'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const userId = request.userId;

      const portfolio = await prisma.portfolio.findUnique({
        where: { userId },
        include: {
          protections: {
            where: { status: 'ACTIVE' },
            include: { holding: true },
            orderBy: { expiryDate: 'asc' },
          },
        },
      });

      if (!portfolio) {
        return { protections: [] };
      }

      return {
        protections: portfolio.protections.map((p) => {
          const daysRemaining = Math.max(
            0,
            Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          );

          return {
            id: p.id,
            assetId: p.assetId,
            coveragePct: Number(p.coveragePct),
            notionalIrr: Number(p.notionalIrr),
            notionalUsd: Number(p.notionalUsd),
            strikeIrr: Number(p.strikeIrr),
            strikeUsd: Number(p.strikeUsd),
            strikePct: Number(p.strikePct),
            premiumIrr: Number(p.premiumIrr),
            premiumPct: Number(p.premiumPct),
            durationDays: p.durationDays,
            startDate: p.startDate.toISOString(),
            expiryDate: p.expiryDate.toISOString(),
            daysRemaining,
            daysRemainingLabel: formatDaysRemaining(daysRemaining),
            status: p.status,
            holding: p.holding
              ? {
                  assetId: p.holding.assetId,
                  quantity: Number(p.holding.quantity),
                }
              : null,
          };
        }),
      };
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/protection/history
  // Get protection history (expired, exercised, cancelled)
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/history', {
    schema: {
      description: 'Get protection history',
      tags: ['Protection'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const userId = request.userId;

      const portfolio = await prisma.portfolio.findUnique({
        where: { userId },
        include: {
          protections: {
            where: { status: { not: 'ACTIVE' } },
            orderBy: { expiryDate: 'desc' },
            take: 50,
          },
        },
      });

      if (!portfolio) {
        return { protections: [] };
      }

      return {
        protections: portfolio.protections.map((p) => ({
          id: p.id,
          assetId: p.assetId,
          coveragePct: Number(p.coveragePct),
          notionalIrr: Number(p.notionalIrr),
          premiumIrr: Number(p.premiumIrr),
          durationDays: p.durationDays,
          startDate: p.startDate.toISOString(),
          expiryDate: p.expiryDate.toISOString(),
          status: p.status,
          settlementIrr: p.settlementIrr ? Number(p.settlementIrr) : null,
          settlementDate: p.settlementDate?.toISOString() || null,
        })),
      };
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /api/v1/protection/:id
  // Cancel protection (not implemented - returns 501)
  // ──────────────────────────────────────────────────────────────────────────
  app.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      description: 'Cancel protection (not available)',
      tags: ['Protection'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      throw new AppError('NOT_IMPLEMENTED', 'Protection cancellation is not available', 501);
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/protection/volatility/:assetId
  // Get volatility data for an asset
  // ──────────────────────────────────────────────────────────────────────────
  app.get<{ Params: { assetId: string } }>('/volatility/:assetId', {
    schema: {
      description: 'Get volatility data for an asset',
      tags: ['Protection'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const assetId = request.params.assetId as AssetId;

      if (!PROTECTION_ELIGIBLE_ASSETS.includes(assetId)) {
        throw new AppError('VALIDATION_ERROR', 'Asset not eligible for protection', 400);
      }

      const volData = getImpliedVolatility(assetId, 30);

      return {
        assetId,
        impliedVolatility: volData.adjustedVolatility,
        impliedVolatilityPct: `${(volData.adjustedVolatility * 100).toFixed(1)}%`,
        baseVolatility: volData.baseVolatility,
        regime: volData.regime,
        regimeDescription: getRegimeDescription(volData.regime),
        termMultiplier: volData.termMultiplier,
      };
    },
  });
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatQuoteResponse(quote: ProtectionQuote) {
  return {
    quoteId: quote.quoteId,
    holdingId: quote.holdingId,
    assetId: quote.assetId,

    coveragePct: quote.coveragePct,
    notionalIrr: quote.notionalIrr,
    notionalUsd: quote.notionalUsd,

    strikePct: quote.strikePct,
    strikeUsd: quote.strikeUsd,
    strikeIrr: quote.strikeIrr,

    durationDays: quote.durationDays,
    durationLabel: getDurationLabel(quote.durationDays),

    spotPriceUsd: quote.spotPriceUsd,
    spotPriceIrr: quote.spotPriceIrr,

    premiumPct: quote.premiumPct,
    premiumPctDisplay: `${(quote.premiumPct * 100).toFixed(2)}%`,
    premiumIrr: quote.premiumIrr,
    premiumUsd: quote.premiumUsd,

    // Breakdown
    breakdown: {
      fairValuePct: quote.fairValuePct,
      executionSpreadPct: quote.executionSpreadPct,
      profitMarginPct: quote.profitMarginPct,
    },

    impliedVolatility: quote.impliedVolatility,
    impliedVolatilityPct: `${(quote.impliedVolatility * 100).toFixed(1)}%`,
    volatilityRegime: quote.volatilityRegime,

    greeks: {
      delta: quote.greeks.delta,
      gamma: quote.greeks.gamma,
      vega: quote.greeks.vega,
      theta: quote.greeks.theta,
    },

    quotedAt: quote.quotedAt.toISOString(),
    validUntil: quote.validUntil.toISOString(),
  };
}

function getDurationLabel(days: number): string {
  if (days === 7) return '1 Week';
  if (days === 14) return '2 Weeks';
  if (days === 30) return '1 Month';
  if (days === 60) return '2 Months';
  if (days === 90) return '3 Months';
  if (days === 180) return '6 Months';
  return `${days} Days`;
}

function formatDaysRemaining(days: number): string {
  if (days <= 0) return 'Expired';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days < 14) return '1 week';
  if (days < 30) return `${Math.floor(days / 7)} weeks`;
  if (days < 60) return '1 month';
  return `${Math.floor(days / 30)} months`;
}
