/* ======================================================================
   OAuth/OIDC schema (PKCE + DPoP + ID Token nonce)
   ----------------------------------------------------------------------
   Tables:
     - oauth_clients: registered clients (public/confidential), grant policy.
     - oauth_auth_codes: pending grants (authorization codes) with PKCE + optional DPoP code binding.
     - oauth_access_tokens: opaque ATs; can be Bearer or DPoP-bound (cnf via dpop_jkt).
     - oauth_refresh_tokens: opaque RTs; can be sender-constrained via dpop_jkt.
     - oauth_user_client_scopes: remembered consent (user ↔ client).
     - oauth_dpop_proofs: replay store for DPoP `jti` (hashed), for proof reuse prevention.

   PKCE:
     - oauth_auth_codes.code_challenge + code_challenge_method (ENUM pkce_method).
     - Enforced in app logic: require PKCE for public clients / all clients by policy.

   DPoP:
     - Optional *authorization code* → key binding via oauth_auth_codes.dpop_jkt.
     - Token sender constraint:
         * oauth_access_tokens.token_type = 'DPoP' ⇒ dpop_jkt MUST be set.
         * oauth_refresh_tokens.dpop_jkt optional; if set, RT refresh requires DPoP with same JKT.
     - Replay prevention for proofs is stored in oauth_dpop_proofs (hash of jti).

   Token typing:
     - token_type ENUM('Bearer','DPoP') on access tokens; constraint ensures dpop_jkt consistency.

   Purging/TTL:
     - We intentionally do NOT add DB triggers/schedules here.
     - Cleanup is handled explicitly in application code,
       so behavior is visible in the codebase.

   Index notes:
     - Partial unique index on oauth_clients.client_id respects soft delete (deleted_at IS NULL).
     - Expiration indexes accelerate periodic cleanup and queries.
     - Composite indexes (user_id, client_id) speed per-user/per-client lookups.

   ====================================================================== */
BEGIN;
-- Enable crypto utils (gen_random_uuid, etc.)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_set_timestamp() IS
  'Sets NEW.updated_at = now() before UPDATE to keep last-modified timestamps fresh.';


