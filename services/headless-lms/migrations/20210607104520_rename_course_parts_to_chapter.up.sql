-- Add up migration script here
ALTER TABLE course_parts
  RENAME COLUMN part_number TO chapter_number;
ALTER TABLE pages
  RENAME COLUMN course_part_id TO chapter_id;
ALTER TABLE course_parts
  RENAME TO chapters;
