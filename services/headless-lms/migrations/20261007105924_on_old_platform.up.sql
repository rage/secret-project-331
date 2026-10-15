-- Add up migration script here
ALTER TABLE external_courses
ADD COLUMN on_old_platform BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN external_courses.on_old_platform IS 'Is the external course hosted on the old mooc.fi platform or not';
