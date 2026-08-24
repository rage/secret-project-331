ALTER TYPE teacher_decision_type
ADD VALUE IF NOT EXISTS 'unauthorized-ai-use';

ALTER TYPE teacher_decision_type
ADD VALUE IF NOT EXISTS 'bad-answer';

ALTER TYPE teacher_decision_type
ADD VALUE IF NOT EXISTS 'other';

ALTER TABLE exercise_reset_logs
ADD COLUMN teacher_feedback TEXT;

COMMENT ON COLUMN exercise_reset_logs.teacher_feedback IS 'Feedback the teacher wrote for the student while resetting the exercise. Stored here because the reset soft-deletes the grading decision that carried it.';
