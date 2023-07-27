-- Add up migration script here
CREATE TABLE course_specific_research_consent_forms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT course_id_when_not_deleted UNIQUE NULLS NOT DISTINCT(course_id, deleted_at)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_specific_research_consent_forms FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_specific_research_consent_forms IS 'Stores a custom research consent forms for a specific course';
COMMENT ON COLUMN course_specific_research_consent_forms.course_id IS 'The course for which the research consent form belongs to';
COMMENT ON COLUMN course_specific_research_consent_forms.content IS 'Form content in an abstract form. It is an array of JSON objects that are blocks. For example,a block could be a paragraph or a label';
COMMENT ON COLUMN course_specific_research_consent_forms.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_specific_research_consent_forms.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_specific_research_consent_forms.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
CREATE TABLE course_specific_consent_form_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses,
  research_consent_form_id UUID NOT NULL REFERENCES course_specific_research_consent_forms,
  question varchar(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_specific_consent_form_questions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_specific_consent_form_questions IS 'Stores a custom research consent questions for a specific course';
COMMENT ON COLUMN course_specific_consent_form_questions.course_id IS 'The course for which the research consent form belongs to';
COMMENT ON COLUMN course_specific_consent_form_questions.research_consent_form_id IS 'The form for which the question belongs to';
COMMENT ON COLUMN course_specific_consent_form_questions.question IS 'The question in the research consent form';
COMMENT ON COLUMN course_specific_consent_form_questions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_specific_consent_form_questions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_specific_consent_form_questions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
CREATE TABLE course_specific_consent_form_answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users,
  course_id UUID NOT NULL REFERENCES courses,
  research_form_question_id UUID NOT NULL REFERENCES course_specific_consent_form_questions,
  research_consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_specific_consent_form_answers FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_specific_consent_form_answers IS 'Stores information about students answers to questions in consent forms';
COMMENT ON COLUMN course_specific_consent_form_answers.user_id IS 'The user for which the consent belongs to';
COMMENT ON COLUMN course_specific_consent_form_answers.course_id IS 'The course for which the research consent form belongs to';
COMMENT ON COLUMN course_specific_consent_form_answers.research_form_question_id IS 'The consent question for which the answer belongs to';
COMMENT ON COLUMN course_specific_consent_form_answers.research_consent IS 'Whether or not the student has agreed to the question';
COMMENT ON COLUMN course_specific_consent_form_answers.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_specific_consent_form_answers.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_specific_consent_form_answers.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
