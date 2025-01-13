CREATE TABLE flagged_answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES exercise_slide_submissions(id),
  flagged_user UUID NOT NULL REFERENCES users(id),
  flagged_by UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE NULLS NOT DISTINCT (submission_id, flagged_by, deleted_at)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON flagged_answers FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE flagged_answers IS 'Used to keep track of answers that has been flagged in peer review';
COMMENT ON COLUMN flagged_answers.submission_id IS 'The id of the exercise task submission being flagged.';
COMMENT ON COLUMN flagged_answers.flagged_user IS 'The id of the user whose answer was flagged.';
COMMENT ON COLUMN flagged_answers.flagged_by IS 'The id of the user who flagged the answer.';
COMMENT ON COLUMN flagged_answers.reason IS 'The reason for flagging the answer.';
COMMENT ON COLUMN flagged_answers.description IS 'Optional additional explanation provided by the user.';
COMMENT ON COLUMN flagged_answers.created_at IS 'Timestamp when the flag was created.';
COMMENT ON COLUMN flagged_answers.updated_at IS 'Timestamp when the flag was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN flagged_answers.deleted_at IS 'Timestamp when the flag was deleted. If null, the record is not deleted.';

ALTER TABLE exercise_slide_submissions
ADD COLUMN flag_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN exercise_slide_submissions.flag_count IS 'The number of times the submission has been flagged.';

ALTER TABLE courses
ADD COLUMN flagged_answers_threshold INTEGER NOT NULL DEFAULT 5;

COMMENT ON COLUMN courses.flagged_answers_threshold IS 'The amount of flags required to trigger a teacher review for an answer.';
