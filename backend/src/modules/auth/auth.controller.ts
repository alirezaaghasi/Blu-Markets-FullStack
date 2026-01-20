import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from './auth.schemas.js';
import { sendOtp, verifyOtp } from './otp.service.js';
import { AuthService } from './auth.service.js';
import type { SendOtpResponse, VerifyOtpResponse, AuthTokens } from '../../types/api.js';

export class AuthController {
  private authService: AuthService;

  constructor(app: FastifyInstance) {
    this.authService = new AuthService(app);
  }

  async sendOtp(
    request: FastifyRequest<{ Body: { phone: string } }>,
    reply: FastifyReply
  ): Promise<SendOtpResponse> {
    const { phone } = sendOtpSchema.parse(request.body);

    const { expiresIn } = await sendOtp(phone);

    return {
      success: true,
      message: 'OTP sent',
      expiresIn,
    };
  }

  async verifyOtp(
    request: FastifyRequest<{ Body: { phone: string; code: string } }>,
    reply: FastifyReply
  ): Promise<VerifyOtpResponse> {
    const { phone, code } = verifyOtpSchema.parse(request.body);

    // Verify OTP
    await verifyOtp(phone, code);

    // Find or create user
    const { user, isNewUser, onboardingComplete } =
      await this.authService.findOrCreateUser(phone);

    // Create session and tokens
    const tokens = await this.authService.createSession(
      user.id,
      user.phone,
      undefined, // portfolioId will be added after onboarding
      {
        userAgent: request.headers['user-agent'],
        platform: request.headers['x-platform'],
      },
      request.ip
    );

    return {
      success: true,
      tokens,
      isNewUser,
      onboardingComplete,
    };
  }

  async refresh(
    request: FastifyRequest<{ Body: { refreshToken: string } }>,
    reply: FastifyReply
  ): Promise<AuthTokens> {
    const { refreshToken } = refreshTokenSchema.parse(request.body);

    const tokens = await this.authService.refreshTokens(refreshToken);

    return tokens;
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<{ success: boolean }> {
    // Revoke all sessions for this user
    await this.authService.revokeAllUserSessions(request.userId);

    return { success: true };
  }
}
