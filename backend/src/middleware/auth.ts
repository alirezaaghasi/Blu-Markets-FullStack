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
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const decoded = await request.jwtVerify<JwtPayload>();
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
    const decoded = await request.jwtVerify<JwtPayload>();
    request.userId = decoded.sub;
    request.portfolioId = decoded.portfolioId;
  } catch {
    // Token not required, continue without auth
  }
}
