-- =============================================================================
-- Suspected-cheaters review: replace `is_archived` boolean with a status enum
-- =============================================================================
-- The old boolean read backwards and conflated two states: a newly auto-flagged student
-- awaiting review and a teacher-confirmed cheater were BOTH is_archived = FALSE, while
-- is_archived = TRUE actually meant "dismissed as a false alarm".
--
-- Data mapping:
--   is_archived = TRUE  -> 'dismissed'  (teacher decided it was a false alarm)
--   is_archived = FALSE -> 'flagged'    (awaiting review)
-- NOTE: existing rows cannot distinguish an already-confirmed cheater from a
-- not-yet-reviewed one (both were FALSE), so all such rows become 'flagged'. The
-- 'confirmed-cheating' state only arises for decisions made after this migration.
CREATE TYPE suspected_cheater_status AS ENUM (
  'flagged',
  'confirmed-cheating',
  'dismissed'
);

ALTER TABLE suspected_cheaters
ADD COLUMN status suspected_cheater_status NOT NULL DEFAULT 'flagged';

COMMENT ON COLUMN suspected_cheaters.status IS 'Review state of a suspected cheater: flagged (auto-flagged, awaiting teacher review), confirmed-cheating (teacher confirmed cheating; the student is failed), or dismissed (teacher decided it was a false alarm).';

UPDATE suspected_cheaters
SET status = 'dismissed'
WHERE is_archived = TRUE;

ALTER TABLE suspected_cheaters DROP COLUMN is_archived;

-- =============================================================================
-- AI-usage notice acknowledgements
-- =============================================================================
CREATE TABLE user_ai_usage_notice_acknowledgements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX user_ai_usage_notice_ack_user_course_uniqueness ON user_ai_usage_notice_acknowledgements (user_id, course_id)
WHERE deleted_at IS NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_ai_usage_notice_acknowledgements FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE user_ai_usage_notice_acknowledgements IS 'Records that a user has read and agreed to the AI-usage / academic-integrity notice for a given course. One acknowledgement per user per course.';
COMMENT ON COLUMN user_ai_usage_notice_acknowledgements.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN user_ai_usage_notice_acknowledgements.user_id IS 'The user who acknowledged the notice.';
COMMENT ON COLUMN user_ai_usage_notice_acknowledgements.course_id IS 'The course the acknowledgement applies to.';
COMMENT ON COLUMN user_ai_usage_notice_acknowledgements.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN user_ai_usage_notice_acknowledgements.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_ai_usage_notice_acknowledgements.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

-- =============================================================================
-- Per-course toggle for suspected-cheater detection
-- =============================================================================
ALTER TABLE courses
ADD COLUMN cheater_detection_enabled BOOLEAN NOT NULL DEFAULT TRUE;
COMMENT ON COLUMN courses.cheater_detection_enabled IS 'If true, the suspected-cheaters detection runs for this course: completions faster than the configured (or default 3-hour) threshold are flagged for teacher review. Disabled for seeded/system-test courses.';
