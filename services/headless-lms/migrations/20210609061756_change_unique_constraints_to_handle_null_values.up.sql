-- pages
ALTER TABLE pages DROP constraint pages_url_path_course_id_deleted_key;
CREATE UNIQUE INDEX unique_pages_url_path_course_id_when_not_deleted ON pages (url_path, course_id)
WHERE deleted_at IS NOT NULL;
-- chapters
ALTER TABLE chapters DROP constraint chapters_chapter_number_course_id_key;
CREATE UNIQUE INDEX unique_chapters_chapter_number_course_id_when_not_deleted ON chapters (chapter_number, course_id)
WHERE deleted_at IS NOT NULL;
