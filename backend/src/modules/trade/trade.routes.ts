import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { previewTrade, executeTrade } from './trade.service.js';
import type { AssetId, TradeAction } from '../../types/domain.js';

const tradeSchema = z.object({
  action: z.enum(['BUY', 'SELL']),
  assetId: z.string().min(1),
  amountIrr: z.number().min(1000000, 'Minimum trade is 1,000,000 IRR'),
});

const executeSchema = tradeSchema.extend({
  acknowledgedWarning: z.boolean().optional(),
});

export const tradeRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All trade routes require authentication
  app.addHook('preHandler', authenticate);

  // POST /api/v1/trade/preview
  app.post<{
    Body: { action: TradeAction; assetId: string; amountIrr: number };
  }>('/preview', {
    schema: {
      description: 'Preview trade impact on portfolio',
      tags: ['Trade'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['action', 'assetId', 'amountIrr'],
        properties: {
          action: { type: 'string', enum: ['BUY', 'SELL'] },
          assetId: { type: 'string' },
          amountIrr: { type: 'number', minimum: 1000000 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            preview: {
              type: 'object',
              properties: {
                action: { type: 'string' },
                assetId: { type: 'string' },
                quantity: { type: 'number' },
                amountIrr: { type: 'number' },
                priceIrr: { type: 'number' },
                spread: { type: 'number' },
                spreadAmountIrr: { type: 'number' },
              },
            },
            allocation: {
              type: 'object',
              properties: {
                before: { type: 'object' },
                target: { type: 'object' },
                after: { type: 'object' },
              },
            },
            boundary: { type: 'string', enum: ['SAFE', 'DRIFT', 'STRUCTURAL', 'STRESS'] },
            frictionCopy: { type: 'string' },
            movesToward: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { action, assetId, amountIrr } = tradeSchema.parse(request.body);
      return previewTrade(request.userId, action, assetId as AssetId, amountIrr);
    },
  });

  // POST /api/v1/trade/execute
  app.post<{
    Body: { action: TradeAction; assetId: string; amountIrr: number; acknowledgedWarning?: boolean };
  }>('/execute', {
    schema: {
      description: 'Execute a trade',
      tags: ['Trade'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['action', 'assetId', 'amountIrr'],
        properties: {
          action: { type: 'string', enum: ['BUY', 'SELL'] },
          assetId: { type: 'string' },
          amountIrr: { type: 'number', minimum: 1000000 },
          acknowledgedWarning: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            trade: {
              type: 'object',
              properties: {
                action: { type: 'string' },
                assetId: { type: 'string' },
                quantity: { type: 'number' },
                amountIrr: { type: 'number' },
                priceIrr: { type: 'number' },
              },
            },
            newBalance: {
              type: 'object',
              properties: {
                cashIrr: { type: 'number' },
                holdingQuantity: { type: 'number' },
              },
            },
            boundary: { type: 'string' },
            ledgerEntryId: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { action, assetId, amountIrr, acknowledgedWarning } = executeSchema.parse(request.body);
      return executeTrade(
        request.userId,
        action,
        assetId as AssetId,
        amountIrr,
        acknowledgedWarning
      );
    },
  });

  // GET /api/v1/trade/limits
  app.get('/limits', {
    schema: {
      description: 'Get trading limits',
      tags: ['Trade'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            minTradeIrr: { type: 'number' },
            spreadPct: { type: 'number' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      return {
        minTradeIrr: 1000000,
        spreadPct: 0.3,
      };
    },
  });
};
