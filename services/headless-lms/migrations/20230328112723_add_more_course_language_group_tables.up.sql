-- Page language groups
CREATE TABLE page_language_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_language_group_id UUID NOT NULL REFERENCES course_language_groups
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_language_groups FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE page_language_groups IS 'Used to figure out which pages are the same in different course language versions. Each page belongs to one language group though the pages.page_language_group_id column. If two pages have the same page language group, they are the same page but in different languages. For finding course language versions itself, please see the table course_language_groups. This table is not used for pages not related to courses, like exam pages.';
COMMENT ON COLUMN page_language_groups.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_language_groups.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_language_groups.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN page_language_groups.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN page_language_groups.course_language_group_id IS 'The course language group the courses using these pages use. Can be used to find the language versions of the courses.';
-- Exercise language groups
CREATE TABLE exercise_language_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_language_group_id UUID NOT NULL REFERENCES course_language_groups
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_language_groups FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE exercise_language_groups IS 'Used to figure out which exercises are the same in different course language versions. Each page belongs to one language group though the exercises.exercise_language_group_id column. If two exercises have the same exercise language group, they are the same exercise but in different languages. For finding course language versions itself, please see the table course_language_groups. This table is not used for exercises not related to courses, like exam exercises.';
COMMENT ON COLUMN exercise_language_groups.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_language_groups.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN exercise_language_groups.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_language_groups.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN exercise_language_groups.course_language_group_id IS 'The course language group the courses using these exercises use. Can be used to find the language versions of the courses.';
-- Adding the new language group columns to existing tables and allowing nulls temporarily
ALTER TABLE pages
ADD COLUMN page_language_group_id UUID REFERENCES page_language_groups;
COMMENT ON COLUMN pages.page_language_group_id IS 'If the page is related to a course, this can be used to find this exercise in other languages. If two pages share the same id, they are the same page but in different languages. For pages not related to a course, like exam pages, this is always null.';
ALTER TABLE exercises
ADD COLUMN exercise_language_group_id UUID REFERENCES exercise_language_groups;
COMMENT ON COLUMN exercises.exercise_language_group_id IS 'If the exercise is related to a course, this can be used to find this exercise in other languages. If two exercises share the same id, they are the same exercise but in different languages. For exercises not related to a course, like exam exercises, this is always null.';
-- Adding rows for old data
INSERT INTO page_language_groups (id, course_language_group_id)
SELECT uuid_generate_v5(p.course_id, p.id::text),
  c.course_language_group_id
FROM pages p
  JOIN courses c on p.course_id = c.id
WHERE p.copied_from IS NULL;
INSERT INTO exercise_language_groups (id, course_language_group_id)
SELECT uuid_generate_v5(e.course_id, e.id::text),
  c.course_language_group_id
FROM exercises e
  JOIN courses c on e.course_id = c.id
WHERE e.copied_from IS NULL;
-- Updating existing rows, not copied
UPDATE pages p
set page_language_group_id = uuid_generate_v5(p.course_id, p.id::text)
WHERE copied_from IS NULL;
UPDATE exercises e
SET exercise_language_group_id = uuid_generate_v5(e.course_id, e.id::text)
WHERE copied_from IS NULL;
-- Updating existing rows, copied, handling recursion to copies of copies.
WITH recursive rec AS (
  SELECT id,
    copied_from,
    course_id as orignal_page_course_id,
    id as original_page_id,
    0 as degree
  FROM pages
  WHERE copied_from IS NULL
    AND course_id IS NOT NULL
  UNION ALL
  SELECT p.id,
    p.copied_from,
    rec.orignal_page_course_id,
    rec.original_page_id,
    rec.degree + 1 as degree
  FROM pages p
    JOIN rec ON p.copied_from = rec.id
)
UPDATE pages
SET page_language_group_id = subquery.correct_page_language_group_id
FROM (
    SELECT id as page_needing_updating,
      uuid_generate_v5(
        rec.orignal_page_course_id,
        rec.original_page_id::text
      ) as correct_page_language_group_id
    FROM rec
    WHERE degree > 0
  ) subquery
WHERE pages.id = subquery.page_needing_updating
  AND course_id IS NOT NULL;
WITH recursive rec AS (
  SELECT id,
    copied_from,
    course_id as orignal_exercise_course_id,
    id as original_exercise_id,
    0 as degree
  FROM exercises
  WHERE copied_from IS NULL
    AND course_id IS NOT NULL
  UNION ALL
  SELECT p.id,
    p.copied_from,
    rec.orignal_exercise_course_id,
    rec.original_exercise_id,
    rec.degree + 1 as degree
  FROM exercises p
    JOIN rec ON p.copied_from = rec.id
)
UPDATE exercises
SET exercise_language_group_id = subquery.correct_exercise_language_group_id
FROM (
    SELECT id as exercise_needing_updating,
      uuid_generate_v5(
        rec.orignal_exercise_course_id,
        rec.original_exercise_id::text
      ) as correct_exercise_language_group_id
    FROM rec
    WHERE degree > 0
  ) subquery
WHERE exercises.id = subquery.exercise_needing_updating
  AND course_id IS NOT NULL;
-- Now that all old data has been fixed, we make the database to enforce that the new ids are not null
-- This will force us to maintain the new foreign keys from the application
ALTER TABLE pages
ADD CONSTRAINT check_page_language_group_id_defined CHECK (
    course_id IS NULL
    OR (
      course_id IS NOT NULL
      AND page_language_group_id IS NOT NULL
    )
  );
ALTER TABLE exercises
ADD CONSTRAINT check_exercise_language_group_id_defined CHECK (
    course_id IS NULL
    OR (
      course_id IS NOT NULL
      AND exercise_language_group_id IS NOT NULL
    )
  );