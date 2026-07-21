-- Provision the OAuth clients the device-flow auth migration needs:
--   1) tmc-cli-vscode           - public native client for the TMC CLI / VSCode extension login
--   2) tmc-server-introspection - confidential client tmc-server uses to introspect our tokens
--
-- Idempotent: every insert is guarded by NOT EXISTS against the active
-- (non-soft-deleted) client_id, so re-running the migration inserts nothing new.

-- 1) tmc-cli-vscode
--    Public, Native, token_endpoint_auth_method = none. Used for the RFC 8628 device
--    authorization grant. Issues Bearer access/refresh tokens carrying the
--    exercise-services scope. redirect_uris is a placeholder URN because the column is
--    NOT NULL (cardinality >= 1) but the device flow uses no redirect. require_pkce is
--    forced TRUE for public clients by the oauth_clients_public_pkce_chk CHECK (a no-op
--    for the device grant).
INSERT INTO oauth_clients (
  client_id,
  client_name,
  application_type,
  token_endpoint_auth_method,
  client_secret,
  redirect_uris,
  allowed_grant_types,
  scopes,
  require_pkce,
  pkce_methods_allowed,
  allowed_origins,
  bearer_allowed
)
SELECT
  'tmc-cli-vscode',
  'TMC CLI / VSCode extension',
  'native',
  'none',
  NULL,
  ARRAY['urn:ietf:wg:oauth:2.0:oob'],
  ARRAY['device_code', 'refresh_token']::grant_type[],
  ARRAY['exercise-services'],
  TRUE,
  ARRAY['S256']::pkce_method[],
  NULL,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM oauth_clients
  WHERE client_id = 'tmc-cli-vscode' AND deleted_at IS NULL
);

-- 2) tmc-server-introspection
--    Confidential (client_secret_post) client that tmc-server presents when calling the
--    RFC 7662 introspection endpoint. It receives no tokens, so it has no grants and needs
--    no scopes; bearer_allowed is FALSE. redirect_uris is a placeholder URN only to satisfy
--    the NOT NULL / non-empty constraint.
--
--    !!!  OPERATIONS: ROTATE THIS CLIENT SECRET BEFORE ENABLING tmc-server INTROSPECTION  !!!
--
--    The client_secret below is a NON-FUNCTIONAL placeholder: 32 zero bytes. The stored value
--    must be HMAC-SHA-256(oauth_token_hmac_key, <plaintext secret>), and this migration cannot
--    compute it because oauth_token_hmac_key is environment-specific and unavailable at
--    migration time. Until an operator installs the real digest, NO caller can authenticate as
--    this client (fail-safe: introspection simply returns active:false / 401). To rotate:
--      1. Pick a strong random secret S.
--      2. Compute D = HMAC-SHA-256(<this deployment's oauth_token_hmac_key>, S) (32 bytes).
--      3. UPDATE oauth_clients SET client_secret = D
--           WHERE client_id = 'tmc-server-introspection' AND deleted_at IS NULL;
--      4. Configure tmc-server's courses_mooc_fi_introspection_client_secret with S.
INSERT INTO oauth_clients (
  client_id,
  client_name,
  application_type,
  token_endpoint_auth_method,
  client_secret,
  redirect_uris,
  allowed_grant_types,
  scopes,
  require_pkce,
  pkce_methods_allowed,
  allowed_origins,
  bearer_allowed
)
SELECT
  'tmc-server-introspection',
  'tmc-server token introspection',
  'service',
  'client_secret_post',
  decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
  ARRAY['urn:ietf:wg:oauth:2.0:oob'],
  ARRAY[]::grant_type[],
  ARRAY[]::text[],
  FALSE,
  ARRAY['S256']::pkce_method[],
  NULL,
  FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM oauth_clients
  WHERE client_id = 'tmc-server-introspection' AND deleted_at IS NULL
);
