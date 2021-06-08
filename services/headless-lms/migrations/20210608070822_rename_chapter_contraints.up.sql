-- Add up migration script here
ALTER TABLE chapters
  RENAME CONSTRAINT course_parts_course_id_fkey TO chapters_course_id_fkey;
ALTER TABLE chapters
  RENAME CONSTRAINT course_parts_page_id_fkey TO chapters_front_page_id_fkey;
ALTER TABLE chapters
  RENAME CONSTRAINT course_parts_part_number_course_id_key TO chapters_chapter_number_course_id_key;
ALTER TABLE pages
  RENAME CONSTRAINT pages_course_part_id_fkey TO pages_chapter_id_fkey;
ALTER INDEX course_parts_pkey
RENAME TO chapters_pkey;
