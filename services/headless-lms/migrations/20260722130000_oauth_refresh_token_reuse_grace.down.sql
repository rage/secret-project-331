BEGIN;

ALTER TABLE oauth_refresh_tokens
  DROP COLUMN IF EXISTS rotated_at;

COMMIT;
