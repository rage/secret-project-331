ALTER TABLE course_modules
ALTER COLUMN ects_credits TYPE integer USING ects_credits::integer;
