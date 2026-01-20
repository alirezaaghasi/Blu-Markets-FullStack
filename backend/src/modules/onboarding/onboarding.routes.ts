import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  handleSubmitQuestionnaire,
  handleRecordConsent,
  handleInitialFunding,
} from './onboarding.controller.js';

export const onboardingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All onboarding routes require authentication
  app.addHook('preHandler', authenticate);

  // POST /api/v1/onboarding/questionnaire
  app.post('/questionnaire', {
    schema: {
      description: 'Submit risk questionnaire answers',
      tags: ['Onboarding'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['answers'],
        properties: {
          answers: {
            type: 'array',
            minItems: 10,
            maxItems: 10,
            items: {
              type: 'object',
              required: ['questionId', 'answerId', 'value'],
              properties: {
                questionId: { type: 'string' },
                answerId: { type: 'string' },
                value: { type: 'number', minimum: 1, maximum: 5 },
              },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            riskScore: { type: 'number' },
            riskTier: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            profileName: { type: 'string' },
            targetAllocation: {
              type: 'object',
              properties: {
                foundation: { type: 'number' },
                growth: { type: 'number' },
                upside: { type: 'number' },
              },
            },
          },
        },
      },
    },
    handler: handleSubmitQuestionnaire,
  });

  // POST /api/v1/onboarding/consent
  app.post('/consent', {
    schema: {
      description: 'Record user consent acknowledgments',
      tags: ['Onboarding'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['consentRisk', 'consentLoss', 'consentNoGuarantee'],
        properties: {
          consentRisk: { type: 'boolean', const: true },
          consentLoss: { type: 'boolean', const: true },
          consentNoGuarantee: { type: 'boolean', const: true },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
    handler: handleRecordConsent,
  });

  // POST /api/v1/onboarding/initial-funding
  app.post('/initial-funding', {
    schema: {
      description: 'Create portfolio with initial funding',
      tags: ['Onboarding'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['amountIrr'],
        properties: {
          amountIrr: { type: 'number', minimum: 10000000 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            portfolioId: { type: 'string' },
            cashIrr: { type: 'number' },
            targetAllocation: {
              type: 'object',
              properties: {
                foundation: { type: 'number' },
                growth: { type: 'number' },
                upside: { type: 'number' },
              },
            },
          },
        },
      },
    },
    handler: handleInitialFunding,
  });
};
