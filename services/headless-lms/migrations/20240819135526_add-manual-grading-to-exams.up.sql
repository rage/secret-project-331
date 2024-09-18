ALTER TABLE exams
ADD COLUMN grade_manually BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN exams.grade_manually IS 'True if the exam is graded manually, false if automatically';
