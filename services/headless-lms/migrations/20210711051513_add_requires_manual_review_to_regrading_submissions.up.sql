-- Add up migration script here
ALTER TABLE regrading_submissions
ADD requires_manual_review VARCHAR(255);
