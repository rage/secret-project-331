CREATE TABLE course_model_solution_settings (
  course_id UUID PRIMARY KEY REFERENCES courses,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reveal_after_deadline BOOLEAN NOT NULL DEFAULT FALSE,
  reveal_at TIMESTAMP WITH TIME ZONE
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_model_solution_settings FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_model_solution_settings IS 'When a course shows its exercises'' model solutions to students who have neither solved the exercise nor used up its tries. A course without a row reveals them only to those students.';
COMMENT ON COLUMN course_model_solution_settings.course_id IS 'The course the settings are for.';
COMMENT ON COLUMN course_model_solution_settings.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_model_solution_settings.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_model_solution_settings.reveal_after_deadline IS 'Whether an exercise''s model solution is shown to every student once the exercise''s deadline (its own, else its chapter''s) has passed.';
COMMENT ON COLUMN course_model_solution_settings.reveal_at IS 'From when every exercise''s model solution is shown to every student. NULL for never.';
