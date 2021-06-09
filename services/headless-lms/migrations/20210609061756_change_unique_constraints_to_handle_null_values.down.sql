-- pages
DROP INDEX unique_pages_url_path_course_id_when_not_deleted;
ALTER TABLE pages
ADD constraint pages_url_path_course_id_deleted_key UNIQUE (url_path, course_id, deleted_at);
-- chapters
DROP INDEX unique_chapters_chapter_number_course_id_when_not_deleted;
ALTER TABLE chapters
ADD constraint chapters_chapter_number_course_id_key UNIQUE (chapter_number, course_id, deleted_at);
