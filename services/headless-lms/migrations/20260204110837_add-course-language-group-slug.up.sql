ALTER TABLE course_language_groups
ADD COLUMN slug VARCHAR(255);

UPDATE course_language_groups clg
SET slug = (
    SELECT c.slug
    FROM courses c
    WHERE c.course_language_group_id = clg.id
      AND c.deleted_at IS NULL
    LIMIT 1
  )
WHERE clg.deleted_at IS NULL
  AND clg.slug IS NULL;

UPDATE course_language_groups
SET slug = id::text
WHERE deleted_at IS NULL
  AND slug IS NULL;

UPDATE course_language_groups
SET slug = id::text
WHERE slug IS NULL;

ALTER TABLE course_language_groups
ALTER COLUMN slug
SET NOT NULL;

CREATE UNIQUE INDEX course_language_groups_slug_unique_non_deleted ON course_language_groups (slug, deleted_at) NULLS NOT DISTINCT;
