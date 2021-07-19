-- Add up migration script here
ALTER TABLE chapters
ADD COLUMN chapter_image varchar(255);
