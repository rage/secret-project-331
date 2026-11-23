-- The generated name is truncated; membership.rs defers the constraint by the fixed name.
DO $$
DECLARE fk_name TEXT;
BEGIN
SELECT c.conname INTO STRICT fk_name
FROM pg_constraint c
WHERE c.conrelid = 'user_course_settings'::regclass
  AND c.confrelid = 'courses'::regclass
  AND c.contype = 'f'
  AND (
    SELECT array_agg(a.attname::TEXT ORDER BY a.attname)
    FROM pg_attribute a
    WHERE a.attrelid = c.conrelid
      AND a.attnum = ANY(c.conkey)
  ) = ARRAY ['course_language_group_id', 'current_course_id'];
EXECUTE format(
  'ALTER TABLE user_course_settings RENAME CONSTRAINT %I TO user_course_settings_current_course_group_fkey',
  fk_name
);
END $$;
ALTER TABLE user_course_settings
ALTER CONSTRAINT user_course_settings_current_course_group_fkey DEFERRABLE INITIALLY IMMEDIATE;
COMMENT ON CONSTRAINT user_course_settings_current_course_group_fkey ON user_course_settings IS 'Keeps the settings in the course language group of their current course. Deferrable because joining or splitting language versions moves a course and its students'' settings to another group in one transaction (SET CONSTRAINTS ... DEFERRED).';

CREATE TYPE language_version_operation AS ENUM (
  'join',
  'split',
  'link_pages',
  'unlink_pages',
  'link_exercises',
  'unlink_exercises',
  'remove_leftover_links',
  'create_counterpart'
);

CREATE TABLE language_version_problem_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_language_group_id UUID NOT NULL REFERENCES course_language_groups(id),
  problem_key VARCHAR(1024) NOT NULL,
  fingerprint VARCHAR(255) NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX language_version_problem_dismissals_live_key ON language_version_problem_dismissals (course_language_group_id, problem_key)
WHERE deleted_at IS NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON language_version_problem_dismissals FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE language_version_problem_dismissals IS 'Problems of a course language group that a teacher marked as intended in the language-version repair tool. A dismissal hides the problem only while its fingerprint matches, so the problem comes back when the rows behind it change.';
COMMENT ON COLUMN language_version_problem_dismissals.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN language_version_problem_dismissals.course_language_group_id IS 'The language versions the problem was found in.';
COMMENT ON COLUMN language_version_problem_dismissals.problem_key IS 'Stable identity of the problem across checks, e.g. missing_page_counterpart:<course id>:<counterpart course id>.';
COMMENT ON COLUMN language_version_problem_dismissals.fingerprint IS 'Hash of the rows behind the problem when it was dismissed.';
COMMENT ON COLUMN language_version_problem_dismissals.created_by IS 'The teacher who marked the problem as intended.';
COMMENT ON COLUMN language_version_problem_dismissals.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN language_version_problem_dismissals.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN language_version_problem_dismissals.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted. Set when the teacher brings the problem back.';

CREATE TABLE language_version_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  operation language_version_operation NOT NULL,
  course_language_group_id UUID NOT NULL REFERENCES course_language_groups(id),
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX language_version_operation_logs_course_language_group_id ON language_version_operation_logs (course_language_group_id);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON language_version_operation_logs FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE language_version_operation_logs IS 'Changes made with the language-version repair tool, with enough detail to repair a mistake by hand. There is no undo.';
COMMENT ON COLUMN language_version_operation_logs.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN language_version_operation_logs.actor_user_id IS 'The user who made the change.';
COMMENT ON COLUMN language_version_operation_logs.operation IS 'What the change was.';
COMMENT ON COLUMN language_version_operation_logs.course_language_group_id IS 'The language versions the change was made in; for a join, the group the course joined; for a split, the group the course left.';
COMMENT ON COLUMN language_version_operation_logs.payload IS 'The changed rows: previous page or exercise language groups of linked or unlinked items, moved courses, and full copies of rows the change deleted or merged.';
COMMENT ON COLUMN language_version_operation_logs.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN language_version_operation_logs.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN language_version_operation_logs.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE INDEX IF NOT EXISTS exercises_exercise_language_group_id_idx ON exercises (exercise_language_group_id);
