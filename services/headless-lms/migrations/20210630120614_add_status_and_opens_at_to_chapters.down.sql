-- Add down migration script here
ALTER TABLE chapters DROP COLUMN opens_at;
ALTER TABLE chapters DROP COLUMN status;
DROP TYPE chapter_status;
