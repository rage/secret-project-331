ALTER TABLE exercise_reset_logs
ALTER COLUMN reset_by
SET NOT NULL,
  DROP COLUMN reason;
