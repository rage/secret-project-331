-- Add peer review meta field to exercises
ALTER TABLE exercises
ADD COLUMN needs_peer_review BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN exercises.needs_peer_review IS 'Does this exercise need to be peer reviewed before it can be marked as complete. The corresponding peer review can be found from the peer reviews table.';
-- Add enum for exercise progress with peer reviews
CREATE TYPE exercise_progress AS ENUM (
  'not_answered',
  'peer_review',
  'self_review',
  'complete'
);
-- Add new enum to user exercise states
ALTER TABLE user_exercise_states
ADD COLUMN exercise_progress exercise_progress NOT NULL DEFAULT 'not_answered';
-- Add peer reviews table
CREATE TABLE peer_reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  exercise_id UUID REFERENCES exercises(id),
  peer_reviews_to_give INTEGER NOT NULL,
  peer_reviews_to_receive INTEGER NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON peer_reviews FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE UNIQUE INDEX courses_have_only_one_default_peer_review ON peer_reviews (course_id)
WHERE deleted_at IS NULL
  AND exercise_id IS NULL;
ALTER TABLE peer_reviews
ADD CONSTRAINT more_given_than_received_peer_reviews CHECK (peer_reviews_to_give > peer_reviews_to_receive);
COMMENT ON TABLE peer_reviews IS 'Collections for peer review questions that students have to answer to evaluate each others'' answers.';
COMMENT ON COLUMN peer_reviews.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN peer_reviews.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN peer_reviews.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN peer_reviews.course_id IS 'Course instance that this course is a part of.';
COMMENT ON COLUMN peer_reviews.exercise_id IS 'Exercise that this peer review is a part of. There can be one peer review per course where this field is null, which will be used as the default for all peer reviewed exercises.';
COMMENT ON COLUMN peer_reviews.peer_reviews_to_give IS '';
COMMENT ON COLUMN peer_reviews.peer_reviews_to_receive IS '';
-- Add enum for peer review question types
CREATE TYPE peer_review_question_type AS ENUM ('essay', 'scale');
-- Add peer review questions table
CREATE TABLE peer_review_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  peer_review_id UUID NOT NULL REFERENCES peer_reviews(id),
  order_number INTEGER NOT NULL,
  question VARCHAR(128) NOT NULL,
  question_type peer_review_question_type NOT NULL,
  answer_required BOOLEAN NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON peer_review_questions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE UNIQUE INDEX peer_review_question_order_number_uniqueness ON peer_review_questions (peer_review_id, order_number)
WHERE deleted_at IS NULL;
COMMENT ON TABLE peer_review_questions IS 'Part of user a exercise state, keeps track of the state of a single exercise slide.';
COMMENT ON COLUMN peer_review_questions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN peer_review_questions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN peer_review_questions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN peer_review_questions.peer_review_id IS 'Peer review that the record is a part of';
COMMENT ON COLUMN peer_review_questions.order_number IS 'The order in which this record should appear.';
COMMENT ON COLUMN peer_review_questions.question IS 'The concrete question that is presented to the user.';
COMMENT ON COLUMN peer_review_questions.question_type IS 'The type of answer the reviewer should give.';
COMMENT ON COLUMN peer_review_questions.answer_required IS '';
-- Add peer review queue entries.
CREATE TABLE peer_review_queue_entries(
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users(id),
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  course_instance_id UUID NOT NULL REFERENCES course_instances(id),
  receiving_peer_reviews_exercise_slide_submission_id UUID NOT NULL REFERENCES exercise_slide_submissions(id),
  received_enough_peer_reviews BOOLEAN NOT NULL DEFAULT 'false',
  peer_review_priority INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON peer_review_queue_entries FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE UNIQUE INDEX peer_review_queue_entry_user_exercise_and_course_instance_uniqueness ON peer_review_queue_entries (user_id, exercise_id, course_instance_id)
WHERE deleted_at IS NULL;
COMMENT ON TABLE peer_review_queue_entries IS 'Table for queueing up for peer reviews.';
COMMENT ON COLUMN peer_review_queue_entries.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN peer_review_queue_entries.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN peer_review_queue_entries.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN peer_review_queue_entries.user_id IS 'TODO';
COMMENT ON COLUMN peer_review_queue_entries.exercise_id IS 'TODO';
COMMENT ON COLUMN peer_review_queue_entries.course_instance_id IS 'TODO';
COMMENT ON COLUMN peer_review_queue_entries.receiving_peer_reviews_exercise_slide_submission_id IS 'TODO';
COMMENT ON COLUMN peer_review_queue_entries.received_enough_peer_reviews IS 'Whether or not this queue entry has already received enough peer reviews. Simply a boolean for performance reasons.';
COMMENT ON COLUMN peer_review_queue_entries.peer_review_priority IS 'TODO';
-- Add peer review submissions.
CREATE TABLE peer_review_submissions(
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users(id),
  peer_review_id UUID NOT NULL REFERENCES peer_reviews(id),
  exercise_slide_submission_id UUID NOT NULL REFERENCES exercise_slide_submissions(id)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON peer_review_submissions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE peer_review_queue_entries IS 'TODO';
COMMENT ON COLUMN peer_review_queue_entries.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN peer_review_queue_entries.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN peer_review_queue_entries.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
-- Add peer review question submissions
CREATE TABLE peer_review_question_submissions(
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  peer_review_question_id UUID NOT NULL REFERENCES peer_review_questions(id),
  peer_review_submission_id UUID NOT NULL REFERENCES peer_review_submissions(id),
  text_data VARCHAR(128),
  number_data REAL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON peer_review_question_submissions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
ALTER TABLE peer_review_question_submissions
ADD CONSTRAINT text_or_number_data_set CHECK ((text_data IS NULL) <> (number_data IS NULL));
COMMENT ON TABLE peer_review_question_submissions IS 'TODO';
COMMENT ON COLUMN peer_review_question_submissions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN peer_review_question_submissions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN peer_review_question_submissions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN peer_review_question_submissions.peer_review_question_id IS '';
COMMENT ON COLUMN peer_review_question_submissions.peer_review_submission_id IS '';
COMMENT ON COLUMN peer_review_question_submissions.text_data IS '';
COMMENT ON COLUMN peer_review_question_submissions.number_data IS '';
