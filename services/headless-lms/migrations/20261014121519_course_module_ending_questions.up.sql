CREATE TABLE course_module_ending_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  course_module_id UUID NOT NULL REFERENCES course_modules(id)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_module_ending_questions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_module_ending_questions IS 'An example';
COMMENT ON COLUMN course_module_ending_questions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_module_ending_questions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_module_ending_questions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_module_ending_questions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TABLE course_module_ending_questions_answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  question_id UUID NOT NULL REFERENCES course_module_ending_questions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  answer_value VARCHAR(255) NOT NULL
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_module_ending_questions_answers FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_module_ending_questions_answers IS 'An example';
COMMENT ON COLUMN course_module_ending_questions_answers.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_module_ending_questions_answers.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_module_ending_questions_answers.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_module_ending_questions_answers.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
