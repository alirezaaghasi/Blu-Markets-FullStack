import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { ApiError, ErrorCode } from '../types/api.js';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  error: FastifyError | AppError | ZodError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  request.log.error(error);

  // Zod validation error
  if (error instanceof ZodError) {
    const response: ApiError = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
    };
    reply.status(400).send(response);
    return;
  }

  // Custom app error
  if (error instanceof AppError) {
    const response: ApiError = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
    reply.status(error.statusCode).send(response);
    return;
  }

  // JWT errors
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' ||
      error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID' ||
      error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
    const response: ApiError = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    };
    reply.status(401).send(response);
    return;
  }

  // Rate limit error
  if (error.statusCode === 429) {
    const response: ApiError = {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
      },
    };
    reply.status(429).send(response);
    return;
  }

  // Default error
  const response: ApiError = {
    error: {
      code: 'INTERNAL_ERROR' as ErrorCode,
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'An unexpected error occurred',
    },
  };
  reply.status(500).send(response);
}
