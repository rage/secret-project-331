-- Add up migration script here
ALTER TABLE peer_review_configs
ALTER COLUMN peer_reviews_to_give
SET DEFAULT 3;
ALTER TABLE peer_review_configs
ALTER COLUMN peer_reviews_to_receive
SET DEFAULT 2;
ALTER TABLE peer_review_questions
ALTER COLUMN answer_required
SET DEFAULT TRUE;
