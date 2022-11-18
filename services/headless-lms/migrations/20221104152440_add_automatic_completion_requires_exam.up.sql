-- Add up migration script here
ALTER TABLE course_modules
ADD automatic_completion_exam_points_treshold INTEGER,
  DROP CONSTRAINT course_module_automatic_completion_validity,
  ADD CONSTRAINT course_module_automatic_completion_validity CHECK (
    automatic_completion <> (
      COALESCE(
        automatic_completion_number_of_exercises_attempted_treshold,
        automatic_completion_number_of_points_treshold,
        automatic_completion_exam_points_treshold
      ) IS NULL
    )
  );
COMMENT ON COLUMN course_modules.automatic_completion_exam_points_treshold IS 'If not null, the amount of points required from an exam that is associated with the course module.';
-- Update course_exams table
ALTER TABLE course_exams
ADD created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD deleted_at TIMESTAMP WITH TIME ZONE;
COMMENT ON COLUMN course_exams.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_exams.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_exams.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
