CREATE TABLE oauth_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id TEXT UNIQUE NOT NULL,
    client_secret bytea NOT NULL,
    pepper_id smallint NOT NULL,
    redirect_uris TEXT[] NOT NULL,
    grant_types TEXT[] NOT NULL,
    scope TEXT,
    origin TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE
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
COMMENT ON COLUMN oauth_clients.origin IS
  'Only allowed origin for request coming from this client';
COMMENT ON COLUMN oauth_clients.created_at IS
  'Timestamp when this client record was created';

CREATE TABLE oauth_auth_codes (
    digest bytea PRIMARY KEY,
    pepper_id smallint NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT '',
    jti UUID NOT NULL DEFAULT uuid_generate_v4(),
    nonce TEXT,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'

);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON oauth_auth_codes FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_oauth_auth_codes_expires_at ON oauth_auth_codes (expires_at);
COMMENT ON TABLE oauth_auth_codes IS
  'Temporary authorization codes issued to clients after user consent';

COMMENT ON COLUMN oauth_auth_codes.digest IS
  'One‑time authorization code to be exchanged for tokens, hashed';
COMMENT ON COLUMN oauth_auth_codes.pepper_id IS
  'Tracks which pepper version was used when generating this token';
COMMENT ON COLUMN oauth_auth_codes.user_id IS
  'UUID of the user who granted authorization';
COMMENT ON COLUMN oauth_auth_codes.client_id IS
  'UUID of the client that requested this code';
COMMENT ON COLUMN oauth_auth_codes.redirect_uri IS
  'Redirect URI that must match the one used in the /authorize request';
COMMENT ON COLUMN oauth_auth_codes.scope IS
  'Space‑separated list of scopes granted by this code';
COMMENT ON COLUMN oauth_auth_codes.jti IS
  'Unique token id for logging/trace';
COMMENT ON COLUMN oauth_auth_codes.nonce IS
  'OIDC nonce value to be echoed into the ID token';
COMMENT ON COLUMN oauth_auth_codes.used IS
  'Flag indicating whether this code has already been exchanged';
COMMENT ON COLUMN oauth_auth_codes.expires_at IS
  'Expiration timestamp after which the code is invalid';
COMMENT ON COLUMN oauth_auth_codes.created_at IS
  'Timestamp when this authorization code was created';
COMMENT ON COLUMN oauth_auth_codes.metadata IS
  'optional metadata as json';

