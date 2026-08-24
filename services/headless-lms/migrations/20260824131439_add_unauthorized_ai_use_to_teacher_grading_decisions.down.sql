-- Replace enum value 'unauthorized-ai-use' with 'suspected-plagiarism'
-- to ensure compatibility with the previous teacher_decision_type definition
UPDATE teacher_grading_decisions
SET teacher_decision = 'suspected-plagiarism'
WHERE teacher_decision = 'unauthorized-ai-use';

-- Rename the old enum
ALTER TYPE teacher_decision_type
RENAME TO teacher_decision_type_old;

-- Create a new enum without 'unauthorized-ai-use'
CREATE TYPE teacher_decision_type AS ENUM (
  'full-points',
  'zero-points',
  'custom-points',
  'suspected-plagiarism',
  'reject-and-reset'
);

-- Change the column to use the new enum
ALTER TABLE teacher_grading_decisions
ALTER COLUMN teacher_decision TYPE teacher_decision_type USING teacher_decision::text::teacher_decision_type;

DROP TYPE teacher_decision_type_old;
