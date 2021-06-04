-- Add down migration script here
ALTER TABLE course_parts
ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'Europe/Helsinki';
ALTER TABLE courses
ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'Europe/Helsinki';
ALTER TABLE exercise_items
ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'Europe/Helsinki';
ALTER TABLE exercises
ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN deadline TYPE TIMESTAMP USING created_at AT TIME ZONE 'Europe/Helsinki';
ALTER TABLE gradings
ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN grading_started_at TYPE TIMESTAMP USING grading_started_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN grading_completed_at TYPE TIMESTAMP USING grading_completed_at AT TIME ZONE 'Europe/Helsinki';
ALTER TABLE organizations
ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'Europe/Helsinki';
ALTER TABLE pages
ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'Europe/Helsinki';
ALTER TABLE regrading_submissions
ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'Europe/Helsinki';
ALTER TABLE regradings
ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN regrading_started_at TYPE TIMESTAMP USING regrading_started_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN regrading_completed_at TYPE TIMESTAMP USING regrading_completed_at AT TIME ZONE 'Europe/Helsinki';
ALTER TABLE submissions
ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'Europe/Helsinki';
ALTER TABLE users
ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'Europe/Helsinki',
  ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'Europe/Helsinki';
