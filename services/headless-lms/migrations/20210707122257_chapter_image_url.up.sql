-- Add up migration script here
ALTER TABLE chapters
ADD COLUMN IF NOT EXISTS chapter_image_url varchar(255) DEFAULT NULL;
