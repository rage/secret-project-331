-- Add up migration script here
ALTER TABLE chapters
ADD deadline TIMESTAMPTZ;
COMMENT ON COLUMN chapters.deadline IS 'The deadline for all the exercises in the chapter.';
