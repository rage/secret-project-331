CREATE TABLE user_chapter_locks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users(id),
  chapter_id UUID NOT NULL REFERENCES chapters(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  UNIQUE(user_id, chapter_id)
);

CREATE INDEX idx_user_chapter_locks_user_id ON user_chapter_locks(user_id);
CREATE INDEX idx_user_chapter_locks_chapter_id ON user_chapter_locks(chapter_id);
CREATE INDEX idx_user_chapter_locks_course_id ON user_chapter_locks(course_id);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_chapter_locks FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE user_chapter_locks IS 'Tracks which chapters students have manually locked (marked as done).';
COMMENT ON COLUMN user_chapter_locks.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN user_chapter_locks.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN user_chapter_locks.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_chapter_locks.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN user_chapter_locks.user_id IS 'The user who locked the chapter.';
COMMENT ON COLUMN user_chapter_locks.chapter_id IS 'The chapter that was locked.';
COMMENT ON COLUMN user_chapter_locks.course_id IS 'The course that the chapter belongs to.';
