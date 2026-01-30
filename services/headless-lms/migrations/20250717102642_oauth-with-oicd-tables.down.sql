BEGIN;

-- ----------------------------------------------------------------------
-- Drop triggers
-- ----------------------------------------------------------------------

DROP TRIGGER set_timestamp_oauth_clients              ON oauth_clients;
DROP TRIGGER set_timestamp_oauth_auth_codes           ON oauth_auth_codes;
DROP TRIGGER set_timestamp_oauth_access_tokens        ON oauth_access_tokens;
DROP TRIGGER set_timestamp_oauth_refresh_tokens       ON oauth_refresh_tokens;
DROP TRIGGER set_timestamp_oauth_user_client_scopes   ON oauth_user_client_scopes;

-- ----------------------------------------------------------------------
-- Drop tables (reverse dependency order)
-- ----------------------------------------------------------------------

-- DPoP replay store
DROP TABLE oauth_dpop_proofs;

-- Remembered consents
DROP TABLE oauth_user_client_scopes;

-- Refresh tokens (self-FK on rotated_from is internal)
DROP TABLE oauth_refresh_tokens;

-- Access tokens
DROP TABLE oauth_access_tokens;

-- Authorization codes
DROP TABLE oauth_auth_codes;

-- Clients (after dependents)
DROP TABLE oauth_clients;

-- ----------------------------------------------------------------------
-- Drop enum types (after tables that used them are gone)
-- ----------------------------------------------------------------------

DROP TYPE token_type;
DROP TYPE grant_type;
DROP TYPE pkce_method;
DROP TYPE application_type;
DROP TYPE token_endpoint_auth_method;

-- ----------------------------------------------------------------------
-- Drop helper functions (reverse dependency: array validators → single URI → trigger)
-- ----------------------------------------------------------------------

DROP FUNCTION scopes_all_valid(TEXT[]);
DROP FUNCTION are_valid_oauth_uris(TEXT[]);
DROP FUNCTION are_valid_oauth_uris_or_null(TEXT[]);
DROP FUNCTION is_valid_oauth_uri(TEXT);
DROP FUNCTION trigger_set_timestamp();

COMMIT;
