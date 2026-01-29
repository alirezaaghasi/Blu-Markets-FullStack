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
                before: {
                  type: 'object',
                  properties: {
                    foundation: { type: 'number' },
                    growth: { type: 'number' },
                    upside: { type: 'number' },
                  },
                  additionalProperties: true,
                },
                target: {
                  type: 'object',
                  properties: {
                    foundation: { type: 'number' },
                    growth: { type: 'number' },
                    upside: { type: 'number' },
                  },
                  additionalProperties: true,
                },
                after: {
                  type: 'object',
                  properties: {
                    foundation: { type: 'number' },
                    growth: { type: 'number' },
                    upside: { type: 'number' },
                  },
                  additionalProperties: true,
                },
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
                priceUsd: { type: 'number' },
              },
            },
            newBalance: {
              type: 'object',
              properties: {
                cashIrr: { type: 'number' },
                holdingQuantity: { type: 'number' },
              },
            },
            // Mobile client compatibility aliases
            newCashIrr: { type: 'number' },
            newHoldingQuantity: { type: 'number' },
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
            spreadsByLayer: {
              type: 'object',
              properties: {
                FOUNDATION: { type: 'number' },
                GROWTH: { type: 'number' },
                UPSIDE: { type: 'number' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      // Return spreads as decimals (matching internal usage) with percentage display values
      return {
        minTradeIrr: 1000000,
        spreadsByLayer: {
          FOUNDATION: 0.0015,  // 0.15% spread for Foundation layer (decimal)
          GROWTH: 0.003,       // 0.30% spread for Growth layer (decimal)
          UPSIDE: 0.006,       // 0.60% spread for Upside layer (decimal)
        },
        // Also provide display-friendly percentages for UI
        spreadsDisplayPct: {
          FOUNDATION: 0.15,  // 0.15%
          GROWTH: 0.30,      // 0.30%
          UPSIDE: 0.60,      // 0.60%
        },
      };
    },
  });
};
