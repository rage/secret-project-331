CREATE TABLE completion_registration_credit_justifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_module_completion_id UUID NOT NULL REFERENCES course_module_completions,
  user_id UUID NOT NULL REFERENCES users,
  justification TEXT NOT NULL
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON completion_registration_credit_justifications FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE UNIQUE INDEX uq_completion_registration_credit_justifications_completion ON completion_registration_credit_justifications (course_module_completion_id, deleted_at) NULLS NOT DISTINCT;

COMMENT ON TABLE completion_registration_credit_justifications IS 'Why a student wants their credits in the study registry when a certificate would have served and enrolling will cost them a manual identity check. Collected on the completion registration page, from the one branch that reaches the question, to tell us how common that situation is. Advisory and free text: nothing reads it to decide anything, and it neither gates nor speeds up the registration the student then goes on to make. Kept apart from course_module_completions because a completion is a graded fact and this is one person''s answer to a question about it. Student-written prose about their own circumstances, so users.delete_user hard-deletes these rows with the account.';
COMMENT ON COLUMN completion_registration_credit_justifications.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN completion_registration_credit_justifications.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN completion_registration_credit_justifications.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN completion_registration_credit_justifications.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN completion_registration_credit_justifications.course_module_completion_id IS 'The completion the student was registering when they answered. Unique among live rows: the answer is replaced rather than versioned, and a student who completes the module again starts without one.';
COMMENT ON COLUMN completion_registration_credit_justifications.user_id IS 'The student who answered. Always the completion''s own user; stored so the rows can be scoped to a user without joining, which account deletion needs.';
COMMENT ON COLUMN completion_registration_credit_justifications.justification IS 'What the student wrote. Required to get past the question, but never checked or acted on: a student who changes an earlier answer afterwards leaves the row behind, and it stays as the answer they gave at the time.';
