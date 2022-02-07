-- Add up migration script here
ALTER TABLE courses
ADD COLUMN description TEXT;
