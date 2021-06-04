-- Add up migration script here
ALTER TABLE course_parts
  ADD page_id UUID REFERENCES pages;