-- Single URI validator
CREATE OR REPLACE FUNCTION is_valid_oauth_uri(uri TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF uri IS NULL OR trim(uri) = '' OR uri ~ '\s' OR uri LIKE '%#%' THEN
    RETURN FALSE;
  END IF;

  -- https (general)
  IF uri ~* '^https://[^\s]+$' THEN
    RETURN TRUE;

  -- http on loopback for dev
  ELSIF uri ~* '^http://((localhost(\.localdomain)?)|127(?:\.\d{1,3}){3}|\[::1\])(?::\d{1,5})?(?:/[^\s]*)?$' THEN
    RETURN TRUE;

  -- custom schemes (no "http"/"https" prefix)
  ELSIF uri ~* '^(?!https?://)[A-Za-z][A-Za-z0-9+.\-]*:(//)?[^\s]+$' THEN
    RETURN TRUE;

  -- URNs
  ELSIF uri ~* '^urn:[A-Za-z0-9][A-Za-z0-9\-]{0,31}:[^\s]+$' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION is_valid_oauth_uri(TEXT) IS
  'Validates OAuth-safe redirect/identifier URIs: https, http loopback (dev), custom schemes, and URNs.';


-- Array validators
CREATE OR REPLACE FUNCTION are_valid_oauth_uris(arr TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v TEXT;
BEGIN
  IF arr IS NULL OR array_length(arr,1) = 0 THEN
    RETURN FALSE;
  END IF;
  FOREACH v IN ARRAY arr LOOP
    IF NOT is_valid_oauth_uri(v) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION are_valid_oauth_uris(TEXT[]) IS
  'Returns TRUE if array is non-empty and all entries pass is_valid_oauth_uri().';


CREATE OR REPLACE FUNCTION are_valid_oauth_uris_or_null(arr TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v TEXT;
BEGIN
  IF arr IS NULL THEN
    RETURN TRUE;
  END IF;
  FOREACH v IN ARRAY arr LOOP
    IF NOT is_valid_oauth_uri(v) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION are_valid_oauth_uris_or_null(TEXT[]) IS
  'Returns TRUE if array is NULL or all entries pass is_valid_oauth_uri().';


CREATE OR REPLACE FUNCTION scopes_all_valid(arr TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s TEXT;
BEGIN
  IF arr IS NULL THEN
    RETURN TRUE;
  END IF;
  FOREACH s IN ARRAY arr LOOP
    IF s IS NULL OR s !~ '^[A-Za-z0-9._:-]+$' THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION scopes_all_valid(TEXT[]) IS
  'Validates scope token characters per conservative charset [A-Za-z0-9._:-].';


-- ----------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------

CREATE TYPE token_endpoint_auth_method AS ENUM ('none', 'client_secret_post');
CREATE TYPE application_type           AS ENUM ('web','native','spa','service');
CREATE TYPE pkce_method                AS ENUM ('plain','S256');
CREATE TYPE grant_type                 AS ENUM ('authorization_code','refresh_token','client_credentials','device_code');
CREATE TYPE token_type                 AS ENUM ('Bearer','DPoP');

COMMENT ON TYPE token_endpoint_auth_method IS
  'How the client authenticates at the token endpoint.';
COMMENT ON TYPE application_type IS
  'High-level client category (web/native/spa/service).';
COMMENT ON TYPE pkce_method IS
  'PKCE code challenge method ("S256" strongly recommended).';
COMMENT ON TYPE grant_type IS
  'Allowed OAuth2/OAuth2.1 grant types for a client.';
COMMENT ON TYPE token_type IS
  'Access token type: Bearer or sender-constrained DPoP.';


-- ----------------------------------------------------------------------
-- Clients
-- ----------------------------------------------------------------------

CREATE TABLE oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Soft-delete friendly unique client_id (use partial unique index below)
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  application_type application_type NOT NULL DEFAULT 'web',

  token_endpoint_auth_method token_endpoint_auth_method NOT NULL DEFAULT 'none',

  -- Store a hash/HMAC of the secret (opaque secret never stored)
  client_secret BYTEA,
  client_secret_expires_at TIMESTAMPTZ,

  redirect_uris TEXT[] NOT NULL,
  post_logout_redirect_uris TEXT[] DEFAULT '{}',

  allowed_grant_types grant_type[] NOT NULL DEFAULT ARRAY['authorization_code','refresh_token']::grant_type[],
  scopes TEXT[] NOT NULL DEFAULT '{}',

  require_pkce BOOLEAN NOT NULL DEFAULT TRUE,
  pkce_methods_allowed pkce_method[] NOT NULL DEFAULT ARRAY['S256']::pkce_method[],

  -- Origin for browser-based clients (https except loopback http)
  origin TEXT NOT NULL,

  -- If true, AS may issue Bearer (non-DPoP) tokens to this client
  bearer_allowed BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- validations
  CONSTRAINT redirect_uris_valid CHECK (are_valid_oauth_uris(redirect_uris)),
  CONSTRAINT post_logout_redirect_uris_valid CHECK (are_valid_oauth_uris_or_null(post_logout_redirect_uris)),
  CONSTRAINT scopes_token_chars CHECK (scopes_all_valid(scopes)),
  CONSTRAINT oauth_clients_redirects_nonempty_chk CHECK (cardinality(redirect_uris) >= 1),

  -- Correct column name in check (client_secret, not client_secret_hash)
  CONSTRAINT oauth_clients_secret_presence_chk CHECK (
    (token_endpoint_auth_method = 'client_secret_post' AND client_secret IS NOT NULL)
    OR
    (token_endpoint_auth_method = 'none' AND client_secret IS NULL)
  ),

  -- Public clients must require PKCE
  CONSTRAINT oauth_clients_public_pkce_chk CHECK (
    token_endpoint_auth_method <> 'none' OR require_pkce = TRUE
  ),

  -- Public clients may not use client_credentials
  CONSTRAINT oauth_clients_public_grants_chk CHECK (
    token_endpoint_auth_method <> 'none'
    OR NOT ('client_credentials' = ANY (allowed_grant_types))
  ),

  -- Origin shape: https for general, http only for loopback
  CONSTRAINT oauth_clients_origin_shape_chk CHECK (
    origin ~* '^(https://[^/\\s]+|http://((localhost(\\.localdomain)?)|127(?:\\.\\d{1,3}){3}|\\[::1\\]))$'
  )
);

-- Soft-delete aware uniqueness for client_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_oauth_clients_client_id_active
  ON oauth_clients(client_id)
  WHERE deleted_at IS NULL;
COMMENT ON INDEX uq_oauth_clients_client_id_active IS
  'Ensures client_id is unique among active (non-deleted) clients; allows reuse after soft delete.';

-- Keep an ordinary (non-unique) index to make lookups fast even for deleted rows
CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);
COMMENT ON INDEX idx_oauth_clients_client_id IS
  'Speeds lookups by client_id (active or deleted).';

CREATE TRIGGER set_timestamp_oauth_clients
BEFORE UPDATE ON oauth_clients
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

COMMENT ON TABLE oauth_clients IS
  'Registered OAuth 2.x clients (public and confidential).';
COMMENT ON COLUMN oauth_clients.id IS
  'Internal primary key (UUID).';
COMMENT ON COLUMN oauth_clients.client_id IS
  'Public identifier for the OAuth client (unique among non-deleted rows).';
COMMENT ON COLUMN oauth_clients.client_name IS
  'Human-readable display name for the client.';
COMMENT ON COLUMN oauth_clients.application_type IS
  'Client application category; affects default policy and validations.';
COMMENT ON COLUMN oauth_clients.token_endpoint_auth_method IS
  'Authentication method at token endpoint ("none" = public, "client_secret_post" = confidential).';
COMMENT ON COLUMN oauth_clients.client_secret IS
  'Hashed/HMACed secret for confidential clients; plaintext is never stored.';
COMMENT ON COLUMN oauth_clients.client_secret_expires_at IS
  'When the client secret expires (optional).';
COMMENT ON COLUMN oauth_clients.redirect_uris IS
  'Allowed redirect URIs for the Authorization Code flow.';
COMMENT ON COLUMN oauth_clients.post_logout_redirect_uris IS
  'Allowed post-logout redirect URIs for OIDC logout.';
COMMENT ON COLUMN oauth_clients.allowed_grant_types IS
  'Enabled grant types for this client.';
COMMENT ON COLUMN oauth_clients.scopes IS
  'Default/allowed scopes for this client.';
COMMENT ON COLUMN oauth_clients.require_pkce IS
  'Whether PKCE is required for this client.';
COMMENT ON COLUMN oauth_clients.pkce_methods_allowed IS
  'Allowed PKCE methods (usually only "S256").';
COMMENT ON COLUMN oauth_clients.origin IS
  'Allowed origin (https, or loopback http) for browser/SPAs.';
COMMENT ON COLUMN oauth_clients.bearer_allowed IS
  'If TRUE, AS may issue Bearer (non-DPoP) tokens to this client.';
COMMENT ON COLUMN oauth_clients.created_at IS
  'Creation timestamp.';
COMMENT ON COLUMN oauth_clients.updated_at IS
  'Last update timestamp (maintained by trigger).';
COMMENT ON COLUMN oauth_clients.deleted_at IS
  'Soft-delete timestamp; non-NULL means logically deleted.';


-- ----------------------------------------------------------------------
-- Authorization codes (pending grants)
-- ----------------------------------------------------------------------

CREATE TABLE oauth_auth_codes (
  digest BYTEA PRIMARY KEY, -- store hash of the code
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  jti UUID NOT NULL DEFAULT gen_random_uuid(),
  nonce VARCHAR(64),

  -- PKCE binding
  code_challenge TEXT,
  code_challenge_method pkce_method,

  -- Optional: bind the code to a DPoP key (JKT)
  dpop_jkt TEXT,

  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}',

  CONSTRAINT redirect_uri_valid CHECK (is_valid_oauth_uri(redirect_uri)),
  CONSTRAINT scopes_token_chars CHECK (scopes_all_valid(scopes)),
  CONSTRAINT expires_at_reasonable CHECK (expires_at <= now() + interval '15 minutes'),

  -- If code_challenge is present, method must be present (and vice versa)
  CONSTRAINT pkce_pairing_chk CHECK (
    (code_challenge IS NULL AND code_challenge_method IS NULL)
    OR
    (code_challenge IS NOT NULL AND code_challenge_method IS NOT NULL)
  ),

  -- dpop_jkt is optional; if present, it must look like a base64url thumbprint length
  CONSTRAINT dpop_jkt_shape_chk CHECK (
    dpop_jkt IS NULL OR (length(dpop_jkt) BETWEEN 43 AND 128)
  )
);

CREATE TRIGGER set_timestamp_oauth_auth_codes
BEFORE UPDATE ON oauth_auth_codes
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX idx_oauth_auth_codes_expires_at ON oauth_auth_codes (expires_at);
COMMENT ON INDEX idx_oauth_auth_codes_expires_at IS
  'Speeds eviction/lookup of expiring authorization codes.';

COMMENT ON TABLE oauth_auth_codes IS
  'Temporary authorization codes issued to clients after user consent (pending grants).';
COMMENT ON COLUMN oauth_auth_codes.digest IS
  'One-time authorization code (hashed at rest).';
COMMENT ON COLUMN oauth_auth_codes.user_id IS
  'End-user (resource owner) who authorized the client.';
COMMENT ON COLUMN oauth_auth_codes.client_id IS
  'Client receiving the authorization code.';
COMMENT ON COLUMN oauth_auth_codes.redirect_uri IS
  'Must match the value used in the authorize request.';
COMMENT ON COLUMN oauth_auth_codes.scopes IS
  'Scopes approved for this code.';
COMMENT ON COLUMN oauth_auth_codes.jti IS
  'Unique identifier for logging/trace.';
COMMENT ON COLUMN oauth_auth_codes.nonce IS
  'OIDC nonce to be echoed into the ID token.';
COMMENT ON COLUMN oauth_auth_codes.code_challenge IS
  'PKCE code_challenge derived from code_verifier.';
COMMENT ON COLUMN oauth_auth_codes.code_challenge_method IS
  'PKCE method ("S256" strongly recommended).';
COMMENT ON COLUMN oauth_auth_codes.dpop_jkt IS
  'Optional JWK thumbprint to bind this code to a DPoP key.';
COMMENT ON COLUMN oauth_auth_codes.used IS
  'TRUE once exchanged; codes are single-use.';
COMMENT ON COLUMN oauth_auth_codes.expires_at IS
  'Expiration time for the code (short-lived).';
COMMENT ON COLUMN oauth_auth_codes.created_at IS
  'Creation timestamp.';
COMMENT ON COLUMN oauth_auth_codes.updated_at IS
  'Last update timestamp (maintained by trigger).';
COMMENT ON COLUMN oauth_auth_codes.metadata IS
  'Free-form JSON for diagnostics (device/ip, etc.).';


-- ----------------------------------------------------------------------
-- Access tokens
-- ----------------------------------------------------------------------

CREATE TABLE oauth_access_tokens (
  digest BYTEA PRIMARY KEY,               -- hashed opaque token
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  audience TEXT[] NULL,
  jti UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Token type & sender constraint
  token_type token_type NOT NULL DEFAULT 'Bearer',
  dpop_jkt TEXT NULL,                     -- when token_type='DPoP', this MUST be non-null (thumbprint)

  metadata JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT audience_uris_valid CHECK (are_valid_oauth_uris_or_null(audience)),
  CONSTRAINT scopes_token_chars CHECK (scopes_all_valid(scopes)),

  -- Consistency between token_type and dpop_jkt
  CONSTRAINT access_token_dpop_consistency_chk CHECK (
    (token_type = 'Bearer' AND dpop_jkt IS NULL)
    OR
    (token_type = 'DPoP'   AND dpop_jkt IS NOT NULL AND length(dpop_jkt) BETWEEN 43 AND 128)
  )
);

CREATE TRIGGER set_timestamp_oauth_access_tokens
BEFORE UPDATE ON oauth_access_tokens
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX idx_oauth_access_tokens_expires_at ON oauth_access_tokens (expires_at);
COMMENT ON INDEX idx_oauth_access_tokens_expires_at IS
  'Speeds eviction and queries by token expiration.';

CREATE INDEX idx_oauth_access_tokens_user_client ON oauth_access_tokens (user_id, client_id);
COMMENT ON INDEX idx_oauth_access_tokens_user_client IS
  'Speeds per-user/per-client token lookups.';

COMMENT ON TABLE oauth_access_tokens IS
  'Access tokens (opaque, hashed at rest). May be Bearer or DPoP-bound.';
COMMENT ON COLUMN oauth_access_tokens.digest IS
  'Hashed token value; plaintext only exists at issuance time.';
COMMENT ON COLUMN oauth_access_tokens.user_id IS
  'Subject (end-user) on whose behalf the token was issued; NULL for client-only flows.';
COMMENT ON COLUMN oauth_access_tokens.client_id IS
  'Client that owns this token.';
COMMENT ON COLUMN oauth_access_tokens.scopes IS
  'Scopes granted to this access token.';
COMMENT ON COLUMN oauth_access_tokens.audience IS
  'Optional audience constraint (array of URIs).';
COMMENT ON COLUMN oauth_access_tokens.jti IS
  'Unique token identifier for logs/trace.';
COMMENT ON COLUMN oauth_access_tokens.token_type IS
  'Bearer (no sender constraint) or DPoP (sender-constrained).';
COMMENT ON COLUMN oauth_access_tokens.dpop_jkt IS
  'When DPoP, RFC 7638 JWK thumbprint bound to this token.';
COMMENT ON COLUMN oauth_access_tokens.metadata IS
  'Free-form JSON: device, ip, hints.';
COMMENT ON COLUMN oauth_access_tokens.expires_at IS
  'Expiration time.';
COMMENT ON COLUMN oauth_access_tokens.created_at IS
  'Creation timestamp.';
COMMENT ON COLUMN oauth_access_tokens.updated_at IS
  'Last update timestamp (maintained by trigger).';


-- ----------------------------------------------------------------------
-- Refresh tokens
-- ----------------------------------------------------------------------

CREATE TABLE oauth_refresh_tokens (
  digest BYTEA PRIMARY KEY,               -- hashed opaque refresh token (HMAC)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  audience TEXT[] NULL,
  jti UUID NOT NULL DEFAULT gen_random_uuid(),

  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  rotated_from BYTEA NULL,
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Sender-constrained refresh tokens (when using DPoP)
  dpop_jkt TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_rotated_from FOREIGN KEY (rotated_from) REFERENCES oauth_refresh_tokens(digest) ON DELETE SET NULL,
  CONSTRAINT audience_uris_valid CHECK (are_valid_oauth_uris_or_null(audience)),
  CONSTRAINT scopes_token_chars CHECK (scopes_all_valid(scopes)),

  -- If constrained, require plausible thumbprint length
  CONSTRAINT refresh_token_dpop_shape_chk CHECK (
    dpop_jkt IS NULL OR (length(dpop_jkt) BETWEEN 43 AND 128)
  )
);

CREATE TRIGGER set_timestamp_oauth_refresh_tokens
BEFORE UPDATE ON oauth_refresh_tokens
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX idx_oauth_refresh_tokens_expires_at ON oauth_refresh_tokens (expires_at);
COMMENT ON INDEX idx_oauth_refresh_tokens_expires_at IS
  'Speeds eviction and queries by refresh token expiration.';

CREATE INDEX idx_oauth_refresh_tokens_user_client ON oauth_refresh_tokens (user_id, client_id);
COMMENT ON INDEX idx_oauth_refresh_tokens_user_client IS
  'Speeds per-user/per-client refresh token lookups.';

CREATE UNIQUE INDEX idx_oauth_refresh_tokens_jti ON oauth_refresh_tokens (jti);
COMMENT ON INDEX idx_oauth_refresh_tokens_jti IS
  'Guarantees jti uniqueness across refresh tokens (useful for audit/trace).';

COMMENT ON TABLE oauth_refresh_tokens IS
  'Refresh tokens (opaque, hashed). May be sender-constrained by DPoP.';
COMMENT ON COLUMN oauth_refresh_tokens.digest IS
  'Hashed value (HMAC of raw token). Plaintext shown once to client.';
COMMENT ON COLUMN oauth_refresh_tokens.user_id IS
  'Owner (end-user) of the refresh token.';
COMMENT ON COLUMN oauth_refresh_tokens.client_id IS
  'Client the refresh token belongs to.';
COMMENT ON COLUMN oauth_refresh_tokens.scopes IS
  'Scopes associated with the refresh token (limits new ATs).';
COMMENT ON COLUMN oauth_refresh_tokens.audience IS
  'Optional audience constraint mirrored from access token.';
COMMENT ON COLUMN oauth_refresh_tokens.jti IS
  'Unique identifier of the refresh token row.';
COMMENT ON COLUMN oauth_refresh_tokens.expires_at IS
  'Expiration time for the refresh token.';
COMMENT ON COLUMN oauth_refresh_tokens.revoked IS
  'TRUE if the refresh token has been revoked.';
COMMENT ON COLUMN oauth_refresh_tokens.rotated_from IS
  'Previous refresh token digest if rotated; allows trace of rotation chain.';
COMMENT ON COLUMN oauth_refresh_tokens.metadata IS
  'Free-form JSON for diagnostics.';
COMMENT ON COLUMN oauth_refresh_tokens.dpop_jkt IS
  'If present, refresh token is sender-constrained by this JWK thumbprint.';
COMMENT ON COLUMN oauth_refresh_tokens.created_at IS
  'Creation timestamp.';
COMMENT ON COLUMN oauth_refresh_tokens.updated_at IS
  'Last update timestamp (maintained by trigger).';


-- ----------------------------------------------------------------------
-- Remembered user consent per client
-- ----------------------------------------------------------------------

CREATE TABLE oauth_user_client_scopes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id),
  CONSTRAINT scopes_token_chars CHECK (scopes_all_valid(scopes))
);

