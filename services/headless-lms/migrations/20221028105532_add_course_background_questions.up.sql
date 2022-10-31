CREATE TYPE course_background_question_type AS ENUM ('checkbox', 'text');
CREATE TABLE course_background_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_instance_id UUID REFERENCES course_instances,
  course_id UUID REFERENCES courses NOT NULL,
  question_text VARCHAR(512) NOT NULL,
  question_type course_background_question_type NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_background_questions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_background_questions IS 'A teacher-defined extra question that gets asked from the students when they start a course. The question can be either for all students in a course or it can be only for the students that selected a specific course instance.';
COMMENT ON COLUMN course_background_questions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_background_questions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_background_questions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_background_questions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_background_questions.course_instance_id IS 'If set, this question will be asked only from the students that selected this specific course instance.';
COMMENT ON COLUMN course_background_questions.course_id IS 'The course this question applies to. If course_instance_id is null, this question will be asked from all students regardless which course instance they selected.';
-- answers
CREATE TABLE course_background_question_answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_background_question_id UUID NOT NULL REFERENCES course_background_questions,
  user_id UUID NOT NULL REFERENCES users,
  answer_value VARCHAR(512)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_background_question_answers FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE UNIQUE INDEX unique_background_question_answers ON course_background_question_answers (course_background_question_id, user_id)
WHERE deleted_at IS NULL;
COMMENT ON TABLE course_background_question_answers IS 'An answer to a background question. A single user can have only one answer to one question.';
COMMENT ON COLUMN course_background_question_answers.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_background_question_answers.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_background_question_answers.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_background_question_answers.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_background_question_answers.course_background_question_id IS 'The question being answered.';
COMMENT ON COLUMN course_background_question_answers.user_id IS 'The user who answered this question.';
COMMENT ON COLUMN course_background_question_answers.answer_value IS 'What the student answered.';
