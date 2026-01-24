import { randomBytes, createHash } from 'crypto';
import { createSigner, createVerifier } from 'fast-jwt';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error-handler.js';
import type { AuthTokens } from '../../types/api.js';

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

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

// Create JWT signers and verifiers with separate secrets for access and refresh tokens
const signAccessToken = createSigner({ key: env.JWT_ACCESS_SECRET, expiresIn: parseExpiry(env.JWT_ACCESS_EXPIRY) * 1000 });
const signRefreshToken = createSigner({ key: env.JWT_REFRESH_SECRET, expiresIn: parseExpiry(env.JWT_REFRESH_EXPIRY) * 1000 });
const verifyRefreshToken = createVerifier({ key: env.JWT_REFRESH_SECRET });

interface TokenPayload {
  sub: string;
  phone: string;
  portfolioId?: string;
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
    ipAddress?: string
  ): Promise<AuthTokens> {
    // Generate refresh token
    const refreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Store session
    const session = await prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        deviceInfo: deviceInfo ? JSON.parse(JSON.stringify(deviceInfo)) : undefined,
        ipAddress,
        expiresAt,
      },
    });

    // Generate access JWT with access secret
    const accessToken = signAccessToken({
      sub: userId,
      phone,
      portfolioId,
    } as TokenPayload);

    // Generate refresh JWT with separate refresh secret (security: isolates token compromise)
    const refreshJwt = signRefreshToken({
      sub: userId,
      sessionId: session.id,
    } as RefreshPayload);

    return {
      accessToken,
      refreshToken: refreshJwt,
      expiresIn: parseExpiry(env.JWT_ACCESS_EXPIRY),
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token with refresh secret
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

    if (!session || session.revoked || session.expiresAt < new Date()) {
      throw new AppError('UNAUTHORIZED', 'Session expired or revoked', 401);
    }

    // Generate new tokens
    return this.createSession(
      session.userId,
      session.user.phone,
      session.user.portfolio?.id,
      session.deviceInfo as Record<string, unknown> | undefined,
      session.ipAddress ?? undefined
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
