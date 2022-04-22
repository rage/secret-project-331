-- Add down migration script here
DROP TABLE IF EXISTS peer_review_questions;
DROP TYPE peer_review_question_type;
DROP TABLE IF EXISTS peer_reviews;
ALTER TABLE exercises DROP COLUMN IF EXISTS needs_peer_review;
