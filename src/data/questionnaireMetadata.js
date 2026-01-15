/**
 * Questionnaire metadata for code-splitting optimization
 *
 * This module exports only the metadata needed for components that don't
 * require the full questionnaire data. The full questionnaire JSON is
 * loaded lazily only when entering onboarding.
 *
 * Note: Keep this in sync with questionnaire.v2.fa.json
 */

// v10.1 questionnaire has 9 questions
export const QUESTIONNAIRE_LENGTH = 9;

// Version for cache invalidation
export const QUESTIONNAIRE_VERSION = 'v10.1';
