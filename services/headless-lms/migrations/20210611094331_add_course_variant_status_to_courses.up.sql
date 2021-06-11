-- Add up migration script here
CREATE TYPE variant_status AS ENUM ('draft', 'upcoming', 'active', 'ended');
ALTER TABLE courses
ADD variant_status variant_status NOT NULL DEFAULT 'draft';
