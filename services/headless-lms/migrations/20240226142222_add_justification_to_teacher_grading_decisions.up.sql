ALTER TABLE teacher_grading_decisions
ADD COLUMN justification TEXT;
ALTER TABLE teacher_grading_decisions
ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN teacher_grading_decisions.justification IS 'The justification/feedback teachers has given to a submission';
COMMENT ON COLUMN teacher_grading_decisions.hidden IS 'Whether or not the grading decision is hidden from the student';
