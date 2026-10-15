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

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON oauth_device_codes FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Partial so denied/approved rows can be retained without blocking user_code reuse.
CREATE UNIQUE INDEX uq_oauth_device_codes_user_code_pending ON oauth_device_codes (user_code)
WHERE status = 'pending';
COMMENT ON INDEX uq_oauth_device_codes_user_code_pending IS 'Ensures user_code is unique among pending device authorization grants.';

CREATE INDEX idx_oauth_device_codes_expires_at ON oauth_device_codes (expires_at);
COMMENT ON INDEX idx_oauth_device_codes_expires_at IS 'Speeds eviction/lookup of expiring device codes.';

CREATE INDEX idx_oauth_device_codes_client ON oauth_device_codes (client_id);
COMMENT ON INDEX idx_oauth_device_codes_client IS 'Speeds per-client device code lookups.';

COMMENT ON TABLE oauth_device_codes IS 'Pending OAuth 2.0 Device Authorization Grants (RFC 8628). Device code stored hashed; single-use redemption enforced in application code. No deleted_at: rows are hard-deleted on redemption or expiry instead of soft-deleted.';
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

ALTER TABLE exercise_service_info
ADD COLUMN build_user_answer_endpoint_path TEXT;

COMMENT ON COLUMN exercise_service_info.build_user_answer_endpoint_path IS 'Path to the endpoint that turns host-stored uploaded files into this service''s UserAnswer. Null when the service does not support native (non-browser) clients; the exercise-services client API serves only services that declare it.';

CREATE TABLE exercise_task_submission_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  exercise_task_submission_id UUID NOT NULL REFERENCES exercise_task_submissions,
  file_upload_id UUID NOT NULL REFERENCES file_uploads,
  order_number INTEGER NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_task_submission_files FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_exercise_task_submission_files_submission ON exercise_task_submission_files (exercise_task_submission_id)
WHERE deleted_at IS NULL;
CREATE INDEX idx_exercise_task_submission_files_file ON exercise_task_submission_files (file_upload_id)
WHERE deleted_at IS NULL;

COMMENT ON TABLE exercise_task_submission_files IS 'Links a task submission to the files the client uploaded for it, so the host can serve a submission''s files back without interpreting the exercise service''s answer.';
COMMENT ON COLUMN exercise_task_submission_files.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_task_submission_files.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN exercise_task_submission_files.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_task_submission_files.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN exercise_task_submission_files.exercise_task_submission_id IS 'The task submission these files belong to.';
COMMENT ON COLUMN exercise_task_submission_files.file_upload_id IS 'The uploaded file.';
COMMENT ON COLUMN exercise_task_submission_files.order_number IS 'The order the client sent the files in, preserved so the exercise service sees them in a stable order.';

CREATE TABLE exercise_service_client_uploads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  file_upload_id UUID NOT NULL REFERENCES file_uploads,
  exercise_id UUID NOT NULL REFERENCES exercises,
  user_id UUID NOT NULL REFERENCES users
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_service_client_uploads FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE UNIQUE INDEX uq_exercise_service_client_uploads_file_upload_id ON exercise_service_client_uploads(file_upload_id, deleted_at) NULLS NOT DISTINCT;
CREATE INDEX idx_exercise_service_client_uploads_lookup ON exercise_service_client_uploads (exercise_id, user_id)
WHERE deleted_at IS NULL;
CREATE INDEX idx_exercise_service_client_uploads_created ON exercise_service_client_uploads (created_at)
WHERE deleted_at IS NULL;

COMMENT ON TABLE exercise_service_client_uploads IS 'Files uploaded through the exercise-services client API, bound to the exercise and user they were uploaded for. Membership in this table is what scopes the exercise-service-client-upload reaper: the reaper must never consider any other file_uploads row. file_uploads is shared with CMS media, organization images, certificates and iframe-uploaded answer files whose only references live inside opaque data_json answer blobs the host cannot parse, so a reaper widened to file_uploads would silently delete real user data. This narrow scope is a load-bearing safety property, not an optimization.';
COMMENT ON COLUMN exercise_service_client_uploads.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_service_client_uploads.created_at IS 'Timestamp when the record was created. The reaper''s retention window is measured from this.';
COMMENT ON COLUMN exercise_service_client_uploads.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_service_client_uploads.deleted_at IS 'Timestamp when the record was deleted. Set by the reaper, and kept rather than hard-deleted so a submit naming a reaped file can be answered with upload_expired instead of unknown_upload.';
COMMENT ON COLUMN exercise_service_client_uploads.file_upload_id IS 'The uploaded file.';
COMMENT ON COLUMN exercise_service_client_uploads.exercise_id IS 'The exercise the file was uploaded for. A submit naming this file for any other exercise is rejected.';
COMMENT ON COLUMN exercise_service_client_uploads.user_id IS 'The user who uploaded the file. A submit by any other user is rejected.';

ALTER TABLE exercise_service_info
ADD COLUMN answer_files_endpoint_path TEXT;

COMMENT ON COLUMN exercise_service_info.answer_files_endpoint_path IS 'Path to the endpoint that enumerates the files one of this service''s answers consists of. The host calls it when a submission names no host-stored uploads of its own -- an answer made in the service''s in-browser IFrame -- so that such a submission is recorded in exercise_task_submission_files and is downloadable exactly like one made by a native client. Null when the service cannot enumerate an answer''s files, which leaves its IFrame-made submissions with no files to download.';

