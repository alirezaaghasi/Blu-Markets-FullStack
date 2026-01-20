import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';
import { getCurrentPrices } from '../../services/price-fetcher.service.js';
import { getAssetLayer } from '../portfolio/portfolio.service.js';
import {
  PROTECTION_ELIGIBLE_ASSETS,
  PROTECTION_RATES,
  type AssetId,
} from '../../types/domain.js';

const createProtectionSchema = z.object({
  assetId: z.string().min(1),
  notionalIrr: z.number().min(1000000),
  durationMonths: z.number().min(1).max(6),
});

export const protectionRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', authenticate);

  // GET /api/v1/protection
  app.get('/', {
    schema: {
      description: 'List active protections',
      tags: ['Protection'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const portfolio = await prisma.portfolio.findUnique({
        where: { userId: request.userId },
      });

      if (!portfolio) {
        throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
      }

      const protections = await prisma.protection.findMany({
        where: { portfolioId: portfolio.id },
        orderBy: { createdAt: 'desc' },
      });

      return protections.map((p) => ({
        id: p.id,
        assetId: p.assetId,
        notionalIrr: Number(p.notionalIrr),
        premiumIrr: Number(p.premiumIrr),
        durationMonths: p.durationMonths,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
        status: p.status,
        daysRemaining:
          p.status === 'ACTIVE'
            ? Math.max(0, Math.ceil((p.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : undefined,
      }));
    },
  });

  // GET /api/v1/protection/eligible
  app.get('/eligible', {
    schema: {
      description: 'List eligible assets for protection',
      tags: ['Protection'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const portfolio = await prisma.portfolio.findUnique({
        where: { userId: request.userId },
        include: {
          holdings: true,
          protections: { where: { status: 'ACTIVE' } },
        },
      });

      if (!portfolio) {
        throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
      }

      const prices = await getCurrentPrices();

      const eligible = portfolio.holdings
        .filter((h) => PROTECTION_ELIGIBLE_ASSETS.includes(h.assetId as AssetId))
        .map((holding) => {
          const assetId = holding.assetId as AssetId;
          const layer = getAssetLayer(assetId);
          const price = prices.get(assetId);
          const holdingValueIrr = price ? Number(holding.quantity) * price.priceIrr : 0;
          const monthlyRate = PROTECTION_RATES[layer];
          const alreadyProtected = portfolio.protections.some(
            (p) => p.assetId === assetId && p.status === 'ACTIVE'
          );

          return {
            assetId,
            layer,
            holdingValueIrr,
            monthlyRate: monthlyRate * 100, // Convert to percentage
            alreadyProtected,
          };
        });

      return eligible;
    },
  });

  // POST /api/v1/protection
  app.post<{
    Body: { assetId: string; notionalIrr: number; durationMonths: number };
  }>('/', {
    schema: {
      description: 'Purchase protection',
      tags: ['Protection'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['assetId', 'notionalIrr', 'durationMonths'],
        properties: {
          assetId: { type: 'string' },
          notionalIrr: { type: 'number', minimum: 1000000 },
          durationMonths: { type: 'number', minimum: 1, maximum: 6 },
        },
      },
    },
    handler: async (request, reply) => {
      const { assetId, notionalIrr, durationMonths } = createProtectionSchema.parse(
        request.body
      );

      if (!PROTECTION_ELIGIBLE_ASSETS.includes(assetId as AssetId)) {
        throw new AppError('PROTECTION_NOT_ELIGIBLE', 'Asset is not eligible for protection', 400);
      }

      const portfolio = await prisma.portfolio.findUnique({
        where: { userId: request.userId },
        include: {
          holdings: true,
          protections: { where: { status: 'ACTIVE' } },
        },
      });

      if (!portfolio) {
        throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
      }

      // Check if already protected
      const existingProtection = portfolio.protections.find(
        (p) => p.assetId === assetId && p.status === 'ACTIVE'
      );
      if (existingProtection) {
        throw new AppError('PROTECTION_EXISTS', 'Asset is already protected', 400);
      }

      // Calculate premium
      const layer = getAssetLayer(assetId as AssetId);
      const monthlyRate = PROTECTION_RATES[layer];
      const premiumIrr = notionalIrr * monthlyRate * durationMonths;

      // Check cash balance
      if (premiumIrr > Number(portfolio.cashIrr)) {
        throw new AppError('INSUFFICIENT_CASH', 'Not enough cash for premium', 400);
      }

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + durationMonths);

      const result = await prisma.$transaction(async (tx) => {
        // Deduct premium from cash
        await tx.portfolio.update({
          where: { id: portfolio.id },
          data: { cashIrr: { decrement: premiumIrr } },
        });

        // Create protection
        const protection = await tx.protection.create({
          data: {
            portfolioId: portfolio.id,
            assetId,
            notionalIrr,
            premiumIrr,
            durationMonths,
            startDate,
            endDate,
          },
        });

        // Create ledger entry
        await tx.ledgerEntry.create({
          data: {
            portfolioId: portfolio.id,
            entryType: 'PROTECTION_PURCHASE',
            beforeSnapshot: { cashIrr: Number(portfolio.cashIrr) },
            afterSnapshot: { cashIrr: Number(portfolio.cashIrr) - premiumIrr },
            amountIrr: premiumIrr,
            assetId,
            protectionId: protection.id,
            boundary: 'SAFE',
            message: `Protection purchased for ${assetId}: ${notionalIrr.toLocaleString()} IRR for ${durationMonths} months`,
          },
        });

        // Create action log
        await tx.actionLog.create({
          data: {
            portfolioId: portfolio.id,
            actionType: 'PROTECTION_PURCHASE',
            boundary: 'SAFE',
            message: `Protected ${assetId} (${notionalIrr.toLocaleString()} IRR)`,
            amountIrr: premiumIrr,
            assetId,
          },
        });

        return protection;
      });

      return {
        id: result.id,
        assetId: result.assetId,
        notionalIrr: Number(result.notionalIrr),
        premiumIrr: Number(result.premiumIrr),
        durationMonths: result.durationMonths,
        startDate: result.startDate.toISOString(),
        endDate: result.endDate.toISOString(),
        status: result.status,
      };
    },
  });

  // DELETE /api/v1/protection/:id
  app.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      description: 'Cancel protection (no refund)',
      tags: ['Protection'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const protection = await prisma.protection.findUnique({
        where: { id: request.params.id },
        include: { portfolio: true },
      });

      if (!protection || protection.portfolio.userId !== request.userId) {
        throw new AppError('NOT_FOUND', 'Protection not found', 404);
      }

      if (protection.status !== 'ACTIVE') {
        throw new AppError('VALIDATION_ERROR', 'Protection is not active', 400);
      }

      await prisma.$transaction(async (tx) => {
        await tx.protection.update({
          where: { id: protection.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
          },
        });

        await tx.ledgerEntry.create({
          data: {
            portfolioId: protection.portfolioId,
            entryType: 'PROTECTION_CANCEL',
            beforeSnapshot: { status: 'ACTIVE' },
            afterSnapshot: { status: 'CANCELLED' },
            assetId: protection.assetId,
            protectionId: protection.id,
            boundary: 'SAFE',
            message: `Protection cancelled for ${protection.assetId}`,
          },
        });
      });

      return { success: true, refund: 0 };
    },
  });
};
