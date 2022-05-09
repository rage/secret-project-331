-- Add down migration script here
DROP TABLE IF EXISTS peer_review_question_submissions;
DROP TABLE IF EXISTS peer_review_submissions;
DROP TABLE IF EXISTS peer_review_queue_entries;
DROP TABLE IF EXISTS peer_review_questions;
DROP TYPE peer_review_question_type;
DROP TABLE IF EXISTS peer_reviews;
ALTER TABLE user_exercise_states DROP COLUMN IF EXISTS exercise_progress;
DROP TYPE IF EXISTS exercise_progress;
ALTER TABLE exercises DROP COLUMN IF EXISTS needs_peer_review;
