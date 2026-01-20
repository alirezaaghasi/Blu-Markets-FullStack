import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../config/database.js';
import {
  getCurrentPrices,
  getAssetPrice,
  getCurrentFxRate,
} from '../../services/price-fetcher.service.js';
import type { AssetId } from '../../types/domain.js';
import type { AllPricesResponse, PriceResponse } from '../../types/api.js';

export const pricesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/prices
  app.get<{ Reply: AllPricesResponse }>('/', {
    schema: {
      description: 'Get all current prices',
      tags: ['Prices'],
      response: {
        200: {
          type: 'object',
          properties: {
            prices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  assetId: { type: 'string' },
                  priceUsd: { type: 'number' },
                  priceIrr: { type: 'number' },
                  change24hPct: { type: 'number' },
                  source: { type: 'string' },
                  fetchedAt: { type: 'string' },
                },
              },
            },
            fxRate: {
              type: 'object',
              properties: {
                usdIrr: { type: 'number' },
                source: { type: 'string' },
                fetchedAt: { type: 'string' },
              },
            },
            status: { type: 'string', enum: ['live', 'stale', 'offline'] },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const allPrices = await prisma.price.findMany({
        include: { asset: true },
      });

      const fxRate = await getCurrentFxRate();

      // Determine status based on freshness
      const latestFetch = allPrices.length > 0
        ? Math.max(...allPrices.map((p) => p.fetchedAt.getTime()))
        : 0;
      const ageMs = Date.now() - latestFetch;
      const status: 'live' | 'stale' | 'offline' =
        ageMs < 60000 ? 'live' : ageMs < 300000 ? 'stale' : 'offline';

      const prices: PriceResponse[] = allPrices.map((p) => ({
        assetId: p.assetId as AssetId,
        priceUsd: Number(p.priceUsd),
        priceIrr: Number(p.priceIrr),
        change24hPct: p.change24hPct ? Number(p.change24hPct) : undefined,
        source: p.source || 'unknown',
        fetchedAt: p.fetchedAt.toISOString(),
      }));

      return {
        prices,
        fxRate: {
          usdIrr: fxRate.usdIrr,
          source: fxRate.source,
          fetchedAt: fxRate.fetchedAt.toISOString(),
        },
        status,
      };
    },
  });

  // GET /api/v1/prices/:assetId
  app.get<{ Params: { assetId: string }; Reply: PriceResponse }>('/:assetId', {
    schema: {
      description: 'Get price for a specific asset',
      tags: ['Prices'],
      params: {
        type: 'object',
        required: ['assetId'],
        properties: {
          assetId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            assetId: { type: 'string' },
            priceUsd: { type: 'number' },
            priceIrr: { type: 'number' },
            change24hPct: { type: 'number' },
            source: { type: 'string' },
            fetchedAt: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { assetId } = request.params;
      const price = await getAssetPrice(assetId as AssetId);

      if (!price) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Asset price not found' },
        } as never);
      }

      return {
        assetId: assetId as AssetId,
        priceUsd: price.priceUsd,
        priceIrr: price.priceIrr,
        change24hPct: price.change24hPct,
        source: 'cached',
        fetchedAt: price.fetchedAt.toISOString(),
      };
    },
  });
};
