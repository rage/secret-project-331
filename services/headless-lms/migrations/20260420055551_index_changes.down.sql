DROP INDEX exercise_slide_submissions_course_id_user_id_idx;

DROP INDEX peer_review_queue_entries_course_id_created_at_idx;

DROP INDEX page_visit_datum_created_at_is_bot_idx;

DROP INDEX marketing_mailing_list_access_tokens_course_language_group_id_i;

DROP INDEX user_marketing_consents_course_language_group_id_idx;

DROP INDEX page_history_page_id_created_at_idx;

DROP INDEX user_exercise_states_course_id_idx;

DROP INDEX peer_or_self_review_submissions_user_id_exercise_id_idx;

CREATE INDEX idx_oauth_user_client_scopes_user ON oauth_user_client_scopes (user_id);

COMMENT ON INDEX idx_oauth_user_client_scopes_user IS 'Speeds queries by user across remembered consents.';

CREATE INDEX IF NOT EXISTS user_course_settings_user_id_idx ON user_course_settings (user_id);
