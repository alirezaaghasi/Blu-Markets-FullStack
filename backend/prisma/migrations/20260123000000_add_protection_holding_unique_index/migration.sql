-- Add partial unique index to prevent multiple ACTIVE protections per holding
-- This ensures data integrity at the database level

CREATE UNIQUE INDEX IF NOT EXISTS protection_holding_active_unique
ON protections (holding_id)
WHERE status = 'ACTIVE' AND holding_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX protection_holding_active_unique IS 'Ensures only one ACTIVE protection per holding to prevent double-coverage';
