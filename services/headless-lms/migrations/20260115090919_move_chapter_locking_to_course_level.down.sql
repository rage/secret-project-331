-- Drop the new table
DROP TABLE IF EXISTS user_chapter_locking_statuses;

-- Drop the enum
DROP TYPE IF EXISTS chapter_locking_status;

-- Remove chapter_locking_enabled from courses
ALTER TABLE courses DROP COLUMN chapter_locking_enabled;
