CREATE INDEX user_exercise_states_fast_search ON user_exercise_states (
  user_id,
  exercise_id,
  course_instance_id,
  exam_id,
  deleted_at
);
CREATE INDEX exercise_slide_submissions_fast_search ON exercise_slide_submissions (
  user_id,
  exercise_id,
  course_instance_id,
  exam_id,
  exercise_slide_id,
  deleted_at,
  created_at
);
