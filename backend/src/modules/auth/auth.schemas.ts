import { z } from 'zod';

// Iranian phone number validation: +989XXXXXXXXX
const phoneRegex = /^\+989\d{9}$/;

export const sendOtpSchema = z.object({
  phone: z
    .string()
    .regex(phoneRegex, 'Invalid Iranian phone number format. Use +989XXXXXXXXX'),
});

export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(phoneRegex, 'Invalid Iranian phone number format. Use +989XXXXXXXXX'),
  code: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
