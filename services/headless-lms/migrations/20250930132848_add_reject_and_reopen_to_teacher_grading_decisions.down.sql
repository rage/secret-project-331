-- Replace enum value 'reject-and-reset' with 'custom-points'
-- to ensure compatibility with the original teacher_decision_type definition
UPDATE teacher_grading_decisions
SET teacher_decision = 'custom-points'
WHERE teacher_decision = 'reject-and-reset';

-- Rename the old enum
ALTER TYPE teacher_decision_type
RENAME TO teacher_decision_type_old;

-- Create a new enum without 'reject-and-reset'
CREATE TYPE teacher_decision_type AS ENUM (
  'full-points',
  'zero-points',
  'custom-points',
  'suspected-plagiarism'
);

-- Change the column to use the new enum
ALTER TABLE teacher_grading_decisions
ALTER COLUMN teacher_decision TYPE teacher_decision_type USING teacher_decision::text::teacher_decision_type;

DROP TYPE teacher_decision_type_old;
