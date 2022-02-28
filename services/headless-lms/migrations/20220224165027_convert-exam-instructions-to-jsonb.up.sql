-- Add up migration script here
ALTER TABLE exams DROP COLUMN instructions;
ALTER TABLE exams
ADD COLUMN instructions JSONB NOT NULL;
COMMENT ON COLUMN exams.instructions IS 'Instructions written in the Gutenberg Editor';
