ALTER TABLE exercises
ADD COLUMN needs_self_review BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN exercises.needs_self_review IS 'If true, students are required to review their own submissions before getting any points.';
