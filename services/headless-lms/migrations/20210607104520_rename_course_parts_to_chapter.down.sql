-- Add down migration script here
ALTER TABLE chapters
  RENAME COLUMN chapter_number TO part_number;
ALTER TABLE pages
  RENAME COLUMN chapter_id TO course_part_id;
ALTER TABLE chapters
  RENAME TO course_parts;
