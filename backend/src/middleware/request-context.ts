/**
 * Request Context Middleware
 *
 * Propagates traceId through all async operations for request tracing.
 * Adds request timing and basic metrics collection.
 *
 * @module middleware/request-context
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  runWithContext,
  createRequestContext,
  startTimer,
  logger,
  incrementMetric,
} from '../utils/logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    traceId: string;
    startTime: () => number;
  }
}

/**
 * Register request context hooks
 */
export function registerRequestContext(app: FastifyInstance): void {
  // Add traceId to every request
  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    const timer = startTimer();
    const context = createRequestContext(
      (request as { userId?: string }).userId,
      request.url
    );

    request.traceId = context.traceId;
    request.startTime = timer;

    // Increment request counter
    incrementMetric('http_requests_total');
  });

  // Wrap handler execution with context
  app.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Context will be available in all downstream handlers
    const context = createRequestContext(
      (request as { userId?: string }).userId,
      request.url
    );

    // Store for use in response
    request.traceId = context.traceId;
  });

  // Log response and timing
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const durationMs = request.startTime ? Math.round(request.startTime()) : 0;

    // Track response status codes
    const statusGroup = `http_responses_${Math.floor(reply.statusCode / 100)}xx`;
    incrementMetric(statusGroup);

    // Log request completion
    if (reply.statusCode >= 400) {
      logger.warn('Request completed with error', {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs,
        traceId: request.traceId,
      });
    } else if (durationMs > 1000) {
      // Log slow requests
      logger.warn('Slow request detected', {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs,
        traceId: request.traceId,
      });
      incrementMetric('http_slow_requests');
    }
  });

  // Add traceId to response headers
  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, _payload) => {
    if (request.traceId) {
      reply.header('X-Trace-Id', request.traceId);
    }
    return _payload;
  });
}

/**
 * Wrap an async function to run with request context
 */
export function withRequestContext<T>(
  request: FastifyRequest,
  fn: () => Promise<T>
): Promise<T> {
  const context = createRequestContext(
    (request as { userId?: string }).userId,
    request.url
  );
  return runWithContext(context, fn) as Promise<T>;
}
