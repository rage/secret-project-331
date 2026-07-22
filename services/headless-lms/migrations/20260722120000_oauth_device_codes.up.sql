/* ======================================================================
 OAuth 2.0 Device Authorization Grant (RFC 8628) — device codes
 ----------------------------------------------------------------------
 Adds `oauth_device_codes`, the pending-grant table for the Device
 Authorization Grant. It mirrors `oauth_auth_codes`:
 - the secret (`device_code`) is stored only as an HMAC digest (PK);
 - a short-lived pending grant with a small set of audit columns;
 - single-use redemption is enforced in application code.

 Device-flow specifics (RFC 8628):
 - `user_code` is the human-typed code shown on the device; it must be
   unique among *pending* rows (a partial unique index) so the
   verification page can resolve it unambiguously. Denied/approved rows
   no longer participate in that uniqueness.
 - `status` tracks the approval lifecycle (pending → approved | denied).
 - `interval_seconds` is the minimum polling interval advertised to the
   client; `last_polled_at` records the previous poll so the token
   endpoint can emit `slow_down` when a client polls too fast.
 - `expires_at` defaults to 15 minutes and is capped at 30 minutes by a
   CHECK, mirroring the short-lived nature of `oauth_auth_codes`.

 Purging/TTL: as with the other oauth tables, expiry cleanup is handled
 explicitly in application code, not via DB triggers/schedules.
 ====================================================================== */
BEGIN;

-- ----------------------------------------------------------------------
-- Enum
-- ----------------------------------------------------------------------
CREATE TYPE device_code_status AS ENUM ('pending', 'approved', 'denied');
COMMENT ON TYPE device_code_status IS 'Approval lifecycle of an OAuth device authorization grant.';

-- ----------------------------------------------------------------------
-- Device codes (pending grants)
-- ----------------------------------------------------------------------
CREATE TABLE oauth_device_codes (
  device_code_digest BYTEA PRIMARY KEY,
  -- store hash (HMAC) of the device_code; plaintext is shown to the client once
  user_code TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  -- NULL until the user approves the grant on the verification page
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  scopes TEXT [] NOT NULL DEFAULT '{}',
  status device_code_status NOT NULL DEFAULT 'pending',
  jti UUID NOT NULL DEFAULT gen_random_uuid(),
  -- Minimum polling interval (seconds) advertised to the client
  interval_seconds INTEGER NOT NULL DEFAULT 5,
  -- Previous poll time, used to detect too-fast polling (=> slow_down)
  last_polled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT scopes_token_chars CHECK (scopes_all_valid(scopes)),
  -- Device codes are short-lived; never allow more than 30 minutes of life.
  CONSTRAINT device_code_expiry_ceiling CHECK (expires_at <= created_at + INTERVAL '30 minutes'),
  CONSTRAINT device_code_interval_positive CHECK (interval_seconds > 0),
  -- Crockford base32 user code (no I, L, O, U), formatted XXXX-XXXX
  CONSTRAINT device_code_user_code_shape CHECK (
    user_code ~ '^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'
  ),
  -- Once approved, a user must be attached.
  CONSTRAINT device_code_approved_has_user CHECK (
    status <> 'approved'
    OR user_id IS NOT NULL
  )
);

CREATE TRIGGER set_timestamp_oauth_device_codes BEFORE
UPDATE ON oauth_device_codes FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- At most one *pending* grant per user_code (denied/approved rows are excluded).
CREATE UNIQUE INDEX uq_oauth_device_codes_user_code_pending ON oauth_device_codes (user_code)
WHERE status = 'pending';
COMMENT ON INDEX uq_oauth_device_codes_user_code_pending IS 'Ensures user_code is unique among pending device authorization grants.';

CREATE INDEX idx_oauth_device_codes_expires_at ON oauth_device_codes (expires_at);
COMMENT ON INDEX idx_oauth_device_codes_expires_at IS 'Speeds eviction/lookup of expiring device codes.';

CREATE INDEX idx_oauth_device_codes_client ON oauth_device_codes (client_id);
COMMENT ON INDEX idx_oauth_device_codes_client IS 'Speeds per-client device code lookups.';

COMMENT ON TABLE oauth_device_codes IS 'Pending OAuth 2.0 Device Authorization Grants (RFC 8628). Device code stored hashed; single-use redemption enforced in application code.';
COMMENT ON COLUMN oauth_device_codes.device_code_digest IS 'HMAC digest of the one-time device_code (hashed at rest).';
COMMENT ON COLUMN oauth_device_codes.user_code IS 'Human-typed code shown on the device (Crockford base32, XXXX-XXXX). Unique among pending rows.';
COMMENT ON COLUMN oauth_device_codes.client_id IS 'Client that initiated the device authorization request.';
COMMENT ON COLUMN oauth_device_codes.user_id IS 'End-user who approved the grant; NULL until approved.';
COMMENT ON COLUMN oauth_device_codes.scopes IS 'Scopes requested for this device authorization.';
COMMENT ON COLUMN oauth_device_codes.status IS 'Approval lifecycle: pending, approved, or denied.';
COMMENT ON COLUMN oauth_device_codes.jti IS 'Unique identifier for logging/trace.';
COMMENT ON COLUMN oauth_device_codes.interval_seconds IS 'Minimum polling interval (seconds) advertised to the client.';
COMMENT ON COLUMN oauth_device_codes.last_polled_at IS 'Timestamp of the previous poll; used to detect too-fast polling (slow_down).';
COMMENT ON COLUMN oauth_device_codes.expires_at IS 'Expiration time for the device code (short-lived; capped at 30 minutes).';
COMMENT ON COLUMN oauth_device_codes.created_at IS 'Creation timestamp.';
COMMENT ON COLUMN oauth_device_codes.updated_at IS 'Last update timestamp (maintained by trigger).';
COMMENT ON COLUMN oauth_device_codes.metadata IS 'Free-form JSON for diagnostics (device/ip, etc.).';

COMMIT;
