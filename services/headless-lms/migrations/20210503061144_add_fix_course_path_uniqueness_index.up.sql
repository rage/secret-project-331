-- Add up migration script here
ALTER TABLE pages DROP constraint pages_url_path_deleted_key;
ALTER TABLE pages ADD constraint pages_url_path_course_id_deleted_key UNIQUE (url_path, course_id, deleted);
