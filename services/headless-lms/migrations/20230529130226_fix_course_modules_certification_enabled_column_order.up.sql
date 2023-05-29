ALTER TABLE course_modules DROP COLUMN certification_enabled;
ALTER TABLE course_modules
ADD COLUMN certification_enabled BOOLEAN DEFAULT FALSE NOT NULL;
