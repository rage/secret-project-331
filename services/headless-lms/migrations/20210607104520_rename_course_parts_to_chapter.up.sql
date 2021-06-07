-- Add up migration script here
ALTER TABLE course_parts
  RENAME TO chapters;
ALTER TABLE pages
  RENAME COLUMN course_part_id TO chapter_id;
