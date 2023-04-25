CREATE TABLE offered_answers_to_peer_review_temporary (
  exercise_slide_submission_id UUID REFERENCES exercise_slide_submissions,
  user_id UUID REFERENCES users,
  course_instance_id UUID REFERENCES course_instances,
  exercise_id UUID REFERENCES exercises NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (
    exercise_slide_submission_id,
    user_id,
    course_instance_id
  )
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON offered_answers_to_peer_review_temporary FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE offered_answers_to_peer_review_temporary IS 'Stores the answer that was offered to a user to be peer reviewed. Used to make sure the user is likely to get the same answer to review if they reload their browser. All entries are cleaned from here after 1 hour. Also, the user will be given a different answer to review if the answer stored here no longer needs peer review.';
COMMENT ON COLUMN offered_answers_to_peer_review_temporary.exercise_slide_submission_id IS 'The answer given to be peer reviewed';
COMMENT ON COLUMN offered_answers_to_peer_review_temporary.user_id IS 'The user the answer was given to be reviewed.';
COMMENT ON COLUMN offered_answers_to_peer_review_temporary.course_instance_id IS 'The course instance the user was on.';
COMMENT ON COLUMN offered_answers_to_peer_review_temporary.exercise_id IS 'The exercise the peer review is related to.';
COMMENT ON COLUMN offered_answers_to_peer_review_temporary.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN offered_answers_to_peer_review_temporary.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
-- Index to make lookups and deletions faster
CREATE INDEX ON offered_answers_to_peer_review_temporary (
  created_at,
  exercise_id,
  course_instance_id,
  user_id
);