-- Add down migration script here
ALTER TABLE chapters
  RENAME TO course_parts;
ALTER TABLE pages
  RENAME COLUMN chapter_id TO course_part_id;
