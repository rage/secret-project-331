DROP INDEX idx_oauth_user_client_scopes_user;
DROP INDEX user_course_settings_user_id_idx;

CREATE INDEX peer_or_self_review_submissions_user_id_exercise_id_idx ON peer_or_self_review_submissions (user_id, exercise_id);

CREATE INDEX user_exercise_states_course_id_idx ON user_exercise_states (course_id);

CREATE INDEX page_history_page_id_created_at_idx ON page_history (page_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX user_marketing_consents_course_language_group_id_idx ON user_marketing_consents (course_language_group_id);

CREATE INDEX marketing_mailing_list_access_tokens_course_language_group_id_i ON marketing_mailing_list_access_tokens (course_language_group_id)
WHERE deleted_at IS NULL;

CREATE INDEX page_visit_datum_created_at_is_bot_idx ON page_visit_datum (created_at, is_bot)
WHERE deleted_at IS NULL;

CREATE INDEX peer_review_queue_entries_course_id_created_at_idx ON peer_review_queue_entries (course_id, created_at)
WHERE deleted_at IS NULL;

CREATE INDEX exercise_slide_submissions_course_id_user_id_idx ON exercise_slide_submissions (course_id, user_id)
WHERE deleted_at IS NULL;