CREATE TRIGGER set_timestamp_oauth_user_client_scopes
BEFORE UPDATE ON oauth_user_client_scopes
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX idx_oauth_user_client_scopes_user ON oauth_user_client_scopes(user_id);
COMMENT ON INDEX idx_oauth_user_client_scopes_user IS
  'Speeds queries by user across remembered consents.';

CREATE INDEX idx_oauth_user_client_scopes_client ON oauth_user_client_scopes(client_id);
COMMENT ON INDEX idx_oauth_user_client_scopes_client IS
  'Speeds queries by client across remembered consents.';

COMMENT ON TABLE oauth_user_client_scopes IS
  'Stores remembered consent: which scopes a user has granted to a client.';
COMMENT ON COLUMN oauth_user_client_scopes.user_id IS
  'User who granted consent.';
COMMENT ON COLUMN oauth_user_client_scopes.client_id IS
  'Client to which consent applies.';
COMMENT ON COLUMN oauth_user_client_scopes.scopes IS
  'Scopes remembered for this user-client pair.';
COMMENT ON COLUMN oauth_user_client_scopes.granted_at IS
  'When the consent was initially granted.';
COMMENT ON COLUMN oauth_user_client_scopes.updated_at IS
  'Last time consent set was updated (maintained by trigger).';


