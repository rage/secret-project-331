-- Add up migration script here
DROP INDEX course_instances_has_only_one_default_instance_per_course;
ALTER TABLE course_instances
ADD CONSTRAINT course_instances_has_only_one_default_instance_per_course UNIQUE NULLS NOT DISTINCT (course_id, name, deleted_at);
DROP INDEX unique_chapters_chapter_number_course_id_when_not_deleted;
ALTER TABLE chapters
ADD CONSTRAINT unique_chapters_chapter_number_course_id_when_not_deleted UNIQUE NULLS NOT DISTINCT (chapter_number, course_id, deleted_at);
DROP INDEX exercise_services_unique_slug;
ALTER TABLE exercise_services
ADD CONSTRAINT exercise_services_unique_slug UNIQUE NULLS NOT DISTINCT (slug, deleted_at);
DROP INDEX exercise_slides_order_number_per_exercise;
ALTER TABLE exercise_slides
ADD CONSTRAINT exercise_slides_order_number_per_exercise UNIQUE NULLS NOT DISTINCT (exercise_id, order_number, deleted_at);
DROP INDEX user_exercise_slide_state_uniqueness;
ALTER TABLE user_exercise_slide_states
ADD CONSTRAINT user_exercise_slide_state_uniqueness UNIQUE NULLS NOT DISTINCT (
    user_exercise_state_id,
    exercise_slide_id,
    deleted_at
  );
DROP INDEX courses_slug_key_when_not_deleted;
ALTER TABLE courses
ADD CONSTRAINT courses_slug_key_when_not_deleted UNIQUE NULLS NOT DISTINCT (slug, deleted_at);
DROP INDEX old_url_pathold_url_path_uniqueness;
ALTER TABLE url_redirections
ADD CONSTRAINT old_url_pathold_url_path_uniqueness UNIQUE NULLS NOT DISTINCT (course_id, old_url_path, deleted_at);
DROP INDEX exercise_tasks_order_number_uniqueness;
ALTER TABLE exercise_tasks
ADD CONSTRAINT exercise_tasks_order_number_uniqueness UNIQUE NULLS NOT DISTINCT (exercise_slide_id, order_number, deleted_at);
DROP INDEX courses_have_only_one_default_peer_review;
ALTER TABLE peer_review_configs
ADD CONSTRAINT courses_have_only_one_default_peer_review UNIQUE NULLS NOT DISTINCT (course_id, exercise_id, deleted_at);
DROP INDEX peer_review_question_order_number_uniqueness;
ALTER TABLE peer_review_questions
ADD CONSTRAINT peer_review_question_order_number_uniqueness UNIQUE NULLS NOT DISTINCT (peer_review_config_id, order_number, deleted_at);
DROP INDEX citation_key_uniqueness;
ALTER TABLE material_references
ADD CONSTRAINT citation_key_uniqueness UNIQUE NULLS NOT DISTINCT (course_id, citation_key, deleted_at);
DROP INDEX peer_review_submissions_course_instance_submission_uniqueness;
ALTER TABLE peer_review_submissions
ADD CONSTRAINT peer_review_submissions_course_instance_submission_uniqueness UNIQUE NULLS NOT DISTINCT (
    user_id,
    course_instance_id,
    exercise_slide_submission_id,
    deleted_at
  );
DROP INDEX course_modules_order_number_uniqueness;
ALTER TABLE course_modules
ADD CONSTRAINT course_modules_order_number_uniqueness UNIQUE NULLS NOT DISTINCT (course_id, order_number, deleted_at);
DROP INDEX no_duplicate_keys_exam;
DROP INDEX no_duplicate_keys_instance;
ALTER TABLE user_course_instance_exercise_service_variables
ADD CONSTRAINT no_duplicate_keys_instance UNIQUE NULLS NOT DISTINCT (
    variable_key,
    user_id,
    course_instance_id,
    exercise_service_slug,
    exam_id,
    deleted_at
  );
DROP INDEX peer_review_queue_entry_user_exercise_and_course_instance_uniqu;
ALTER TABLE peer_review_queue_entries
ADD CONSTRAINT peer_review_queue_entry_user_exercise_and_course_instance_uniqu UNIQUE NULLS NOT DISTINCT (
    user_id,
    exercise_id,
    course_instance_id,
    deleted_at
  );
DROP INDEX unique_background_question_answers;
ALTER TABLE course_background_question_answers
ADD CONSTRAINT unique_background_question_answers UNIQUE NULLS NOT DISTINCT (
    course_background_question_id,
    user_id,
    deleted_at
  );
DROP INDEX course_language_group_id_and_language_code_uniqueness;
ALTER TABLE courses
ADD CONSTRAINT course_language_group_id_and_language_code_uniqueness UNIQUE NULLS NOT DISTINCT (
    course_language_group_id,
    language_code,
    deleted_at
  );
DROP INDEX pages_order_number_uniqueness;
ALTER TABLE pages
ADD CONSTRAINT pages_order_number_uniqueness UNIQUE NULLS NOT DISTINCT (
    course_id,
    exam_id,
    chapter_id,
    order_number,
    deleted_at
  );
DROP INDEX unique_pages_url_path_course_id_when_not_deleted;
ALTER TABLE pages
ADD CONSTRAINT unique_pages_url_path_course_id_when_not_deleted UNIQUE NULLS NOT DISTINCT (url_path, exam_id, course_id, deleted_at);
