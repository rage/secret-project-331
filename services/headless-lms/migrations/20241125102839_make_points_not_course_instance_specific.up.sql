-- Create a copy of the user_exercise_states table without foreign key constraints
CREATE TABLE user_exercise_states_copy AS
SELECT *
FROM user_exercise_states;

-- We want to swap the course_instance_id in the user_exercise_states table with a new column called course_id. A user might have user_exercise_states for multiple course instances, so we want to soft-delete the states for the instances that are not currently active for the user. We can find the active course_instance_id for each user from the user_course_settings table.
-- Add the new column course_id to the user_exercise_states table
ALTER TABLE user_exercise_states
ADD COLUMN course_id uuid REFERENCES courses(id);
UPDATE user_exercise_states
SET course_id = ci.course_id
FROM user_course_settings ucs
  JOIN course_instances ci ON ucs.current_course_instance_id = ci.id
WHERE user_exercise_states.course_instance_id = ci.id;
-- change the course_instance_or_exam_id_set contraint to use the new column
ALTER TABLE user_exercise_states DROP CONSTRAINT course_instance_or_exam_id_set;
ALTER TABLE user_exercise_states
ADD CONSTRAINT course_id_or_exam_id_set CHECK ((course_id IS NULL) <> (exam_id IS NULL));
-- Soft-delete the user_exercise_states that are not for the active course instance
UPDATE user_exercise_states ues
SET deleted_at = NOW()
FROM user_course_settings ucs
WHERE ues.user_id = ucs.user_id
  AND ues.course_instance_id <> ucs.current_course_instance_id
  AND ues.deleted_at IS NULL;

-- Delete the user_exercise_slide_states that are not for the active course instance
-- COPY
CREATE TABLE user_exercise_slide_states_copy AS
SELECT *
FROM user_exercise_slide_states;
-- Soft-delete the user_exercise_slide_states that are related to deleted user_exercise_states
UPDATE user_exercise_slide_states uess
SET deleted_at = NOW()
FROM user_exercise_states ues
WHERE uess.user_exercise_state_id = ues.id
  AND uess.deleted_at IS NULL
  AND ues.deleted_at IS NOT NULL;
-- Do the same for user_exercise_task_states
-- COPY
CREATE TABLE user_exercise_task_states_copy AS
SELECT *
FROM user_exercise_task_states;
-- Soft-delete the user_exercise_task_states that are related to deleted user_exercise_slide_states
UPDATE user_exercise_task_states uets
SET deleted_at = NOW()
FROM user_exercise_slide_states uess
WHERE uets.user_exercise_slide_state_id = uess.id
  AND uets.deleted_at IS NULL
  AND uess.deleted_at IS NOT NULL;

ALTER TABLE offered_answers_to_peer_review_temporary
ADD COLUMN course_id uuid REFERENCES courses(id);
UPDATE offered_answers_to_peer_review_temporary
SET course_id = ci.course_id
FROM user_course_settings ucs
  JOIN course_instances ci ON ucs.current_course_instance_id = ci.id
WHERE offered_answers_to_peer_review_temporary.course_instance_id = ci.id;
ALTER TABLE offered_answers_to_peer_review_temporary
ALTER COLUMN course_id
SET NOT NULL;
ALTER TABLE offered_answers_to_peer_review_temporary DROP COLUMN course_instance_id;

-- Drop the course_instance_id column
ALTER TABLE user_exercise_states DROP COLUMN course_instance_id;

-- Course module completions should not have a course_instance_id -> moving the user to a different course_instance changes the completions list the teacher sees the student on.
ALTER TABLE course_module_completions DROP COLUMN course_instance_id;
CREATE UNIQUE INDEX course_module_automatic_completion_uniqueness ON course_module_completions (course_module_id, course_id, user_id)
WHERE completion_granter_user_id IS NULL
  AND deleted_at IS NULL;

-- Peer and self review submissions should have course_id instead of course_instance_id
ALTER TABLE peer_or_self_review_submissions
ADD COLUMN course_id uuid REFERENCES courses(id);
UPDATE peer_or_self_review_submissions
SET course_id = ci.course_id
FROM user_course_settings ucs
  JOIN course_instances ci ON ucs.current_course_instance_id = ci.id
WHERE peer_or_self_review_submissions.course_instance_id = ci.id;
ALTER TABLE peer_or_self_review_submissions
ALTER COLUMN course_id
SET NOT NULL;
ALTER TABLE peer_or_self_review_submissions DROP COLUMN course_instance_id;

ALTER TABLE peer_review_queue_entries
ADD COLUMN course_id uuid REFERENCES courses(id);
UPDATE peer_review_queue_entries
SET course_id = ci.course_id
FROM user_course_settings ucs
  JOIN course_instances ci ON ucs.current_course_instance_id = ci.id
WHERE peer_review_queue_entries.course_instance_id = ci.id;
ALTER TABLE peer_review_queue_entries
ALTER COLUMN course_id
SET NOT NULL;
ALTER TABLE peer_review_queue_entries DROP COLUMN course_instance_id;

-- Exercise slide submissions
ALTER TABLE exercise_slide_submissions DROP COLUMN course_instance_id;
