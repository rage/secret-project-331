-- Remove partiality from index.
DROP INDEX peer_review_queue_entry_user_exercise_and_course_instance_uniqueness;
CREATE UNIQUE INDEX peer_review_queue_entry_user_exercise_and_course_instance_uniqueness ON peer_review_queue_entries (user_id, exercise_id, course_instance_id);
-- Fix unique index
DROP INDEX peer_review_submissions_course_instance_submission_uniqueness;
CREATE UNIQUE INDEX peer_review_submissions_course_instance_submission_uniqueness ON peer_review_submissions (
  user_id,
  course_instance_id,
  exercise_slide_submission_id
)
WHERE deleted_at IS NULL;
