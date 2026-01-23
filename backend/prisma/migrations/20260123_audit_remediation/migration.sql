-- Audit Remediation Migration
-- Adds expiry price fields, shortfall tracking, protection unique constraint, and OTP hash storage

-- Add expiry price capture fields to protections table
ALTER TABLE "protections" ADD COLUMN IF NOT EXISTS "expiry_price_usd" DECIMAL(20, 8);
ALTER TABLE "protections" ADD COLUMN IF NOT EXISTS "expiry_price_irr" DECIMAL(20, 2);

-- Add shortfall tracking to loans table
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "shortfall_irr" DECIMAL(20, 2);

-- Increase OTP code column size to store bcrypt hashes (60 chars)
ALTER TABLE "otp_codes" ALTER COLUMN "code" TYPE VARCHAR(60);

-- Create partial unique index for active protections per holding
-- This prevents multiple active protections on the same holding (race condition protection)
CREATE UNIQUE INDEX IF NOT EXISTS "protection_holding_active_unique"
ON "protections" ("holding_id")
WHERE "status" = 'ACTIVE' AND "holding_id" IS NOT NULL;
