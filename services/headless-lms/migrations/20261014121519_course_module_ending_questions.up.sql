CREATE TYPE end_question_type AS ENUM ('free-text', 'select', 'multi-select');

CREATE TABLE course_module_ending_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID REFERENCES courses(id),
  question_serial_number INTEGER NOT NULL,
  question_text VARCHAR(255) NOT NULL,
  question_free_text_instruction VARCHAR(255),
  --question_type end_question_type NOT NULL,
  select_labels TEXT ARRAY,
  multi_select_labels TEXT ARRAY,
  UNIQUE NULLS NOT DISTINCT (course_id, question_serial_number)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_module_ending_questions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_module_ending_questions IS 'Questions that a student has to answer after finishing the course. These questions are shown on a course if the course`s base module has "ending_questions_required" set as true in table course_modules. Some questions are course-specific or module specific. An example question:

1 (question_serial_number)
Did you like the course? (question_text)
[Yes] [No] (select_labels)
Elaborate (question_free_text_instruction)
[Text area]

The answers submitted to the questions are in course_module_ending_questions_answers.
';
COMMENT ON COLUMN course_module_ending_questions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_module_ending_questions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_module_ending_questions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_module_ending_questions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_module_ending_questions.course_id IS 'The course this question is for. If null, then this question should be asked on every course.';
COMMENT ON COLUMN course_module_ending_questions.question_serial_number IS 'Indicates the ordering of the questions in the questionnaire.';
COMMENT ON COLUMN course_module_ending_questions.question_text IS 'The question itself.';
COMMENT ON COLUMN course_module_ending_questions.question_free_text_instruction IS 'If the question includes a text input for additional details, this item labels that and adds instructions for that.';
COMMENT ON COLUMN course_module_ending_questions.select_labels IS 'Selectable option labels.';
COMMENT ON COLUMN course_module_ending_questions.multi_select_labels IS 'Multiselect option labels.';



CREATE TABLE course_module_ending_questions_answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  question_id UUID NOT NULL REFERENCES course_module_ending_questions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  course_module_id UUID NOT NULL REFERENCES course_modules(id),
  answer_text_value TEXT,
  answer_select_value VARCHAR(255),
  answer_multi_select_value TEXT ARRAY
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_module_ending_questions_answers FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_module_ending_questions_answers IS 'An example';
COMMENT ON COLUMN course_module_ending_questions_answers.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_module_ending_questions_answers.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_module_ending_questions_answers.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_module_ending_questions_answers.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_module_ending_questions_answers.question_id IS 'The question this answer is for.';
COMMENT ON COLUMN course_module_ending_questions_answers.user_id IS 'Identifies the user who gave this answer.';
COMMENT ON COLUMN course_module_ending_questions_answers.course_module_id IS 'The course moudule this answer is for.';
COMMENT ON COLUMN course_module_ending_questions_answers.answer_text_value IS 'A free text answer value, associated with course_module_ending_questions.question_free_text_instruction or question_text.';
COMMENT ON COLUMN course_module_ending_questions_answers.answer_select_value IS 'A selected option associated with course_module_ending_questions.select_labels.';
COMMENT ON COLUMN course_module_ending_questions_answers.answer_multi_select_value IS 'A list of selected options associated with course_module_ending_questions.multi_select_labels.';


ALTER TABLE course_modules
ADD COLUMN ending_questions_required BOOLEAN NOT NULL DEFAULT FALSE;
