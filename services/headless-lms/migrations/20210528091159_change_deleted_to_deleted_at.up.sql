-- users
ALTER table users
  RENAME deleted TO deleted_at;
ALTER TABLE users
ALTER COLUMN deleted_at DROP NOT NULL;
ALTER TABLE users
ALTER COLUMN deleted_at DROP DEFAULT;
ALTER table users
ALTER COLUMN deleted_at TYPE TIMESTAMP WITHOUT TIME ZONE USING CASE
    WHEN deleted_at = false THEN NULL
    ELSE now()
  END;
-- submissions
ALTER table submissions
  RENAME deleted TO deleted_at;
ALTER TABLE submissions
ALTER COLUMN deleted_at DROP NOT NULL;
ALTER TABLE submissions
ALTER COLUMN deleted_at DROP DEFAULT;
ALTER table submissions
ALTER COLUMN deleted_at TYPE TIMESTAMP WITHOUT TIME ZONE USING CASE
    WHEN deleted_at = false THEN NULL
    ELSE now()
  END;
-- regradings
ALTER table regradings
  RENAME deleted TO deleted_at;
ALTER TABLE regradings
ALTER COLUMN deleted_at DROP NOT NULL;
ALTER TABLE regradings
ALTER COLUMN deleted_at DROP DEFAULT;
ALTER table regradings
ALTER COLUMN deleted_at TYPE TIMESTAMP WITHOUT TIME ZONE USING CASE
    WHEN deleted_at = false THEN NULL
    ELSE now()
  END;
-- regrading_submissions
ALTER table regrading_submissions
  RENAME deleted TO deleted_at;
ALTER TABLE regrading_submissions
ALTER COLUMN deleted_at DROP NOT NULL;
ALTER TABLE regrading_submissions
ALTER COLUMN deleted_at DROP DEFAULT;
ALTER table regrading_submissions
ALTER COLUMN deleted_at TYPE TIMESTAMP WITHOUT TIME ZONE USING CASE
    WHEN deleted_at = false THEN NULL
    ELSE now()
  END;
-- pages
ALTER table pages
  RENAME deleted TO deleted_at;
ALTER TABLE pages
ALTER COLUMN deleted_at DROP NOT NULL;
ALTER TABLE pages
ALTER COLUMN deleted_at DROP DEFAULT;
ALTER table pages
ALTER COLUMN deleted_at TYPE TIMESTAMP WITHOUT TIME ZONE USING CASE
    WHEN deleted_at = false THEN NULL
    ELSE now()
  END;
-- organizations
ALTER table organizations
  RENAME deleted TO deleted_at;
ALTER TABLE organizations
ALTER COLUMN deleted_at DROP NOT NULL;
ALTER TABLE organizations
ALTER COLUMN deleted_at DROP DEFAULT;
ALTER table organizations
ALTER COLUMN deleted_at TYPE TIMESTAMP WITHOUT TIME ZONE USING CASE
    WHEN deleted_at = false THEN NULL
    ELSE now()
  END;
-- gradings
ALTER table gradings
  RENAME deleted TO deleted_at;
ALTER TABLE gradings
ALTER COLUMN deleted_at DROP NOT NULL;
ALTER TABLE gradings
ALTER COLUMN deleted_at DROP DEFAULT;
ALTER table gradings
ALTER COLUMN deleted_at TYPE TIMESTAMP WITHOUT TIME ZONE USING CASE
    WHEN deleted_at = false THEN NULL
    ELSE now()
  END;
-- exercises
ALTER table exercises
  RENAME deleted TO deleted_at;
ALTER TABLE exercises
ALTER COLUMN deleted_at DROP NOT NULL;
ALTER TABLE exercises
ALTER COLUMN deleted_at DROP DEFAULT;
ALTER table exercises
ALTER COLUMN deleted_at TYPE TIMESTAMP WITHOUT TIME ZONE USING CASE
    WHEN deleted_at = false THEN NULL
    ELSE now()
  END;
-- exercise_items
ALTER table exercise_items
  RENAME deleted TO deleted_at;
ALTER TABLE exercise_items
ALTER COLUMN deleted_at DROP NOT NULL;
ALTER TABLE exercise_items
ALTER COLUMN deleted_at DROP DEFAULT;
ALTER table exercise_items
ALTER COLUMN deleted_at TYPE TIMESTAMP WITHOUT TIME ZONE USING CASE
    WHEN deleted_at = false THEN NULL
    ELSE now()
  END;
-- courses
ALTER table courses
  RENAME deleted TO deleted_at;
ALTER TABLE courses
ALTER COLUMN deleted_at DROP NOT NULL;
ALTER TABLE courses
ALTER COLUMN deleted_at DROP DEFAULT;
ALTER table courses
ALTER COLUMN deleted_at TYPE TIMESTAMP WITHOUT TIME ZONE USING CASE
    WHEN deleted_at = false THEN NULL
    ELSE now()
  END;
-- course_parts
ALTER table course_parts
  RENAME deleted TO deleted_at;
ALTER TABLE course_parts
ALTER COLUMN deleted_at DROP NOT NULL;
ALTER TABLE course_parts
ALTER COLUMN deleted_at DROP DEFAULT;
ALTER table course_parts
ALTER COLUMN deleted_at TYPE TIMESTAMP WITHOUT TIME ZONE USING CASE
    WHEN deleted_at = false THEN NULL
    ELSE now()
  END;
