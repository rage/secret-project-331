-- Add down migration script here
ALTER TABLE regrading_submissions DROP COLUMN requires_manual_review;
