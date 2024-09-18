DROP INDEX IF EXISTS exercise_tasks_exercise_slide_id_idx1;
DROP INDEX IF EXISTS pages_course_id_idx1;
DROP INDEX IF EXISTS peer_review_queue_entries_exercise_id_idx;
CREATE INDEX ON feedback (course_id);
CREATE INDEX user_exercise_states_fast_search_3 ON user_exercise_states (deleted_at, exercise_id, reviewing_stage);