-- ----------------------------------------------------------------------
-- DPoP replay store
-- ----------------------------------------------------------------------

CREATE TABLE oauth_dpop_proofs (
  jti_hash  BYTEA       PRIMARY KEY,    -- store SHA-256(jti)
  seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID        NULL,
  jkt       TEXT        NULL,
  htm       TEXT        NULL,
  htu       TEXT        NULL,
  iat       TIMESTAMPTZ NULL
);

CREATE INDEX idx_oauth_dpop_seen_at ON oauth_dpop_proofs (seen_at);
COMMENT ON INDEX idx_oauth_dpop_seen_at IS
  'Speeds TTL-style cleanup and time-ordered scans for DPoP replay entries.';

COMMENT ON TABLE oauth_dpop_proofs IS
  'Replay protection store for DPoP proofs. Tracks used jti values to prevent replay.';
COMMENT ON COLUMN oauth_dpop_proofs.jti_hash IS
  'SHA-256 hash of the DPoP proof''s jti claim (fixed-length key, avoids raw jti storage).';
COMMENT ON COLUMN oauth_dpop_proofs.seen_at IS
  'When this DPoP proof was first observed.';
COMMENT ON COLUMN oauth_dpop_proofs.client_id IS
  'Optional client that presented this proof (for audit/analytics).';
COMMENT ON COLUMN oauth_dpop_proofs.jkt IS
  'Thumbprint (RFC 7638) of the public key used in the DPoP proof.';
COMMENT ON COLUMN oauth_dpop_proofs.htm IS
  'HTTP method asserted in the proof (htm).';
COMMENT ON COLUMN oauth_dpop_proofs.htu IS
  'HTTP URI asserted in the proof (htu).';
COMMENT ON COLUMN oauth_dpop_proofs.iat IS
  'Issued-at timestamp from the proof (for freshness checks).';

COMMIT;
