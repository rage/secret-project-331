-- Add up migration script here
ALTER TABLE peer_review_configs
ALTER COLUMN accepting_threshold
SET DEFAULT 2.1;
