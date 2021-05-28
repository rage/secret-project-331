-- users
ALTER table users
ALTER COLUMN deleted_at TYPE BOOLEAN USING CASE
    WHEN deleted_at = NULL THEN false
    ELSE true
  END;
ALTER TABLE users
ALTER COLUMN deleted_at
SET DEFAULT false;
ALTER TABLE users
ALTER COLUMN deleted_at
SET NOT NULL;
ALTER table users
  RENAME deleted_at TO deleted;
-- submissions
ALTER table submissions
ALTER COLUMN deleted_at TYPE BOOLEAN USING CASE
    WHEN deleted_at = NULL THEN false
    ELSE true
  END;
ALTER TABLE submissions
ALTER COLUMN deleted_at
SET DEFAULT false;
ALTER TABLE submissions
ALTER COLUMN deleted_at
SET NOT NULL;
ALTER table submissions
  RENAME deleted_at TO deleted;
-- regradings
ALTER table regradings
ALTER COLUMN deleted_at TYPE BOOLEAN USING CASE
    WHEN deleted_at = NULL THEN false
    ELSE true
  END;
ALTER TABLE regradings
ALTER COLUMN deleted_at
SET DEFAULT false;
ALTER TABLE regradings
ALTER COLUMN deleted_at
SET NOT NULL;
ALTER table regradings
  RENAME deleted_at TO deleted;
-- regrading_submissions
ALTER table regrading_submissions
ALTER COLUMN deleted_at TYPE BOOLEAN USING CASE
    WHEN deleted_at = NULL THEN false
    ELSE true
  END;
ALTER TABLE regrading_submissions
ALTER COLUMN deleted_at
SET DEFAULT false;
ALTER TABLE regrading_submissions
ALTER COLUMN deleted_at
SET NOT NULL;
ALTER table regrading_submissions
  RENAME deleted_at TO deleted;
-- pages
ALTER table pages
ALTER COLUMN deleted_at TYPE BOOLEAN USING CASE
    WHEN deleted_at = NULL THEN false
    ELSE true
  END;
ALTER TABLE pages
ALTER COLUMN deleted_at
SET DEFAULT false;
ALTER TABLE pages
ALTER COLUMN deleted_at
SET NOT NULL;
ALTER table pages
  RENAME deleted_at TO deleted;
-- organizations
ALTER table organizations
ALTER COLUMN deleted_at TYPE BOOLEAN USING CASE
    WHEN deleted_at = NULL THEN false
    ELSE true
  END;
ALTER TABLE organizations
ALTER COLUMN deleted_at
SET DEFAULT false;
ALTER TABLE organizations
ALTER COLUMN deleted_at
SET NOT NULL;
ALTER table organizations
  RENAME deleted_at TO deleted;
-- gradings
ALTER table gradings
ALTER COLUMN deleted_at TYPE BOOLEAN USING CASE
    WHEN deleted_at = NULL THEN false
    ELSE true
  END;
ALTER TABLE gradings
ALTER COLUMN deleted_at
SET DEFAULT false;
ALTER TABLE gradings
ALTER COLUMN deleted_at
SET NOT NULL;
ALTER table gradings
  RENAME deleted_at TO deleted;
-- exercises
ALTER table exercises
ALTER COLUMN deleted_at TYPE BOOLEAN USING CASE
    WHEN deleted_at = NULL THEN false
    ELSE true
  END;
ALTER TABLE exercises
ALTER COLUMN deleted_at
SET DEFAULT false;
ALTER TABLE exercises
ALTER COLUMN deleted_at
SET NOT NULL;
ALTER table exercises
  RENAME deleted_at TO deleted;
-- exercise_items
ALTER table exercise_items
ALTER COLUMN deleted_at TYPE BOOLEAN USING CASE
    WHEN deleted_at = NULL THEN false
    ELSE true
  END;
ALTER TABLE exercise_items
ALTER COLUMN deleted_at
SET DEFAULT false;
ALTER TABLE exercise_items
ALTER COLUMN deleted_at
SET NOT NULL;
ALTER table exercise_items
  RENAME deleted_at TO deleted;
-- courses
ALTER table courses
ALTER COLUMN deleted_at TYPE BOOLEAN USING CASE
    WHEN deleted_at = NULL THEN false
    ELSE true
  END;
ALTER TABLE courses
ALTER COLUMN deleted_at
SET DEFAULT false;
ALTER TABLE courses
ALTER COLUMN deleted_at
SET NOT NULL;
ALTER table courses
  RENAME deleted_at TO deleted;
-- course_parts
ALTER table course_parts
ALTER COLUMN deleted_at TYPE BOOLEAN USING CASE
    WHEN deleted_at = NULL THEN false
    ELSE true
  END;
ALTER TABLE course_parts
ALTER COLUMN deleted_at
SET DEFAULT false;
ALTER TABLE course_parts
ALTER COLUMN deleted_at
SET NOT NULL;
ALTER table course_parts
  RENAME deleted_at TO deleted;
