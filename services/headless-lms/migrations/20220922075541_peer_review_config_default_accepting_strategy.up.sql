-- Add up migration script here
ALTER TABLE peer_review_configs
ALTER COLUMN peer_reviews_to_give
SET DEFAULT 2;
ALTER TABLE peer_review_configs
ALTER COLUMN peer_reviews_to_receive
SET DEFAULT 1;
