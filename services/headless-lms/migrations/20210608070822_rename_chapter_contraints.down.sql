-- Add down migration script here
ALTER TABLE chapters
  RENAME CONSTRAINT chapters_course_id_fkey TO course_parts_course_id_fkey;
ALTER TABLE chapters
  RENAME CONSTRAINT chapters_front_page_id_fkey TO course_parts_page_id_fkey;
ALTER TABLE chapters
  RENAME CONSTRAINT chapters_chapter_number_course_id_key TO course_parts_part_number_course_id_key;
ALTER TABLE pages
  RENAME CONSTRAINT pages_chapter_id_fkey TO pages_course_part_id_fkey;
ALTER INDEX chapters_pkey
RENAME TO course_parts_pkey;
