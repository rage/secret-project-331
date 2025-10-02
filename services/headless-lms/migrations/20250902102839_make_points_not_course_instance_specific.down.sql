ALTER TABLE user_exercise_states
ADD COLUMN course_instance_id uuid REFERENCES course_instances(id);

UPDATE user_exercise_states ues
SET course_instance_id = ci.id
FROM course_instances ci
WHERE ues.course_id = ci.course_id;

ALTER TABLE user_exercise_states DROP COLUMN course_id;

ALTER TABLE user_exercise_states
ADD CONSTRAINT course_instance_or_exam_id_set CHECK (
    (course_instance_id IS NULL) <> (exam_id IS NULL)
  );

UPDATE user_exercise_states ues
SET deleted_at = NULL
WHERE deleted_at IS NOT NULL;

UPDATE user_exercise_slide_states uess
SET deleted_at = NULL
FROM user_exercise_states ues
WHERE uess.user_exercise_state_id = ues.id
  AND uess.deleted_at IS NOT NULL
  AND ues.deleted_at IS NULL;

UPDATE user_exercise_task_states uets
SET deleted_at = NULL
FROM user_exercise_slide_states uess
WHERE uets.user_exercise_slide_state_id = uess.id
  AND uets.deleted_at IS NOT NULL
  AND uess.deleted_at IS NULL;

DROP TABLE user_exercise_states_copy;
DROP TABLE user_exercise_slide_states_copy;
DROP TABLE user_exercise_task_states_copy;

ALTER TABLE course_module_completions
ADD COLUMN course_instance_id uuid REFERENCES course_instances(id);
