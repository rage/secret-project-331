CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION is_valid_oauth_uri(uri TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF uri IS NULL OR trim(uri) = '' OR uri ~ '\s' OR uri LIKE '%#%' THEN
    RETURN FALSE;
  END IF;

  IF uri ~* '^https://[^\s]+$' THEN
    RETURN TRUE;
  ELSIF uri ~* '^http://((localhost(\.localdomain)?)|127(?:\.\d{1,3}){3}|\[::1\])(?::\d{1,5})?(?:/[^\s]*)?$' THEN
    RETURN TRUE;
  ELSIF uri ~* '^(?!https?://)[A-Za-z][A-Za-z0-9+.\-]*:(//)?[^\s]+$' THEN
    RETURN TRUE;
  ELSIF uri ~* '^urn:[A-Za-z0-9][A-Za-z0-9\-]{0,31}:[^\s]+$' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

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

CREATE TABLE oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT UNIQUE NOT NULL,
  client_secret BYTEA NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  grant_types TEXT[] NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  origin TEXT NOT NULL,
  bearer_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT redirect_uris_valid CHECK (are_valid_oauth_uris(redirect_uris)),
  CONSTRAINT scopes_token_chars CHECK (scopes_all_valid(scopes))
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON oauth_clients
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TABLE oauth_auth_codes (
  digest BYTEA PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  jti UUID NOT NULL DEFAULT gen_random_uuid(),
  nonce VARCHAR(64),
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT redirect_uri_valid CHECK (is_valid_oauth_uri(redirect_uri)),
  CONSTRAINT scopes_token_chars CHECK (scopes_all_valid(scopes))
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON oauth_auth_codes
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX idx_oauth_auth_codes_expires_at ON oauth_auth_codes (expires_at);

CREATE TABLE oauth_access_tokens (
  digest BYTEA PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  audience TEXT[] NULL,
  jti UUID NOT NULL DEFAULT gen_random_uuid(),
  dpop_jkt TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audience_uris_valid CHECK (are_valid_oauth_uris_or_null(audience)),
  CONSTRAINT scopes_token_chars CHECK (scopes_all_valid(scopes))
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON oauth_access_tokens
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX idx_oauth_access_tokens_expires_at ON oauth_access_tokens (expires_at);
CREATE INDEX idx_oauth_access_tokens_user_client ON oauth_access_tokens (user_id, client_id);

CREATE TABLE oauth_refresh_tokens (
  digest BYTEA PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  audience TEXT[] NULL,
  jti UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  rotated_from BYTEA NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  dpop_jkt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_rotated_from FOREIGN KEY (rotated_from) REFERENCES oauth_refresh_tokens(digest) ON DELETE SET NULL,
  CONSTRAINT audience_uris_valid CHECK (are_valid_oauth_uris_or_null(audience)),
  CONSTRAINT scopes_token_chars CHECK (scopes_all_valid(scopes))
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON oauth_refresh_tokens
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX idx_oauth_refresh_tokens_expires_at ON oauth_refresh_tokens (expires_at);
CREATE INDEX idx_oauth_refresh_tokens_user_client ON oauth_refresh_tokens (user_id, client_id);
CREATE UNIQUE INDEX idx_oauth_refresh_tokens_jti ON oauth_refresh_tokens (jti);

CREATE TABLE oauth_user_client_scopes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id),
  CONSTRAINT scopes_token_chars CHECK (scopes_all_valid(scopes))
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON oauth_user_client_scopes
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX idx_oauth_user_client_scopes_user ON oauth_user_client_scopes(user_id);
CREATE INDEX idx_oauth_user_client_scopes_client ON oauth_user_client_scopes(client_id);

CREATE TABLE oauth_dpop_proofs (
  jti_hash  BYTEA       PRIMARY KEY,
  seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID        NULL,
  jkt       TEXT        NULL,
  htm       TEXT        NULL,
  htu       TEXT        NULL,
  iat       TIMESTAMPTZ NULL
);

CREATE INDEX idx_oauth_dpop_seen_at ON oauth_dpop_proofs (seen_at);
