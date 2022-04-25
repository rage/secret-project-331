-- Add peer review meta field to exercises
ALTER TABLE exercises
ADD COLUMN needs_peer_review BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN exercises.needs_peer_review IS 'Does this exercise need to be peer reviewed before it can be marked as complete. The corresponding peer review can be found from the peer reviews table.';
-- Add enum for exercise progress with peer reviews
CREATE TYPE exercise_progress AS ENUM (
  'incomplete',
  'peer_review',
  'self_review',
  'complete'
);
-- Add new enum to user exercise states
ALTER TABLE user_exercise_states
ADD COLUMN exercise_progress exercise_progress NOT NULL DEFAULT 'incomplete';
-- Add peer reviews table
CREATE TABLE peer_reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  exercise_id UUID REFERENCES exercises(id)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON peer_reviews FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE UNIQUE INDEX courses_have_only_one_default_peer_review ON peer_reviews (course_id)
WHERE deleted_at IS NULL
  AND exercise_id IS NULL;
COMMENT ON TABLE peer_reviews IS 'Part of user a exercise state, keeps track of the state of a single exercise slide.';
COMMENT ON COLUMN peer_reviews.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN peer_reviews.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN peer_reviews.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN peer_reviews.course_id IS 'Course id that this course is a part of.';
COMMENT ON COLUMN peer_reviews.exercise_id IS 'Exercise that this peer review is a part of. There can be one peer review per course where this field is null, which will be used as the default for all peer reviewed exercises.';
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
  title VARCHAR(128) NOT NULL,
  question_type peer_review_question_type NOT NULL
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
COMMENT ON COLUMN peer_review_questions.title IS 'Description of the question for the user.';
COMMENT ON COLUMN peer_review_questions.question_type IS 'The type of answer the reviewer should give.';
