CREATE TABLE oauth_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id TEXT UNIQUE NOT NULL,
    client_secret TEXT NOT NULL,
    redirect_uris TEXT[] NOT NULL,
    grant_types TEXT[] NOT NULL,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON oauth_clients FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE oauth_clients IS
  'Store OAuth clients. These are other services that want to use mooc oauth';

COMMENT ON COLUMN oauth_clients.id IS
  'Unique internal UUID for each registered client';
COMMENT ON COLUMN oauth_clients.client_id IS
  'Public identifier for the OAuth client (used in auth requests)';
COMMENT ON COLUMN oauth_clients.client_secret IS
  'Secret for client for verifying the client.';
COMMENT ON COLUMN oauth_clients.redirect_uris IS
  'List of allowed redirect URIs for the client.';
COMMENT ON COLUMN oauth_clients.grant_types IS
  'List of allowed grant types for the client. Scopes are defined by the server and the OAuth spec does not define any.';
COMMENT ON COLUMN oauth_clients.scope IS
  'Default scope or scopes the client may request if none provided at runtime';
COMMENT ON COLUMN oauth_clients.created_at IS
  'Timestamp when this client record was created';

CREATE TABLE oauth_auth_codes (
    code TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    scope TEXT,
    nonce TEXT,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_oauth_auth_codes_expires_at ON oauth_auth_codes (expires_at);
COMMENT ON TABLE oauth_auth_codes IS
  'Temporary authorization codes issued to clients after user consent';

COMMENT ON COLUMN oauth_auth_codes.code IS
  'One‑time authorization code to be exchanged for tokens';
COMMENT ON COLUMN oauth_auth_codes.user_id IS
  'UUID of the user who granted authorization';
COMMENT ON COLUMN oauth_auth_codes.client_id IS
  'UUID of the client that requested this code';
COMMENT ON COLUMN oauth_auth_codes.redirect_uri IS
  'Redirect URI that must match the one used in the /authorize request';
COMMENT ON COLUMN oauth_auth_codes.scope IS
  'Space‑separated list of scopes granted by this code';
COMMENT ON COLUMN oauth_auth_codes.nonce IS
  'OIDC nonce value to be echoed into the ID token';
COMMENT ON COLUMN oauth_auth_codes.used IS
  'Flag indicating whether this code has already been exchanged';
COMMENT ON COLUMN oauth_auth_codes.expires_at IS
  'Expiration timestamp after which the code is invalid';
COMMENT ON COLUMN oauth_auth_codes.created_at IS
  'Timestamp when this authorization code was created';

CREATE TABLE oauth_access_tokens (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    scope TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_oauth_access_tokens_expires_at ON oauth_access_tokens (expires_at);
COMMENT ON TABLE oauth_access_tokens IS
  'Access tokens issued to clients for calling protected APIs';

COMMENT ON COLUMN oauth_access_tokens.token IS
  'Opaque or JWT string representing the access token';
COMMENT ON COLUMN oauth_access_tokens.user_id IS
  'UUID of the user on whose behalf this token was issued';
COMMENT ON COLUMN oauth_access_tokens.client_id IS
  'UUID of the client that owns this access token';
COMMENT ON COLUMN oauth_access_tokens.scope IS
  'Space‑separated list of scopes granted to this token';
COMMENT ON COLUMN oauth_access_tokens.expires_at IS
  'Timestamp when this access token expires';
COMMENT ON COLUMN oauth_access_tokens.created_at IS
  'Timestamp when this access token was created';

CREATE TABLE oauth_refresh_tokens (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    scope TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_oauth_refresh_tokens_expires_at ON oauth_refresh_tokens (expires_at);
COMMENT ON TABLE oauth_refresh_tokens IS
  'Refresh tokens used to obtain new access tokens without re‑authentication';

COMMENT ON COLUMN oauth_refresh_tokens.token IS
  'Opaque string representing the refresh token';
COMMENT ON COLUMN oauth_refresh_tokens.user_id IS
  'UUID of the user who owns this refresh token';
COMMENT ON COLUMN oauth_refresh_tokens.client_id IS
  'UUID of the client that owns this refresh token';
COMMENT ON COLUMN oauth_refresh_tokens.scope IS
  'Space‑separated list of scopes associated with this refresh token';
COMMENT ON COLUMN oauth_refresh_tokens.expires_at IS
  'Optional expiration timestamp for the refresh token';
COMMENT ON COLUMN oauth_refresh_tokens.revoked IS
  'Flag indicating whether this refresh token has been revoked';
COMMENT ON COLUMN oauth_refresh_tokens.created_at IS
  'Timestamp when this refresh token was created';

