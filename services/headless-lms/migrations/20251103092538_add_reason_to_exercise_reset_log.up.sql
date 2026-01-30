ALTER TABLE exercise_reset_logs
ALTER COLUMN reset_by DROP NOT NULL,
  ADD COLUMN reason TEXT;

COMMENT ON COLUMN exercise_reset_logs.reason IS 'The reason for resetting the exercise, provided by the reset method automatically.';
