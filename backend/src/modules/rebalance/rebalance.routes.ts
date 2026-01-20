import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { getPortfolioSnapshot } from '../portfolio/portfolio.service.js';
import {
  checkRebalanceCooldown,
  previewRebalance,
  executeRebalance,
  RebalanceMode,
} from './rebalance.service.js';
import type { RebalancePreviewResponse, RebalanceExecuteResponse } from '../../types/api.js';

export const rebalanceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', authenticate);

  // GET /api/v1/rebalance/status
  app.get('/status', {
    schema: {
      description: 'Check portfolio drift status and rebalance eligibility',
      tags: ['Rebalance'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const snapshot = await getPortfolioSnapshot(request.userId);
      const cooldown = await checkRebalanceCooldown(request.userId);

      return {
        currentAllocation: snapshot.allocation,
        targetAllocation: snapshot.targetAllocation,
        driftPct: snapshot.driftPct,
        status: snapshot.status,
        canRebalance: cooldown.canRebalance && snapshot.driftPct >= 1,
        needsRebalance: snapshot.driftPct >= 5,
        lastRebalanceAt: cooldown.lastRebalanceAt?.toISOString() || null,
        hoursSinceRebalance: cooldown.hoursSinceRebalance,
        hoursRemaining: cooldown.hoursRemaining,
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
          mode: {
            type: 'string',
            enum: ['HOLDINGS_ONLY', 'HOLDINGS_PLUS_CASH', 'SMART'],
            default: 'HOLDINGS_ONLY',
          },
        },
      },
    },
    handler: async (request, reply) => {
      const mode = (request.query.mode as RebalanceMode) || 'HOLDINGS_ONLY';
      const preview = await previewRebalance(request.userId, mode);
      return preview;
    },
  });

  // POST /api/v1/rebalance/execute
  app.post<{ Body: { mode?: string; acknowledgedWarning?: boolean } }>('/execute', {
    schema: {
      description: 'Execute rebalance trades',
      tags: ['Rebalance'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['HOLDINGS_ONLY', 'HOLDINGS_PLUS_CASH', 'SMART'],
            default: 'HOLDINGS_ONLY',
          },
          acknowledgedWarning: { type: 'boolean', default: false },
        },
      },
    },
    handler: async (request, reply) => {
      const mode = (request.body.mode as RebalanceMode) || 'HOLDINGS_ONLY';
      const acknowledgedWarning = request.body.acknowledgedWarning || false;

      const result = await executeRebalance(request.userId, mode, acknowledgedWarning);
      return result;
    },
  });
};
