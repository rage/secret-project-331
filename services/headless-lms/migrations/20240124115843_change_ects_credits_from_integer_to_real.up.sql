ALTER TABLE course_modules
ALTER COLUMN ects_credits TYPE real USING ects_credits::real;
