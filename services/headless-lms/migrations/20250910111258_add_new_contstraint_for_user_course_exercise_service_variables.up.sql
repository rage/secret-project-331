ALTER TABLE user_course_exercise_service_variables
ADD CONSTRAINT no_duplicate_keys_course UNIQUE NULLS NOT DISTINCT (
    variable_key,
    user_id,
    course_id,
    exercise_service_slug,
    exam_id,
    deleted_at
  );
