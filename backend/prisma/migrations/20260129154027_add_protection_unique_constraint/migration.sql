-- Add unique constraint for active protections per holding
-- This prevents duplicate active protections at the database level
-- Important for multi-instance deployments and race condition prevention

-- Create a partial unique index that only applies to ACTIVE protections
CREATE UNIQUE INDEX IF NOT EXISTS protection_holding_active_unique
ON protections (holding_id)
WHERE status = 'ACTIVE';
