import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new AuthController(app);

  // POST /api/v1/auth/send-otp
  app.post('/send-otp', {
    schema: {
      description: 'Send OTP to phone number',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['phone'],
        properties: {
          phone: { type: 'string', pattern: '^\\+989\\d{9}$' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            expiresIn: { type: 'number' },
          },
        },
      },
    },
    handler: controller.sendOtp.bind(controller),
  });

  // POST /api/v1/auth/verify-otp
  app.post('/verify-otp', {
    schema: {
      description: 'Verify OTP and authenticate',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['phone', 'code'],
        properties: {
          phone: { type: 'string', pattern: '^\\+989\\d{9}$' },
          code: { type: 'string', minLength: 6, maxLength: 6 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            tokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                expiresIn: { type: 'number' },
              },
            },
            isNewUser: { type: 'boolean' },
            onboardingComplete: { type: 'boolean' },
          },
        },
      },
    },
    handler: controller.verifyOtp.bind(controller),
  });

  // POST /api/v1/auth/refresh
  app.post('/refresh', {
    schema: {
      description: 'Refresh access token',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' },
          },
        },
      },
    },
    handler: controller.refresh.bind(controller),
  });

  // POST /api/v1/auth/logout
  app.post('/logout', {
    schema: {
      description: 'Logout and revoke all sessions',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
    preHandler: authenticate,
    handler: controller.logout.bind(controller),
  });
};
