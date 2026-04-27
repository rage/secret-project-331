CREATE INDEX IF NOT EXISTS user_details_search_helper_gist ON user_details USING gist (search_helper gist_trgm_ops);

-- The email search uses lower(email) LIKE '%x%' which needs a trigram index;
-- a plain B-tree index cannot serve leading-wildcard patterns.
CREATE INDEX IF NOT EXISTS user_details_email_trgm_idx ON user_details USING gist (lower(email::text) gist_trgm_ops);

CREATE INDEX IF NOT EXISTS chatbot_conversation_messages_citations_conversation_id_idx ON chatbot_conversation_messages_citations (conversation_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS course_specific_consent_form_answers_course_id_user_id_idx ON course_specific_consent_form_answers (course_id, user_id);

CREATE INDEX IF NOT EXISTS course_module_completions_user_id_course_id_idx ON course_module_completions (user_id, course_id);

CREATE INDEX IF NOT EXISTS user_course_exercise_service_variables_user_id_course_id_idx ON user_course_exercise_service_variables (user_id, course_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS exercise_task_submissions_slide_submission_id_slide_id_idx ON exercise_task_submissions (exercise_slide_submission_id, exercise_slide_id)
WHERE deleted_at IS NULL;

-- Replacement index. In production, create this with CONCURRENTLY before applying
-- this migration, then drop the old index using the concurrent form.
CREATE INDEX IF NOT EXISTS exercise_slide_submissions_user_id_exercise_slide_id_partial_idx ON exercise_slide_submissions (user_id, exercise_slide_id)
WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS exercise_slide_submissions_user_id_exercise_slide_id_idx;

-- Replacement index. In production, create this with CONCURRENTLY before applying
-- this migration, then drop the old index using the concurrent form.
CREATE INDEX IF NOT EXISTS page_history_page_id_created_at_id_idx ON page_history (page_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS page_history_page_id_created_at_idx;
