CREATE INDEX user_exercise_states_fast_search_2 ON user_exercise_states (
  deleted_at,
  user_id,
  selected_exercise_slide_id,
  reviewing_stage
);

CREATE INDEX ON exercise_slide_submissions (exercise_id);
CREATE INDEX ON page_visit_datum_summary_by_pages (course_id);
CREATE INDEX ON peer_or_self_review_question_submissions (peer_or_self_review_submission_id);
