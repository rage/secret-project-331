CREATE TYPE end_question_type AS ENUM ('free-text', 'numeric-rating');

CREATE TABLE course_module_ending_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  course_module_id UUID NOT NULL REFERENCES course_modules(id),
  question_serial_number INTEGER NOT NULL,
  question_text VARCHAR(255) NOT NULL,
  question_type end_question_type NOT NULL,
  rating_options_n INTEGER,
  rating_labels TEXT ARRAY,
  CONSTRAINT question_type_rating_correct_columns CHECK (
    question_type = 'numeric-rating'::end_question_type
    AND rating_options_n IS NOT NULL
  ),
  UNIQUE (course_module_id, question_serial_number)
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
  answer_text_value VARCHAR(255),
  answer_numeric_value INTEGER,
  CONSTRAINT either_numeric_or_text_answer_not_both CHECK (
    (
      answer_text_value IS NOT NULL
      AND answer_numeric_value IS NULL
    )
    OR (
      answer_text_value IS NULL
      AND answer_numeric_value IS NOT NULL
    )
  )
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_module_ending_questions_answers FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_module_ending_questions_answers IS 'An example';
COMMENT ON COLUMN course_module_ending_questions_answers.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_module_ending_questions_answers.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_module_ending_questions_answers.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_module_ending_questions_answers.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

ALTER TABLE course_modules
ADD COLUMN ending_questions_required BOOLEAN NOT NULL DEFAULT FALSE;
