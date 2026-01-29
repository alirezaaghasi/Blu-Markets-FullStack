import { randomBytes, createHash } from 'crypto';
import { createSigner, createVerifier } from 'fast-jwt';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';
import type { AuthTokens } from '../../types/api.js';

// SECURITY FIX: Parse expiry string to seconds
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // Default 15 minutes

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 900;
  }
}

// SECURITY FIX: Derive session expiry from JWT_REFRESH_EXPIRY to ensure consistency
// Previously, session expiry was hard-coded to 7 days while JWT expiry came from env
const REFRESH_TOKEN_EXPIRY_SECONDS = parseExpiry(env.JWT_REFRESH_EXPIRY);

// Create JWT signers and verifiers with separate secrets for access and refresh tokens
const signAccessToken = createSigner({ key: env.JWT_ACCESS_SECRET, expiresIn: parseExpiry(env.JWT_ACCESS_EXPIRY) * 1000 });
const signRefreshToken = createSigner({ key: env.JWT_REFRESH_SECRET, expiresIn: parseExpiry(env.JWT_REFRESH_EXPIRY) * 1000 });
const verifyRefreshToken = createVerifier({ key: env.JWT_REFRESH_SECRET });

interface TokenPayload {
  sub: string;
  phone: string;
  portfolioId?: string;
  sessionId?: string;
}

interface RefreshPayload {
  sub: string;
  sessionId: string;
}

export class AuthService {

  async findOrCreateUser(phone: string): Promise<{
    user: { id: string; phone: string };
    isNewUser: boolean;
    onboardingComplete: boolean;
  }> {
    let user = await prisma.user.findUnique({
      where: { phone },
      include: { portfolio: true },
    });

    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          phoneVerified: true,
        },
        include: { portfolio: true },
      });
    } else {
      // Update phone verified and last login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          phoneVerified: true,
          lastLoginAt: new Date(),
        },
      });
    }

    // Check if onboarding is complete (has risk score and consent)
    const onboardingComplete = !!(
      user.riskScore &&
      user.consentRisk &&
      user.consentLoss &&
      user.consentNoGuarantee &&
      user.portfolio
    );

    return {
      user: { id: user.id, phone: user.phone },
      isNewUser,
      onboardingComplete,
    };
  }

  async createSession(
    userId: string,
    phone: string,
    portfolioId?: string,
    deviceInfo?: Record<string, unknown>,
    ipAddress?: string,
    existingSessionId?: string // For rotation - update existing session instead of creating new
  ): Promise<AuthTokens> {
    // SECURITY FIX: Use consistent expiry derived from JWT_REFRESH_EXPIRY env variable
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000);

    let sessionId: string;

    if (existingSessionId) {
      // SECURITY FIX H-01: Token rotation - update existing session
      sessionId = existingSessionId;
    } else {
      // Create new session with placeholder hash (will be updated below)
      const session = await prisma.session.create({
        data: {
          userId,
          refreshTokenHash: 'pending', // Will be updated after JWT is signed
          deviceInfo: deviceInfo ? JSON.parse(JSON.stringify(deviceInfo)) : undefined,
          ipAddress,
          expiresAt,
        },
      });
      sessionId = session.id;
    }

    // Generate access JWT with sessionId for revocation checking
    const accessToken = signAccessToken({
      sub: userId,
      phone,
      portfolioId,
      sessionId, // SECURITY FIX: Include sessionId for revocation check
    } as TokenPayload);

    // Generate refresh JWT with session ID embedded
    const refreshJwt = signRefreshToken({
      sub: userId,
      sessionId,
    } as RefreshPayload);

    // SECURITY FIX H-01: Store hash of actual JWT (not a separate random token)
    // This enables verification that the exact token presented matches what was issued
    const refreshJwtHash = createHash('sha256').update(refreshJwt).digest('hex');

    // Update session with actual JWT hash
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: refreshJwtHash,
        expiresAt,
        // Reset revoked status on rotation
        revoked: false,
        revokedAt: null,
      },
    });

    return {
      accessToken,
      refreshToken: refreshJwt,
      expiresIn: parseExpiry(env.JWT_ACCESS_EXPIRY),
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token JWT signature with refresh secret
    let payload: RefreshPayload;
    try {
      payload = verifyRefreshToken(refreshToken) as RefreshPayload;
    } catch {
      throw new AppError('UNAUTHORIZED', 'Invalid refresh token', 401);
    }

    // Find session
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: {
          include: { portfolio: true },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new AppError('UNAUTHORIZED', 'Session expired', 401);
    }

    if (session.revoked) {
      throw new AppError('UNAUTHORIZED', 'Session has been revoked', 401);
    }

    // SECURITY FIX H-01: Verify the presented token matches the stored hash
    // This prevents replay attacks with previously valid tokens
    const presentedTokenHash = createHash('sha256').update(refreshToken).digest('hex');

    if (session.refreshTokenHash !== presentedTokenHash) {
      // SECURITY: Token reuse detected - this token was already rotated
      // An attacker may have stolen the old token. Revoke ALL user sessions as precaution.
      logger.warn('Token reuse detected, revoking all sessions', { userId: session.userId });
      await this.revokeAllUserSessions(session.userId);
      throw new AppError('UNAUTHORIZED', 'Token reuse detected. All sessions revoked for security.', 401);
    }

    // SECURITY FIX H-01: Rotate token - issue new token and update hash
    // The old token is now invalid because the hash will change
    return this.createSession(
      session.userId,
      session.user.phone,
      session.user.portfolio?.id,
      session.deviceInfo as Record<string, unknown> | undefined,
      session.ipAddress ?? undefined,
      session.id // Pass existing session ID for rotation
    );
  }

  async revokeSession(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        revoked: true,
        revokedAt: new Date(),
      },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { userId, revoked: false },
      data: {
        revoked: true,
        revokedAt: new Date(),
      },
    });
  }
}
