ALTER TABLE regradings
ADD COLUMN user_id UUID REFERENCES users;

COMMENT ON COLUMN regradings.user_id IS 'The user that created the regrading. If NULL, the decision was added automatically without the involment of a user.';
