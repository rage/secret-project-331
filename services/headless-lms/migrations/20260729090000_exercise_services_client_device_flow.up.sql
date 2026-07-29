CREATE TABLE exercise_slide_submission_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_slide_submission_id UUID NOT NULL REFERENCES exercise_slide_submissions(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_exercise_slide_submission_shares_submission_id ON exercise_slide_submission_shares(exercise_slide_submission_id);
CREATE INDEX idx_exercise_slide_submission_shares_created_by ON exercise_slide_submission_shares(created_by);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_slide_submission_shares FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE exercise_slide_submission_shares IS 'Shareable-link tokens for existing exercise slide submissions (the share capability behind the exercise-services client share endpoint).';
COMMENT ON COLUMN exercise_slide_submission_shares.id IS 'Unique, unguessable token; forms part of the shareable submission URL.';
COMMENT ON COLUMN exercise_slide_submission_shares.exercise_slide_submission_id IS 'The submission this share links to.';
COMMENT ON COLUMN exercise_slide_submission_shares.created_by IS 'User who created the share.';
COMMENT ON COLUMN exercise_slide_submission_shares.created_at IS 'Timestamp when the share was created.';
COMMENT ON COLUMN exercise_slide_submission_shares.updated_at IS 'Timestamp when the share was last updated by trigger_set_timestamp.';
COMMENT ON COLUMN exercise_slide_submission_shares.deleted_at IS 'Soft delete timestamp. Null means active (revoked shares are soft-deleted).';

CREATE TYPE device_code_status AS ENUM ('pending', 'approved', 'denied');
COMMENT ON TYPE device_code_status IS 'Approval lifecycle of an OAuth device authorization grant.';

CREATE TABLE oauth_device_codes (
  device_code_digest BYTEA PRIMARY KEY,
  user_code TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  scopes TEXT [] NOT NULL DEFAULT '{}',
  status device_code_status NOT NULL DEFAULT 'pending',
  jti UUID NOT NULL DEFAULT gen_random_uuid(),
  interval_seconds INTEGER NOT NULL DEFAULT 5,
  last_polled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT scopes_token_chars CHECK (scopes_all_valid(scopes)),
  CONSTRAINT device_code_expiry_ceiling CHECK (expires_at <= created_at + INTERVAL '30 minutes'),
  CONSTRAINT device_code_interval_positive CHECK (interval_seconds > 0),
  -- Crockford base32 (no I, L, O, U), formatted XXXX-XXXX.
  CONSTRAINT device_code_user_code_shape CHECK (
    user_code ~ '^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'
  ),
  CONSTRAINT device_code_approved_has_user CHECK (
    status <> 'approved'
    OR user_id IS NOT NULL
  )
);

CREATE TRIGGER set_timestamp_oauth_device_codes BEFORE
UPDATE ON oauth_device_codes FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Partial so denied/approved rows can be retained without blocking user_code reuse.
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
