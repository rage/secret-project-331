-- Replace oauth_clients.origin (single TEXT) with allowed_origins (TEXT[] optional).
-- Use same validation as callback URIs: are_valid_oauth_uris_or_null (is_valid_oauth_uri per element).
-- If allowed_origins is NULL or empty, origin check is not enforced (devices / non-browser clients).
BEGIN;

-- Add new column (nullable)
ALTER TABLE oauth_clients ADD COLUMN allowed_origins TEXT[];

-- Migrate existing data: single origin string -> one-element array
UPDATE oauth_clients SET allowed_origins = ARRAY[origin] WHERE origin IS NOT NULL;

-- Drop old constraint and column
ALTER TABLE oauth_clients DROP CONSTRAINT oauth_clients_origin_shape_chk;
ALTER TABLE oauth_clients DROP COLUMN origin;

-- Validate allowed_origins with same function as callback URIs (NULL or each element valid)
ALTER TABLE oauth_clients ADD CONSTRAINT oauth_clients_allowed_origins_valid CHECK (
  are_valid_oauth_uris_or_null(allowed_origins)
);

COMMENT ON COLUMN oauth_clients.allowed_origins IS 'Optional list of allowed origins (same validation as redirect URIs). If NULL or empty, origin check is not enforced (e.g. for devices).';

COMMIT;
