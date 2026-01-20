import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';

// Routes
import { authRoutes } from './modules/auth/auth.routes.js';
import { onboardingRoutes } from './modules/onboarding/onboarding.routes.js';
import { portfolioRoutes } from './modules/portfolio/portfolio.routes.js';
import { tradeRoutes } from './modules/trade/trade.routes.js';
import { rebalanceRoutes } from './modules/rebalance/rebalance.routes.js';
import { loansRoutes } from './modules/loans/loans.routes.js';
import { protectionRoutes } from './modules/protection/protection.routes.js';
import { historyRoutes } from './modules/history/history.routes.js';
import { pricesRoutes } from './modules/prices/prices.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Security - configure helmet to allow Swagger UI
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });
  await app.register(cors, {
    origin: env.NODE_ENV === 'development' ? true : ['https://blumarkets.ir'],
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX_REQUESTS,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
      },
    }),
  });

  // JWT
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_EXPIRY },
  });

  // Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Blu Markets API',
        description: 'Risk-managed wealth preservation platform API',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Development' },
        { url: 'https://api.blumarkets.ir', description: 'Production' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  // API Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(onboardingRoutes, { prefix: '/api/v1/onboarding' });
  await app.register(portfolioRoutes, { prefix: '/api/v1/portfolio' });
  await app.register(tradeRoutes, { prefix: '/api/v1/trade' });
  await app.register(rebalanceRoutes, { prefix: '/api/v1/rebalance' });
  await app.register(loansRoutes, { prefix: '/api/v1/loans' });
  await app.register(protectionRoutes, { prefix: '/api/v1/protection' });
  await app.register(historyRoutes, { prefix: '/api/v1/history' });
  await app.register(pricesRoutes, { prefix: '/api/v1/prices' });

  return app;
}
