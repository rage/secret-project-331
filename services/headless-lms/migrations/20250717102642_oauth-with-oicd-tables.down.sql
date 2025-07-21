

DROP INDEX IF EXISTS idx_oauth_jwks_keys_expires_at;
DROP INDEX IF EXISTS idx_oauth_refresh_tokens_expires_at;
DROP INDEX IF EXISTS idx_oauth_access_tokens_expires_at;
DROP INDEX IF EXISTS idx_oauth_auth_codes_expires_at;

DROP TABLE IF EXISTS oauth_jwks_keys;
DROP TABLE IF EXISTS oauth_refresh_tokens;
DROP TABLE IF EXISTS oauth_access_tokens;
DROP TABLE IF EXISTS oauth_auth_codes;
DROP TABLE IF EXISTS oauth_clients;
