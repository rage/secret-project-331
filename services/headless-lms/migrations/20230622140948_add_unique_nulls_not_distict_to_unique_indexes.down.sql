-- Add down migration script here
ALTER TABLE course_instances DROP CONSTRAINT course_instances_has_only_one_default_instance_per_course;
CREATE UNIQUE INDEX course_instances_has_only_one_default_instance_per_course ON course_instances USING btree (course_id)
WHERE (
    (deleted_at IS NULL)
    AND (name IS NULL)
  );
ALTER TABLE chapters DROP CONSTRAINT unique_chapters_chapter_number_course_id_when_not_deleted;
CREATE UNIQUE INDEX unique_chapters_chapter_number_course_id_when_not_deleted ON chapters USING btree (chapter_number, course_id)
WHERE (deleted_at IS NULL);
ALTER TABLE exercise_services DROP CONSTRAINT exercise_services_unique_slug;
CREATE UNIQUE INDEX exercise_services_unique_slug ON exercise_services USING btree (slug)
WHERE (deleted_at IS NULL);
ALTER TABLE exercise_slides DROP CONSTRAINT exercise_slides_order_number_per_exercise;
CREATE UNIQUE INDEX exercise_slides_order_number_per_exercise ON exercise_slides USING btree (exercise_id, order_number)
WHERE (deleted_at IS NULL);
ALTER TABLE user_exercise_slide_states DROP CONSTRAINT user_exercise_slide_state_uniqueness;
CREATE UNIQUE INDEX user_exercise_slide_state_uniqueness ON user_exercise_slide_states USING btree (user_exercise_state_id, exercise_slide_id)
WHERE (deleted_at IS NULL);
ALTER TABLE courses DROP CONSTRAINT courses_slug_key_when_not_deleted;
CREATE UNIQUE INDEX courses_slug_key_when_not_deleted ON courses USING btree (slug)
WHERE (deleted_at IS NOT NULL);
ALTER TABLE url_redirections DROP CONSTRAINT old_url_pathold_url_path_uniqueness;
CREATE UNIQUE INDEX old_url_pathold_url_path_uniqueness ON url_redirections USING btree (course_id, old_url_path)
WHERE (deleted_at IS NULL);
ALTER TABLE exercise_tasks DROP CONSTRAINT exercise_tasks_order_number_uniqueness;
CREATE UNIQUE INDEX exercise_tasks_order_number_uniqueness ON exercise_tasks USING btree (exercise_slide_id, order_number)
WHERE (deleted_at IS NULL);
ALTER TABLE peer_review_configs DROP CONSTRAINT courses_have_only_one_default_peer_review;
CREATE UNIQUE INDEX courses_have_only_one_default_peer_review ON peer_review_configs USING btree (course_id)
WHERE (
    (deleted_at IS NULL)
    AND (exercise_id IS NULL)
  );
ALTER TABLE peer_review_questions DROP CONSTRAINT peer_review_question_order_number_uniqueness;
CREATE UNIQUE INDEX peer_review_question_order_number_uniqueness ON peer_review_questions USING btree (peer_review_config_id, order_number)
WHERE (deleted_at IS NULL);
ALTER TABLE material_references DROP CONSTRAINT citation_key_uniqueness;
CREATE UNIQUE INDEX citation_key_uniqueness ON material_references USING btree (course_id, citation_key)
WHERE (deleted_at IS NULL);
ALTER TABLE peer_review_submissions DROP CONSTRAINT peer_review_submissions_course_instance_submission_uniqueness;
CREATE UNIQUE INDEX peer_review_submissions_course_instance_submission_uniqueness ON peer_review_submissions USING btree (
  user_id,
  course_instance_id,
  exercise_slide_submission_id
)
WHERE (deleted_at IS NULL);
ALTER TABLE course_modules DROP CONSTRAINT course_modules_order_number_uniqueness;
CREATE UNIQUE INDEX course_modules_order_number_uniqueness ON course_modules USING btree (course_id, order_number)
WHERE (deleted_at IS NULL);
ALTER TABLE course_module_completions DROP CONSTRAINT course_module_automatic_completion_uniqueness;
CREATE UNIQUE INDEX course_module_automatic_completion_uniqueness ON course_module_completions USING btree (course_module_id, course_instance_id, user_id)
WHERE (
    (completion_granter_user_id IS NULL)
    AND (deleted_at IS NULL)
  );
ALTER TABLE user_course_instance_exercise_service_variables DROP CONSTRAINT no_duplicate_keys_instance;
CREATE UNIQUE INDEX no_duplicate_keys_instance ON user_course_instance_exercise_service_variables USING btree (
  variable_key,
  user_id,
  course_instance_id,
  exercise_service_slug
)
WHERE (
    (deleted_at IS NULL)
    AND (course_instance_id IS NOT NULL)
  );
CREATE UNIQUE INDEX no_duplicate_keys_exam ON user_course_instance_exercise_service_variables USING btree (
  variable_key,
  user_id,
  exam_id,
  exercise_service_slug
)
WHERE (
    (deleted_at IS NULL)
    AND (exam_id IS NOT NULL)
  );
ALTER TABLE peer_review_queue_entries DROP CONSTRAINT peer_review_queue_entry_user_exercise_and_course_instance_uniqu;
CREATE UNIQUE INDEX peer_review_queue_entry_user_exercise_and_course_instance_uniqu ON peer_review_queue_entries USING btree (user_id, exercise_id, course_instance_id)
WHERE (deleted_at IS NULL);
ALTER TABLE course_background_question_answers DROP CONSTRAINT unique_background_question_answers;
CREATE UNIQUE INDEX unique_background_question_answers ON course_background_question_answers USING btree (course_background_question_id, user_id)
WHERE (deleted_at IS NULL);
ALTER TABLE courses DROP CONSTRAINT course_language_group_id_and_language_code_uniqueness;
CREATE UNIQUE INDEX course_language_group_id_and_language_code_uniqueness ON courses USING btree (course_language_group_id, language_code)
WHERE (deleted_at IS NULL);
ALTER TABLE pages DROP CONSTRAINT pages_order_number_uniqueness;
CREATE UNIQUE INDEX pages_order_number_uniqueness ON pages USING btree (chapter_id, order_number)
WHERE (deleted_at IS NULL);
ALTER TABLE pages DROP CONSTRAINT unique_pages_url_path_course_id_when_not_deleted;
CREATE UNIQUE INDEX unique_pages_url_path_course_id_when_not_deleted ON pages USING btree (url_path, course_id)
WHERE (deleted_at IS NULL);
