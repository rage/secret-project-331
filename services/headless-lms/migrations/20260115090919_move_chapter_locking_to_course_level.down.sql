DROP TABLE IF EXISTS user_chapter_locking_statuses;

DROP TYPE IF EXISTS chapter_locking_status;

ALTER TABLE courses DROP COLUMN chapter_locking_enabled;
