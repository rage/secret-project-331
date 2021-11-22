-- Add down migration script here
ALTER TABLE roles DROP exam_id;
ALTER TABLE feedback DROP CONSTRAINT course_or_exam_id_set,
  DROP exam_id,
  ALTER course_id
SET NOT NULL;
ALTER TABLE gradings DROP CONSTRAINT course_or_exam_id_set,
  DROP exam_id,
  ALTER course_id
SET NOT NULL;
ALTER TABLE submissions DROP CONSTRAINT course_instance_or_exam_id_set,
  DROP exam_id,
  ALTER course_instance_id
SET NOT NULL,
  ALTER course_id
SET NOT NULL;
ALTER TABLE user_exercise_states DROP CONSTRAINT course_instance_or_exam_id_set,
  DROP exam_id,
  ALTER course_instance_id
SET NOT NULL,
  DROP id,
  ADD CONSTRAINT user_exercise_states_pkey PRIMARY KEY (user_id, exercise_id, course_instance_id);
ALTER TABLE exercises DROP CONSTRAINT course_or_exam_id_set,
  DROP exam_id,
  ALTER course_id
SET NOT NULL;
ALTER TABLE pages DROP CONSTRAINT course_or_exam_id_set,
  DROP exam_id,
  ALTER course_id
SET NOT NULL;
DROP TABLE exam_enrollments;
DROP TABLE course_exams;
DROP TABLE exams;
