CREATE TYPE error_source AS ENUM ('backend', 'frontend');

CREATE TABLE error_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  error_source error_source NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  occurrence_count INT NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (fingerprint)
);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON error_groups FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_error_groups_source_last_seen ON error_groups (error_source, last_seen_at DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE error_groups IS 'One row per unique error type, identified by fingerprint. Tracks aggregated stats across all occurrences.';
COMMENT ON COLUMN error_groups.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN error_groups.fingerprint IS 'SHA-256 of (error_source, message, stack_trace). Uniquely identifies this error type.';
COMMENT ON COLUMN error_groups.error_source IS 'Whether the error originated in the backend or frontend.';
COMMENT ON COLUMN error_groups.message IS 'The error message.';
COMMENT ON COLUMN error_groups.stack_trace IS 'Stack trace of the error, if available.';
COMMENT ON COLUMN error_groups.occurrence_count IS 'Denormalized count of error_occurrences rows. Kept in sync on insert and expiry cleanup.';
COMMENT ON COLUMN error_groups.last_seen_at IS 'Denormalized timestamp of the most recent occurrence. Updated on each new occurrence.';
COMMENT ON COLUMN error_groups.resolved_at IS 'Set when the error is acknowledged as fixed. Null means unresolved.';
COMMENT ON COLUMN error_groups.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN error_groups.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN error_groups.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TABLE error_occurrences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  error_group_id UUID NOT NULL REFERENCES error_groups(id),
  user_id UUID REFERENCES users(id),
  path TEXT,
  app_version TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON error_occurrences FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_error_occurrences_group ON error_occurrences (error_group_id, created_at DESC);
CREATE INDEX idx_error_occurrences_user ON error_occurrences (user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE error_occurrences IS 'One row per individual error report. References error_groups for deduplication. Rows expire after 2 months.';
COMMENT ON COLUMN error_occurrences.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN error_occurrences.error_group_id IS 'The error group this occurrence belongs to.';
COMMENT ON COLUMN error_occurrences.user_id IS 'The user who experienced this occurrence, if known.';
COMMENT ON COLUMN error_occurrences.path IS 'Page URL (frontend) or HTTP route (backend) where this occurrence happened.';
COMMENT ON COLUMN error_occurrences.app_version IS 'Frontend bundle version or backend git SHA at the time of this occurrence.';
COMMENT ON COLUMN error_occurrences.details IS 'Freeform JSON for any additional per-occurrence context.';
COMMENT ON COLUMN error_occurrences.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN error_occurrences.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN error_occurrences.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
