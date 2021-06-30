-- Add up migration script here
CREATE TYPE chapter_status AS ENUM ('open', 'closed');
ALTER TABLE chapters
ADD status chapter_status NOT NULL DEFAULT 'closed';
ALTER TABLE chapters
ADD opens_at TIMESTAMPTZ;
