CREATE TYPE error_source AS ENUM ('backend', 'frontend');

CREATE TABLE error_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  service TEXT NOT NULL,
  error_identifier TEXT NOT NULL,
  error_source error_source NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  occurrence_count INT NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE NULLS NOT DISTINCT (service, error_identifier, deleted_at)
);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON error_groups FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_error_groups_service_source_last_seen ON error_groups (service, error_source, last_seen_at DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE error_groups IS 'One row per unique error type, identified by (service, error_identifier). Tracks aggregated stats across all occurrences.';
COMMENT ON COLUMN error_groups.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN error_groups.service IS 'Service slug that reported the error (e.g. main-frontend, cms, quizzes, tmc, example-exercise, headless-lms).';
COMMENT ON COLUMN error_groups.error_identifier IS 'BLAKE3 hex of (service, error_source, normalized_message, normalized_stack_trace) separated by null bytes. Uniquely identifies this error type within a service.';
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
  error_group_id UUID NOT NULL REFERENCES error_groups(id) ON DELETE RESTRICT,
  service TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  path TEXT,
  app_version TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON error_occurrences FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_error_occurrences_group ON error_occurrences (error_group_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_error_occurrences_user ON error_occurrences (user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION sync_error_occurrence_service()
RETURNS TRIGGER AS $$
BEGIN
  SELECT service INTO NEW.service FROM error_groups WHERE id = NEW.error_group_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_error_occurrence_service_trigger
BEFORE INSERT OR UPDATE OF error_group_id ON error_occurrences
FOR EACH ROW
EXECUTE FUNCTION sync_error_occurrence_service();

COMMENT ON TABLE error_occurrences IS 'One row per individual error report. References error_groups for deduplication. Rows expire after 2 months.';
COMMENT ON COLUMN error_occurrences.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN error_occurrences.error_group_id IS 'The error group this occurrence belongs to.';
COMMENT ON COLUMN error_occurrences.service IS 'Service slug that reported the error. Duplicated from error_groups for convenience.';
COMMENT ON COLUMN error_occurrences.user_id IS 'The user who experienced this occurrence, if known.';
COMMENT ON COLUMN error_occurrences.path IS 'Page URL (frontend) or HTTP route (backend) where this occurrence happened.';
COMMENT ON COLUMN error_occurrences.app_version IS 'Frontend bundle version or backend git SHA at the time of this occurrence.';
COMMENT ON COLUMN error_occurrences.details IS 'Freeform JSON for any additional per-occurrence context.';
COMMENT ON COLUMN error_occurrences.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN error_occurrences.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN error_occurrences.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
