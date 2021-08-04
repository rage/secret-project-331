-- Add up migration script here
-- pages
DROP INDEX unique_pages_url_path_course_id_when_not_deleted;
CREATE UNIQUE INDEX unique_pages_url_path_course_id_when_not_deleted ON pages (url_path, course_id)
WHERE deleted_at IS NULL;
-- chapters
DROP INDEX unique_chapters_chapter_number_course_id_when_not_deleted;
CREATE UNIQUE INDEX unique_chapters_chapter_number_course_id_when_not_deleted ON chapters (chapter_number, course_id)
WHERE deleted_at IS NULL;
