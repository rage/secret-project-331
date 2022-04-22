ALTER TABLE courses DROP CONSTRAINT courses_slug_key;
CREATE UNIQUE INDEX courses_slug_key_when_not_deleted ON courses (slug)
WHERE deleted_at IS NOT NULL;
