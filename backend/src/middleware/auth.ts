import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './error-handler.js';

export interface JwtPayload {
  sub: string; // user id
  phone: string;
  portfolioId?: string;
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    portfolioId?: string;
    // JWT namespace methods (access/refresh separation)
    accessVerify<T = unknown>(options?: { token?: string }): Promise<T>;
    refreshVerify<T = unknown>(options?: { token?: string }): Promise<T>;
  }

  interface FastifyInstance {
    // JWT namespace instances
    access: {
      sign(payload: object, options?: object): string;
      verify<T = unknown>(token: string): T;
    };
    refresh: {
      sign(payload: object, options?: object): string;
      verify<T = unknown>(token: string): T;
    };
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Use access namespace for access token verification
    const decoded = await request.accessVerify<JwtPayload>();
    request.userId = decoded.sub;
    request.portfolioId = decoded.portfolioId;
  } catch (error) {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}

export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    // Use access namespace for access token verification
    const decoded = await request.accessVerify<JwtPayload>();
    request.userId = decoded.sub;
    request.portfolioId = decoded.portfolioId;
  } catch {
    // Token not required, continue without auth
  }
}
