-- Add down migration script here
ALTER TABLE peer_review_configs
ALTER COLUMN peer_reviews_to_give DROP DEFAULT;
ALTER TABLE peer_review_configs
ALTER COLUMN peer_reviews_to_receive DROP DEFAULT;
