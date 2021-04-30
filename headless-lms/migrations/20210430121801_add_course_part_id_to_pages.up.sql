-- Add up migration script here
ALTER TABLE pages
  ADD course_part_id UUID REFERENCES course_parts;
