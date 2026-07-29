-- Lets a signed-in user hide a course from their personal "My courses" list without affecting their
-- progress on it. The flag lives on the per-language-group settings row, so it is only available for
-- courses the user has enrolled in. The course becomes visible again when the user next visits its
-- material (see get_course_page_by_path).
ALTER TABLE user_course_settings
ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN user_course_settings.hidden IS 'Whether the user has hidden this course from their personal "My courses" list. Does not affect course progress and is reset to false when the user next visits the course material.';
