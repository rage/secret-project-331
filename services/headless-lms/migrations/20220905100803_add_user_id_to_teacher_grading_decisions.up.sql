ALTER TABLE teacher_grading_decisions
ADD COLUMN user_id UUID REFERENCES users;

COMMENT ON COLUMN teacher_grading_decisions.user_id IS 'The user that made the decision. If NULL, the decision was added automatically without the involment of a user.';
