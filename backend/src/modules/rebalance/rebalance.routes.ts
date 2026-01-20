import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { getPortfolioSnapshot } from '../portfolio/portfolio.service.js';
import type { RebalancePreviewResponse } from '../../types/api.js';

export const rebalanceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', authenticate);

  // GET /api/v1/rebalance/status
  app.get('/status', {
    schema: {
      description: 'Check portfolio drift status',
      tags: ['Rebalance'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const snapshot = await getPortfolioSnapshot(request.userId);

      const lastRebalance = await prisma.portfolio.findUnique({
        where: { userId: request.userId },
        select: { lastRebalanceAt: true },
      });

      const hoursSinceRebalance = lastRebalance?.lastRebalanceAt
        ? (Date.now() - lastRebalance.lastRebalanceAt.getTime()) / (1000 * 60 * 60)
        : null;

      return {
        currentAllocation: snapshot.allocation,
        targetAllocation: snapshot.targetAllocation,
        driftPct: snapshot.driftPct,
        status: snapshot.status,
        canRebalance: !hoursSinceRebalance || hoursSinceRebalance >= 24,
        lastRebalanceAt: lastRebalance?.lastRebalanceAt?.toISOString() || null,
        hoursSinceRebalance: hoursSinceRebalance ? Math.floor(hoursSinceRebalance) : null,
      };
    },
  });

  // GET /api/v1/rebalance/preview
  app.get<{ Querystring: { mode?: string } }>('/preview', {
    schema: {
      description: 'Preview rebalance trades',
      tags: ['Rebalance'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'] },
        },
      },
    },
    handler: async (request, reply) => {
      const snapshot = await getPortfolioSnapshot(request.userId);

      // Placeholder - full HRAM algorithm implementation
      const response: RebalancePreviewResponse = {
        trades: [],
        currentAllocation: snapshot.allocation,
        targetAllocation: snapshot.targetAllocation,
        afterAllocation: snapshot.targetAllocation, // Would be calculated
        totalBuyIrr: 0,
        totalSellIrr: 0,
        canFullyRebalance: true,
        gapAnalysis: [
          {
            layer: 'FOUNDATION',
            current: snapshot.allocation.foundation,
            target: snapshot.targetAllocation.foundation,
            gap: snapshot.targetAllocation.foundation - snapshot.allocation.foundation,
            gapIrr: 0,
          },
          {
            layer: 'GROWTH',
            current: snapshot.allocation.growth,
            target: snapshot.targetAllocation.growth,
            gap: snapshot.targetAllocation.growth - snapshot.allocation.growth,
            gapIrr: 0,
          },
          {
            layer: 'UPSIDE',
            current: snapshot.allocation.upside,
            target: snapshot.targetAllocation.upside,
            gap: snapshot.targetAllocation.upside - snapshot.allocation.upside,
            gapIrr: 0,
          },
        ],
      };

      return response;
    },
  });

  // POST /api/v1/rebalance/execute
  app.post<{ Body: { mode?: string; acknowledgedWarning?: boolean } }>('/execute', {
    schema: {
      description: 'Execute rebalance',
      tags: ['Rebalance'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'] },
          acknowledgedWarning: { type: 'boolean' },
        },
      },
    },
    handler: async (request, reply) => {
      // Placeholder - full implementation would execute trades
      return {
        success: true,
        tradesExecuted: 0,
        newAllocation: {},
        ledgerEntryId: '',
      };
    },
  });
};
