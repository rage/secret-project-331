-- Snapshots of a course module completion's grade taken before a confirmed cheating suspicion
-- failed it, so the confirmation can be undone (Confirmed -> Dismissed) and the original grade
-- restored exactly. Confirming a cheater overwrites the completion's passed/grade to (false, 0);
-- one row is stored here per affected completion and removed (soft-deleted) when the suspicion is
-- dismissed and the grade is restored.
CREATE TABLE cheating_confirmation_grade_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_module_completion_id UUID NOT NULL REFERENCES course_module_completions (id),
  passed BOOLEAN NOT NULL,
  grade INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
-- At most one active snapshot per completion, so confirming twice cannot stack snapshots and lose
-- the true pre-confirmation values.
CREATE UNIQUE INDEX cheating_confirmation_grade_snapshots_completion_uniqueness ON cheating_confirmation_grade_snapshots (course_module_completion_id)
WHERE deleted_at IS NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON cheating_confirmation_grade_snapshots FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE cheating_confirmation_grade_snapshots IS 'Pre-confirmation grade snapshots for course module completions, allowing a confirmed cheating suspicion to be undone by restoring the completion''s original passed/grade.';
COMMENT ON COLUMN cheating_confirmation_grade_snapshots.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN cheating_confirmation_grade_snapshots.course_module_completion_id IS 'The completion whose grade was snapshotted before it was failed by a cheating confirmation.';
COMMENT ON COLUMN cheating_confirmation_grade_snapshots.passed IS 'The value of course_module_completions.passed before the cheating confirmation set it to false.';
COMMENT ON COLUMN cheating_confirmation_grade_snapshots.grade IS 'The value of course_module_completions.grade before the cheating confirmation set it to 0. May be NULL (ungraded pass/fail completion).';
COMMENT ON COLUMN cheating_confirmation_grade_snapshots.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN cheating_confirmation_grade_snapshots.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN cheating_confirmation_grade_snapshots.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted. Set when the suspicion is dismissed and the snapshot has been restored onto the completion.';
