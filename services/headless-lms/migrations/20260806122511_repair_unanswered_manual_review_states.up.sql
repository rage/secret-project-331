-- Chapter locking filed exercises the student never answered as pending teacher review.
-- Those rows block automatic module completion and hide the chapter's model solutions while
-- giving staff nothing to grade. Rows that do have a submission are left alone: those are
-- genuine manual review work. Idempotent, since the predicate excludes already-fixed rows.
UPDATE user_exercise_states ues
SET reviewing_stage = 'not_answered_and_locked'
WHERE ues.reviewing_stage = 'waiting_for_manual_grading'
  AND ues.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM exercise_slide_submissions ess
    WHERE ess.user_id = ues.user_id
      AND ess.exercise_id = ues.exercise_id
      AND ess.deleted_at IS NULL
  );
