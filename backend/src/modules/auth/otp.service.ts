import { randomInt } from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error-handler.js';

const BCRYPT_SALT_ROUNDS = 10;

// OTP Configuration (per PRD)
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 120; // 2 minutes
const OTP_MAX_ATTEMPTS = 3;
const OTP_RATE_LIMIT_COUNT = 3;
const OTP_RATE_LIMIT_WINDOW_MINUTES = 5;

function generateOtp(): string {
  // Generate cryptographically random 6-digit code
  return String(randomInt(100000, 1000000));
}

export async function sendOtp(phone: string): Promise<{ expiresIn: number }> {
  // Rate limiting: Check recent OTPs for this phone
  const recentOtps = await prisma.otpCode.count({
    where: {
      phone,
      createdAt: {
        gte: new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000),
      },
    },
  });

  if (recentOtps >= OTP_RATE_LIMIT_COUNT) {
    throw new AppError(
      'RATE_LIMITED',
      `Too many OTP requests. Please wait ${OTP_RATE_LIMIT_WINDOW_MINUTES} minutes.`,
      429
    );
  }

  // Generate new OTP
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);

  // Hash OTP before storing (security: never store plaintext OTPs)
  const hashedCode = await bcrypt.hash(code, BCRYPT_SALT_ROUNDS);

  // Store hashed OTP
  await prisma.otpCode.create({
    data: {
      phone,
      code: hashedCode,
      expiresAt,
    },
  });

  // Send OTP via SMS (Kavenegar)
  await sendSms(phone, code);

  return { expiresIn: OTP_EXPIRY_SECONDS };
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  // SECURITY: Development bypass removed - always verify through proper channel
  // In development, OTP is logged to console (see sendSms function) for testing
  // This prevents accidental bypass if NODE_ENV is misconfigured in production

  // Find valid OTP
  const otp = await prisma.otpCode.findFirst({
    where: {
      phone,
      verified: false,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    throw new AppError('OTP_EXPIRED', 'OTP has expired or does not exist', 400);
  }

  // Check attempts
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError(
      'OTP_MAX_ATTEMPTS',
      'Maximum OTP attempts exceeded. Please request a new code.',
      400
    );
  }

  // Verify code using bcrypt (compare plaintext with stored hash)
  const isMatch = await bcrypt.compare(code, otp.code);
  if (!isMatch) {
    // Increment attempts
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError('OTP_INVALID', 'Invalid OTP code', 400);
  }

  // Mark as verified
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { verified: true },
  });

  return true;
}

async function sendSms(phone: string, code: string): Promise<void> {
  // In development, log the code
  if (env.NODE_ENV === 'development') {
    console.log(`📱 OTP for ${phone}: ${code}`);
    return;
  }

  // Production: Send via Kavenegar
  if (!env.KAVENEGAR_API_KEY) {
    console.warn('KAVENEGAR_API_KEY not configured, OTP not sent');
    return;
  }

  try {
    const response = await fetch(
      `https://api.kavenegar.com/v1/${env.KAVENEGAR_API_KEY}/verify/lookup.json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          receptor: phone.replace('+98', '0'), // Convert to local format
          token: code,
          template: 'blumarkets-otp',
        }),
      }
    );

    if (!response.ok) {
      console.error('Kavenegar SMS failed:', await response.text());
    }
  } catch (error) {
    console.error('Failed to send SMS:', error);
  }
}

// Cleanup expired OTPs (called by background job)
export async function cleanupExpiredOtps(): Promise<number> {
  const result = await prisma.otpCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { verified: true, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  return result.count;
}
