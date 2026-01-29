import { FastifyReply, FastifyRequest } from 'fastify';
import { createVerifier } from 'fast-jwt';
import { env } from '../config/env.js';
import { AppError } from './error-handler.js';
import { prisma } from '../config/database.js';

export interface JwtPayload {
  sub: string; // user id
  phone: string;
  portfolioId?: string;
  sessionId?: string; // Added for session revocation checking
  iat: number;
  exp: number;
}

// Create verifier for access tokens
const verifyAccessToken = createVerifier({ key: env.JWT_ACCESS_SECRET });

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
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 'Missing authorization token', 401);
    }

    const token = authHeader.slice(7);
    const decoded = verifyAccessToken(token) as JwtPayload;

    // SECURITY FIX: Verify session is not revoked
    // This enables immediate logout by revoking the session
    if (decoded.sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
        select: { revoked: true, expiresAt: true },
      });
      if (!session || session.revoked || session.expiresAt < new Date()) {
        throw new AppError('UNAUTHORIZED', 'Session revoked or expired', 401);
      }
    }

    request.userId = decoded.sub;
    request.portfolioId = decoded.portfolioId;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}

export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return; // No token, continue without auth
    }

    const token = authHeader.slice(7);
    const decoded = verifyAccessToken(token) as JwtPayload;
    request.userId = decoded.sub;
    request.portfolioId = decoded.portfolioId;
  } catch {
    // Token not required, continue without auth
  }
}

/**
 * Verify an access token and return the payload.
 * Use this for WebSocket or other contexts where you have a raw token.
 * Throws if token is invalid or expired.
 */
export function verifyAccessTokenPayload(token: string): JwtPayload {
  return verifyAccessToken(token) as JwtPayload;
}
