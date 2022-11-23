-- Add up migration script here
ALTER TABLE course_modules
ADD automatic_completion_requires_exam BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN course_modules.automatic_completion_requires_exam IS 'If automatic completion is enabled, whether an exam is also required or not.';
-- Update course_exams table
ALTER TABLE course_exams
ADD created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD deleted_at TIMESTAMP WITH TIME ZONE;
COMMENT ON COLUMN course_exams.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_exams.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_exams.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
