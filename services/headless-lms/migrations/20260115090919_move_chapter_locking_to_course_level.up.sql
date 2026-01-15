-- Add chapter_locking_enabled to courses table
ALTER TABLE courses ADD COLUMN chapter_locking_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN courses.chapter_locking_enabled IS 'When enabled, all chapters in the course are locked by default. Students must complete chapters in order to unlock subsequent chapters.';

-- Create enum for chapter locking status
CREATE TYPE chapter_locking_status AS ENUM ('unlocked', 'completed');

-- Create new table for chapter locking statuses
CREATE TABLE user_chapter_locking_statuses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users(id),
  chapter_id UUID NOT NULL REFERENCES chapters(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  status chapter_locking_status NOT NULL
);

CREATE UNIQUE INDEX idx_user_chapter_locking_statuses_user_chapter_active 
  ON user_chapter_locking_statuses(user_id, chapter_id, deleted_at) NULLS NOT DISTINCT;
CREATE INDEX idx_user_chapter_locking_statuses_user_id ON user_chapter_locking_statuses(user_id);
CREATE INDEX idx_user_chapter_locking_statuses_chapter_id ON user_chapter_locking_statuses(chapter_id);
CREATE INDEX idx_user_chapter_locking_statuses_course_id ON user_chapter_locking_statuses(course_id);

CREATE TRIGGER set_timestamp BEFORE UPDATE ON user_chapter_locking_statuses 
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE user_chapter_locking_statuses IS 'Tracks chapter locking statuses for users. No row means chapter is locked (default). Status "unlocked" means student can work on exercises. Status "completed" means chapter is done and exercises are locked again.';
COMMENT ON COLUMN user_chapter_locking_statuses.status IS 'unlocked: student can work on exercises. completed: chapter is done, exercises are locked.';

-- Remove exercises_done_through_locking from chapters (if it exists)
ALTER TABLE chapters DROP COLUMN IF EXISTS exercises_done_through_locking;
