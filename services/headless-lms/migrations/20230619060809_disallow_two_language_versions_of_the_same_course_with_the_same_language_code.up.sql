CREATE UNIQUE INDEX course_language_group_id_and_language_code_uniqueness ON courses (course_language_group_id, language_code)
WHERE deleted_at IS NULL;
