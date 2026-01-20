import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import {
  getPortfolioSummary,
  getPortfolioHoldings,
  getPortfolioSnapshot,
  addFunds,
} from './portfolio.service.js';

const addFundsSchema = z.object({
  amountIrr: z.number().min(1000000, 'Minimum deposit is 1,000,000 IRR'),
});

export const portfolioRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All portfolio routes require authentication
  app.addHook('preHandler', authenticate);

  // GET /api/v1/portfolio
  app.get('/', {
    schema: {
      description: 'Get portfolio summary',
      tags: ['Portfolio'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            cashIrr: { type: 'number' },
            totalValueIrr: { type: 'number' },
            holdingsValueIrr: { type: 'number' },
            allocation: {
              type: 'object',
              properties: {
                foundation: { type: 'number' },
                growth: { type: 'number' },
                upside: { type: 'number' },
              },
            },
            targetAllocation: {
              type: 'object',
              properties: {
                foundation: { type: 'number' },
                growth: { type: 'number' },
                upside: { type: 'number' },
              },
            },
            status: { type: 'string', enum: ['BALANCED', 'SLIGHTLY_OFF', 'ATTENTION_REQUIRED'] },
            driftPct: { type: 'number' },
            holdingsCount: { type: 'number' },
            activeLoansCount: { type: 'number' },
            activeProtectionsCount: { type: 'number' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      return getPortfolioSummary(request.userId);
    },
  });

  // GET /api/v1/portfolio/holdings
  app.get('/holdings', {
    schema: {
      description: 'Get all holdings with current values',
      tags: ['Portfolio'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              assetId: { type: 'string' },
              name: { type: 'string' },
              quantity: { type: 'number' },
              layer: { type: 'string', enum: ['FOUNDATION', 'GROWTH', 'UPSIDE'] },
              frozen: { type: 'boolean' },
              valueIrr: { type: 'number' },
              valueUsd: { type: 'number' },
              priceUsd: { type: 'number' },
              priceIrr: { type: 'number' },
              change24hPct: { type: 'number' },
              pctOfPortfolio: { type: 'number' },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      return getPortfolioHoldings(request.userId);
    },
  });

  // GET /api/v1/portfolio/snapshot
  app.get('/snapshot', {
    schema: {
      description: 'Get full portfolio snapshot',
      tags: ['Portfolio'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            cashIrr: { type: 'number' },
            holdings: { type: 'array' },
            totalValueIrr: { type: 'number' },
            holdingsValueIrr: { type: 'number' },
            allocation: { type: 'object' },
            targetAllocation: { type: 'object' },
            status: { type: 'string' },
            driftPct: { type: 'number' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      return getPortfolioSnapshot(request.userId);
    },
  });

  // POST /api/v1/portfolio/add-funds
  app.post<{ Body: { amountIrr: number } }>('/add-funds', {
    schema: {
      description: 'Add cash to portfolio',
      tags: ['Portfolio'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['amountIrr'],
        properties: {
          amountIrr: { type: 'number', minimum: 1000000 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            newCashIrr: { type: 'number' },
            ledgerEntryId: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { amountIrr } = addFundsSchema.parse(request.body);
      return addFunds(request.userId, amountIrr);
    },
  });
};
