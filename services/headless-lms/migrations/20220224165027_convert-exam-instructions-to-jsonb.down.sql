-- Add down migration script here
ALTER TABLE exams DROP COLUMN instructions;
ALTER TABLE exams
ADD COLUMN instructions TEXT NOT NULL;
