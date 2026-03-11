-- Revert allowed_origins back to single origin column.
BEGIN;

ALTER TABLE oauth_clients ADD COLUMN origin TEXT;

-- Backfill: first element of array
UPDATE oauth_clients SET origin = allowed_origins[1] WHERE allowed_origins IS NOT NULL AND array_length(allowed_origins, 1) >= 1;
-- Any row with NULL origin (had NULL/empty allowed_origins) gets a placeholder so NOT NULL and constraint hold
UPDATE oauth_clients SET origin = 'https://localhost' WHERE origin IS NULL;
ALTER TABLE oauth_clients ALTER COLUMN origin SET NOT NULL;

ALTER TABLE oauth_clients DROP CONSTRAINT oauth_clients_allowed_origins_valid;
ALTER TABLE oauth_clients DROP COLUMN allowed_origins;

-- Restore original constraint (https or http loopback only)
ALTER TABLE oauth_clients ADD CONSTRAINT oauth_clients_origin_shape_chk CHECK (
  origin ~* '^(https://[^/\s]+|http://((localhost(\.localdomain)?)|127(?:\.\d{1,3}){3}|\[::1\]))$'
);

COMMENT ON COLUMN oauth_clients.origin IS 'Allowed origin (https, or loopback http) for browser/SPAs.';

COMMIT;
