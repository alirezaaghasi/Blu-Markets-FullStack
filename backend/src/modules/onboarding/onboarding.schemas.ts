import { z } from 'zod';

export const questionnaireAnswerSchema = z.object({
  questionId: z.string().min(1),
  answerId: z.string().min(1),
  value: z.number().min(1).max(10),
});

export const submitQuestionnaireSchema = z.object({
  answers: z
    .array(questionnaireAnswerSchema)
    .min(9, 'All 9 questions must be answered')
    .max(9, 'Only 9 questions allowed'),
});

export const recordConsentSchema = z.object({
  consentRisk: z.literal(true, {
    errorMap: () => ({ message: 'Risk consent must be acknowledged' }),
  }),
  consentLoss: z.literal(true, {
    errorMap: () => ({ message: 'Loss consent must be acknowledged' }),
  }),
  consentNoGuarantee: z.literal(true, {
    errorMap: () => ({ message: 'No guarantee consent must be acknowledged' }),
  }),
});

export const initialFundingSchema = z.object({
  amountIrr: z
    .number()
    .min(10000000, 'Minimum initial funding is 10,000,000 IRR')
    .max(100000000000, 'Maximum initial funding is 100,000,000,000 IRR'),
});

export type SubmitQuestionnaireInput = z.infer<typeof submitQuestionnaireSchema>;
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;
export type InitialFundingInput = z.infer<typeof initialFundingSchema>;
