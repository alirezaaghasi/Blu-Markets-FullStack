import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';

export const historyRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', authenticate);

  // GET /api/v1/history
  app.get<{
    Querystring: {
      page?: number;
      limit?: number;
      type?: string;
      from?: string;
      to?: string;
    };
  }>('/', {
    schema: {
      description: 'Get paginated transaction history',
      tags: ['History'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          type: { type: 'string' },
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' },
        },
      },
    },
    handler: async (request, reply) => {
      const portfolio = await prisma.portfolio.findUnique({
        where: { userId: request.userId },
      });

      if (!portfolio) {
        throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
      }

      const { page = 1, limit = 20, type, from, to } = request.query;
      const skip = (page - 1) * limit;

      const where: any = { portfolioId: portfolio.id };

      if (type) {
        where.entryType = type;
      }

      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) where.createdAt.lte = new Date(to);
      }

      const [entries, total] = await Promise.all([
        prisma.ledgerEntry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.ledgerEntry.count({ where }),
      ]);

      return {
        entries: entries.map((e) => ({
          id: e.id,
          entryType: e.entryType,
          assetId: e.assetId,
          quantity: e.quantity ? Number(e.quantity) : undefined,
          amountIrr: e.amountIrr ? Number(e.amountIrr) : undefined,
          boundary: e.boundary,
          message: e.message,
          createdAt: e.createdAt.toISOString(),
          beforeSnapshot: e.beforeSnapshot as object,
          afterSnapshot: e.afterSnapshot as object,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
  });

  // GET /api/v1/history/:id
  app.get<{ Params: { id: string } }>('/:id', {
    schema: {
      description: 'Get single history entry with full details',
      tags: ['History'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const entry = await prisma.ledgerEntry.findUnique({
        where: { id: request.params.id },
        include: { portfolio: true, loan: true, protection: true },
      });

      if (!entry || entry.portfolio.userId !== request.userId) {
        throw new AppError('NOT_FOUND', 'Entry not found', 404);
      }

      return {
        id: entry.id,
        entryType: entry.entryType,
        assetId: entry.assetId,
        quantity: entry.quantity ? Number(entry.quantity) : undefined,
        amountIrr: entry.amountIrr ? Number(entry.amountIrr) : undefined,
        boundary: entry.boundary,
        message: entry.message,
        createdAt: entry.createdAt.toISOString(),
        beforeSnapshot: entry.beforeSnapshot,
        afterSnapshot: entry.afterSnapshot,
        metadata: entry.metadata,
        sequenceNumber: Number(entry.sequenceNumber),
        prevHash: entry.prevHash,
        entryHash: entry.entryHash,
      };
    },
  });

  // GET /api/v1/history/activity (Activity Feed)
  app.get<{ Querystring: { limit?: number } }>('/activity', {
    schema: {
      description: 'Get activity feed',
      tags: ['History'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
    handler: async (request, reply) => {
      const portfolio = await prisma.portfolio.findUnique({
        where: { userId: request.userId },
      });

      if (!portfolio) {
        throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
      }

      const limit = request.query.limit || 20;
      const actions = await prisma.actionLog.findMany({
        where: { portfolioId: portfolio.id },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Fetch one extra to determine hasMore
      });

      const hasMore = actions.length > limit;
      // MEDIUM-1 FIX: Return id as number to match mobile ActionLogEntry type
      const activities = actions.slice(0, limit).map((a) => ({
        id: Number(a.id),             // Fixed: mobile expects number, not string
        type: a.actionType,           // Map actionType → type for frontend
        boundary: a.boundary,
        message: a.message,
        amountIRR: a.amountIrr ? Number(a.amountIrr) : undefined,  // Map amountIrr → amountIRR
        assetId: a.assetId,
        timestamp: a.createdAt.toISOString(),  // Map createdAt → timestamp for frontend
      }));

      return {
        activities,
        hasMore,
        nextCursor: hasMore ? String(actions[limit - 1].id) : undefined,
      };
    },
  });

  // GET /api/v1/history/all (Paginated activity with cursor)
  app.get<{ Querystring: { cursor?: string; limit?: number } }>('/all', {
    schema: {
      description: 'Get all activities with cursor-based pagination',
      tags: ['History'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          cursor: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
    handler: async (request, reply) => {
      const portfolio = await prisma.portfolio.findUnique({
        where: { userId: request.userId },
      });

      if (!portfolio) {
        throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
      }

      const { cursor, limit = 20 } = request.query;

      // MEDIUM-2 FIX: Validate cursor is a valid positive integer before use
      const where: any = { portfolioId: portfolio.id };
      if (cursor) {
        const cursorNum = parseInt(cursor, 10);
        if (isNaN(cursorNum) || cursorNum < 0 || !Number.isInteger(cursorNum)) {
          throw new AppError('VALIDATION_ERROR', 'Invalid cursor format', 400, { cursor });
        }
        where.id = { lt: BigInt(cursor) };
      }

      const actions = await prisma.actionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = actions.length > limit;
      // MEDIUM-1 FIX: Return id as number to match mobile ActionLogEntry type
      const activities = actions.slice(0, limit).map((a) => ({
        id: Number(a.id),             // Fixed: mobile expects number, not string
        type: a.actionType,           // Map actionType → type for frontend
        boundary: a.boundary,
        message: a.message,
        amountIRR: a.amountIrr ? Number(a.amountIrr) : undefined,  // Map amountIrr → amountIRR
        assetId: a.assetId,
        timestamp: a.createdAt.toISOString(),  // Map createdAt → timestamp for frontend
      }));

      return {
        activities,
        hasMore,
        nextCursor: hasMore ? String(actions[limit - 1].id) : undefined,
      };
    },
  });
};
