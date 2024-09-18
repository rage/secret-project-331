CREATE INDEX ON peer_review_queue_entries (exercise_id, created_at);
CREATE INDEX ON roles (user_id);
CREATE INDEX ON course_module_completions (user_id);
CREATE INDEX ON exercise_tasks (exercise_slide_id);
CREATE INDEX ON peer_or_self_review_submissions (exercise_slide_submission_id);
CREATE INDEX ON pages (chapter_id);
CREATE INDEX ON pages (page_language_group_id);
CREATE INDEX ON material_references (course_id);
CREATE INDEX ON pages (url_path);
CREATE INDEX ON pages (course_id);
CREATE INDEX ON exercise_task_regrading_submissions (regrading_id);
CREATE INDEX ON pages (course_id);
CREATE INDEX ON peer_review_queue_entries (
  receiving_peer_reviews_exercise_slide_submission_id
);
CREATE INDEX ON exercises (chapter_id);
CREATE INDEX ON exercise_slide_submissions (user_id, exercise_slide_id);
CREATE INDEX ON peer_review_queue_entries (exercise_id);
CREATE INDEX ON users (upstream_id);
CREATE INDEX ON user_exercise_slide_states (user_exercise_state_id);
CREATE INDEX ON exercise_tasks (exercise_slide_id);
CREATE INDEX ON teacher_grading_decisions (user_exercise_state_id);
CREATE INDEX ON user_exercise_states (course_instance_id);
CREATE INDEX ON course_specific_consent_form_answers (user_id);
