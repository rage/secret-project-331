-- Starting point before the migration:
--                                        Table "public.user_exercise_states"
--            Column           |           Type           | Collation | Nullable |             Default
-- ----------------------------+--------------------------+-----------+----------+----------------------------------
--  user_id                    | uuid                     |           | not null |
--  exercise_id                | uuid                     |           | not null |
--  course_instance_id         | uuid                     |           |          |
--  created_at                 | timestamp with time zone |           | not null | now()
--  updated_at                 | timestamp with time zone |           | not null | now()
--  deleted_at                 | timestamp with time zone |           |          |
--  score_given                | real                     |           |          |
--  grading_progress           | grading_progress         |           | not null | 'not-ready'::grading_progress
--  activity_progress          | activity_progress        |           | not null | 'initialized'::activity_progress
--  selected_exercise_slide_id | uuid                     |           |          |
--  id                         | uuid                     |           | not null | uuid_generate_v4()
--  exam_id                    | uuid                     |           |          |
--  reviewing_stage            | reviewing_stage          |           | not null | 'not_started'::reviewing_stage
-- Indexes:
--     "user_exercise_states_pkey" PRIMARY KEY, btree (id)
--     "user_exercise_states_course_instance_id_idx" btree (course_instance_id)
--     "user_exercise_states_fast_search" btree (user_id, exercise_id, course_instance_id, exam_id, deleted_at)
--     "user_exercise_states_fast_search_2" btree (deleted_at, user_id, selected_exercise_slide_id, reviewing_stage)
--     "user_exercise_states_fast_search_3" btree (deleted_at, exercise_id, reviewing_stage)
-- Check constraints:
--     "course_instance_or_exam_id_set" CHECK ((course_instance_id IS NULL) <> (exam_id IS NULL))
-- Foreign-key constraints:
--     "user_exercise_states_course_instance_id_fkey" FOREIGN KEY (course_instance_id) REFERENCES course_instances(id)
--     "user_exercise_states_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES exams(id)
--     "user_exercise_states_exercise_id_fkey" FOREIGN KEY (exercise_id) REFERENCES exercises(id)
--     "user_exercise_states_selected_exercise_slide_id_fkey" FOREIGN KEY (selected_exercise_slide_id) REFERENCES exercise_slides(id)
--     "user_exercise_states_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id)
-- Referenced by:
--     TABLE "teacher_grading_decisions" CONSTRAINT "teacher_grading_decisions_user_exercise_state_id_fkey" FOREIGN KEY (user_exercise_state_id) REFERENCES user_exercise_states(id)
--     TABLE "user_exercise_slide_states" CONSTRAINT "user_exercise_slide_states_user_exercise_state_id_fkey" FOREIGN KEY (user_exercise_state_id) REFERENCES user_exercise_states(id)
-- Triggers:
--     set_timestamp BEFORE UPDATE ON user_exercise_states FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp()
--                           Table "public.user_course_settings"
--            Column           |           Type           | Collation | Nullable | Default
-- ----------------------------+--------------------------+-----------+----------+---------
--  user_id                    | uuid                     |           | not null |
--  course_language_group_id   | uuid                     |           | not null |
--  created_at                 | timestamp with time zone |           | not null | now()
--  updated_at                 | timestamp with time zone |           | not null | now()
--  deleted_at                 | timestamp with time zone |           |          |
--  current_course_id          | uuid                     |           | not null |
--  current_course_instance_id | uuid                     |           | not null |
-- Indexes:
--     "user_course_settings_pkey" PRIMARY KEY, btree (user_id, course_language_group_id)
-- Foreign-key constraints:
--     "user_course_settings_course_language_group_id_fkey" FOREIGN KEY (course_language_group_id) REFERENCES course_language_groups(id)
--     "user_course_settings_current_course_id_course_language_gro_fkey" FOREIGN KEY (current_course_id, course_language_group_id) REFERENCES courses(id, course_language_group_id)
--     "user_course_settings_current_course_id_fkey" FOREIGN KEY (current_course_id) REFERENCES courses(id)
--     "user_course_settings_current_course_instance_id_fkey" FOREIGN KEY (current_course_instance_id) REFERENCES course_instances(id)
--     "user_course_settings_user_id_current_course_id_current_cou_fkey" FOREIGN KEY (user_id, current_course_id, current_course_instance_id) REFERENCES course_instance_enrollments(user_id, course_id, course_instance_id)
--     "user_course_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id)
-- Triggers:
--     set_timestamp BEFORE UPDATE ON user_course_settings FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp()
--                                   Table "public.course_module_completions"
--                 Column                |           Type           | Collation | Nullable |      Default
-- --------------------------------------+--------------------------+-----------+----------+--------------------
--  id                                   | uuid                     |           | not null | uuid_generate_v4()
--  created_at                           | timestamp with time zone |           | not null | now()
--  updated_at                           | timestamp with time zone |           | not null | now()
--  deleted_at                           | timestamp with time zone |           |          |
--  course_id                            | uuid                     |           | not null |
--  course_module_id                     | uuid                     |           | not null |
--  user_id                              | uuid                     |           | not null |
--  completion_date                      | timestamp with time zone |           | not null |
--  completion_registration_attempt_date | timestamp with time zone |           |          |
--  completion_language                  | character varying(15)    |           | not null |
--  eligible_for_ects                    | boolean                  |           | not null |
--  email                                | character varying(255)   |           | not null |
--  grade                                | integer                  |           |          |
--  passed                               | boolean                  |           | not null |
--  course_instance_id                   | uuid                     |           | not null |
--  prerequisite_modules_completed       | boolean                  |           | not null | false
--  completion_granter_user_id           | uuid                     |           |          |
--  needs_to_be_reviewed                 | boolean                  |           |          |
-- Indexes:
--     "course_module_completions_pkey" PRIMARY KEY, btree (id)
--     "course_module_automatic_completion_uniqueness" UNIQUE, btree (course_module_id, course_instance_id, user_id) WHERE completion_granter_user_id IS NULL AND deleted_at IS NULL
--     "course_module_completions_user_id_idx" btree (user_id)
-- Check constraints:
--     "course_module_completions_completion_language_check" CHECK (completion_language::text ~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?-[A-Z]{2}$'::text)
-- Foreign-key constraints:
--     "course_module_completions_completion_granter_user_id_fkey" FOREIGN KEY (completion_granter_user_id) REFERENCES users(id)
--     "course_module_completions_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id)
--     "course_module_completions_course_instance_id_fkey" FOREIGN KEY (course_instance_id) REFERENCES course_instances(id)
--     "course_module_completions_course_module_id_fkey" FOREIGN KEY (course_module_id) REFERENCES course_modules(id)
--     "course_module_completions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id)
-- Referenced by:
--     TABLE "course_module_completion_registered_to_study_registries" CONSTRAINT "course_module_completion_regis_course_module_completion_id_fkey" FOREIGN KEY (course_module_completion_id) REFERENCES course_module_completions(id)
-- Triggers:
--     set_timestamp BEFORE UPDATE ON course_module_completions FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp()
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
