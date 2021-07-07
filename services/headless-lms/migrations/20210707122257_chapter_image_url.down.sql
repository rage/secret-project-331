-- Add down migration script here
ALTER TABLE chapters DROP COLUMN IF EXISTS chapter_image_url;