CREATE TABLE oauth_access_tokens (
    digest bytea PRIMARY KEY,
    pepper_id smallint NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    scope TEXT,
    audience TEXT NULL,
    jti UUID NOT NULL DEFAULT uuid_generate_v4(),
    dpop_jkt TEXT NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON oauth_access_tokens FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_oauth_access_tokens_expires_at ON oauth_access_tokens (expires_at);
CREATE INDEX idx_oauth_access_tokens_user_client ON oauth_access_tokens (user_id, client_id);

COMMENT ON TABLE oauth_access_tokens IS
  'Access tokens issued to clients for calling protected APIs';
COMMENT ON COLUMN oauth_access_tokens.digest IS
  'One‑time authorization code to be exchanged for tokens, hashed';
COMMENT ON COLUMN oauth_access_tokens.pepper_id IS
  'Tracks which pepper version was used when generating this token';
COMMENT ON COLUMN oauth_access_tokens.user_id IS
  'UUID of the user on whose behalf this token was issued, in OAuth terms subject or sub. Can be NULL for machine-machine workflows.';
COMMENT ON COLUMN oauth_access_tokens.client_id IS
  'UUID of the client that owns this access token';
COMMENT ON COLUMN oauth_access_tokens.scope IS
  'Space‑separated list of scopes granted to this token';
COMMENT ON COLUMN oauth_access_tokens.audience IS
  'Determines which servers/apis the token is valid for. NULL for default = all. This is different to scope, which sets scopes inside the api.';
COMMENT ON COLUMN oauth_access_tokens.jti IS
  'Unique token id for logging/trace';
COMMENT ON COLUMN oauth_access_tokens.dpop_jkt IS
  'Dpop jkt is the thumbprint of the JWK this token was signed with.';
COMMENT ON COLUMN oauth_access_tokens.expires_at IS
  'Timestamp when this access token expires';
COMMENT ON COLUMN oauth_access_tokens.created_at IS
  'Timestamp when this access token was created';

CREATE TABLE oauth_refresh_tokens (
    digest bytea PRIMARY KEY,
    pepper_id smallint NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    scope TEXT NOT NULL DEFAULT '',
    audience TEXT NULL,
    jti uuid NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    rotated_from bytea NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    dpop_jkt TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON oauth_refresh_tokens FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_oauth_refresh_tokens_expires_at ON oauth_refresh_tokens (expires_at);
CREATE INDEX idx_oauth_refresh_tokens_user_client ON oauth_refresh_tokens (user_id, client_id);
CREATE UNIQUE INDEX idx_oauth_refresh_tokens_jti ON oauth_refresh_tokens (jti);

COMMENT ON TABLE oauth_refresh_tokens IS
  'Refresh tokens (opaque) stored as keyed hashes; rotated on use';

COMMENT ON COLUMN oauth_refresh_tokens.digest IS
  'Hashed value: HMAC(pepper, raw token). Plaintext is returned once to the client.';
COMMENT ON COLUMN oauth_refresh_tokens.pepper_id IS
  'Pepper identifier for digest rotation and verification.';
COMMENT ON COLUMN oauth_refresh_tokens.user_id IS
  'UUID of the user who owns this refresh token';
COMMENT ON COLUMN oauth_refresh_tokens.client_id IS
  'UUID of the client that owns this refresh token';
COMMENT ON COLUMN oauth_refresh_tokens.scope IS
  'Space‑separated list of scopes associated with this refresh token';
COMMENT ON COLUMN oauth_refresh_tokens.audience IS
  'Optional audience constraint mirrored from access token.';
COMMENT ON COLUMN oauth_refresh_tokens.jti IS
  'Server-side unique id for this refresh token.';
COMMENT ON COLUMN oauth_refresh_tokens.expires_at IS
  'Optional expiration timestamp for the refresh token';
COMMENT ON COLUMN oauth_refresh_tokens.revoked IS
  'Flag indicating whether this refresh token has been revoked';
COMMENT ON COLUMN oauth_refresh_tokens.rotated_from IS
  'Digest of the previous refresh token in the rotation chain.';
COMMENT ON COLUMN oauth_refresh_tokens.metadata IS
  'Optional metadata (ip, device, etc).';
COMMENT ON COLUMN oauth_refresh_tokens.dpop_jkt IS
  'Optional DPoP JWK thumbprint binding this refresh token to a key.';
COMMENT ON COLUMN oauth_refresh_tokens.created_at IS
  'Timestamp when this refresh token was created';

CREATE TABLE oauth_user_client_scopes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id, scope)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON oauth_user_client_scopes FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_oauth_user_client_scopes_user ON oauth_user_client_scopes(user_id);
CREATE INDEX idx_oauth_user_client_scopes_client ON oauth_user_client_scopes(client_id);

CREATE TABLE IF NOT EXISTS oauth_dpop_proofs (
  jti_hash bytea PRIMARY KEY,  -- SHA-256(jti)
  seen_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dpop_seen_at ON oauth_dpop_proofs (seen_at);

COMMENT ON TABLE oauth_dpop_proofs IS
  'Replay protection store for DPoP proofs. Tracks used jti values to prevent replay attacks.';
COMMENT ON COLUMN oauth_dpop_proofs.jti_hash IS
  'SHA-256 hash of the DPoP proof''s jti claim. Using a hash avoids storing raw jtis and keeps row size fixed. Primary key ensures each proof is only used once.';
COMMENT ON COLUMN oauth_dpop_proofs.seen_at IS
  'Timestamp when this DPoP proof was first observed and stored. Used for cleanup of old entries.';

