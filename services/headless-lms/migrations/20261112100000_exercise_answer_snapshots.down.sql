DELETE FROM exercise_slide_submission_shares
WHERE exercise_answer_snapshot_id IS NOT NULL;
ALTER TABLE exercise_slide_submission_shares DROP CONSTRAINT exercise_slide_submission_shares_one_target,
  DROP COLUMN exercise_answer_snapshot_id,
  ALTER COLUMN exercise_slide_submission_id
SET NOT NULL;
COMMENT ON COLUMN exercise_slide_submission_shares.exercise_slide_submission_id IS 'The submission this share links to.';
DROP TABLE exercise_answer_snapshot_files;
DROP TABLE exercise_answer_snapshots;
DROP TYPE exercise_answer_snapshot_purpose;
