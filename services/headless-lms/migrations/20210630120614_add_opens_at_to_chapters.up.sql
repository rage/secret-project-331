-- Add up migration script here
ALTER TABLE chapters
ADD opens_at TIMESTAMPTZ;
