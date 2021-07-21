-- Add down migration script here
ALTER TABLE exercises DROP COLUMN chapter_id;
ALTER TABLE exercises DROP CONSTRAINT chapter_id_fk;
