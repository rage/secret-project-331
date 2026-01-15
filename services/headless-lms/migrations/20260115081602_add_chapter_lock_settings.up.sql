ALTER TABLE chapters ADD COLUMN exercises_done_through_locking BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN chapters.exercises_done_through_locking IS 'If true, exercises in this chapter require manual review after locking. Students will not receive points until the chapter is locked and teacher reviews their answers.';
