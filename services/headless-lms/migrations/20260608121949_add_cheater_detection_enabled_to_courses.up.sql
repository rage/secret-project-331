ALTER TABLE courses
ADD COLUMN cheater_detection_enabled BOOLEAN NOT NULL DEFAULT TRUE;
COMMENT ON COLUMN courses.cheater_detection_enabled IS 'If true, the suspected-cheaters detection runs for this course: completions faster than the configured (or default 3-hour) threshold are flagged for teacher review. Disabled for seeded/system-test courses.';
