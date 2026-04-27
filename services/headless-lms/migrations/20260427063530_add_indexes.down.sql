DROP INDEX page_history_page_id_created_at_id_idx;

CREATE INDEX page_history_page_id_created_at_idx ON page_history (page_id, created_at DESC)
WHERE deleted_at IS NULL;

DROP INDEX user_details_email_trgm_idx;

DROP INDEX user_details_search_helper_gist;
ALTER TABLE user_details DROP COLUMN search_helper;
ALTER TABLE user_details
ADD COLUMN search_helper TEXT GENERATED ALWAYS AS (
    lower(
      REPLACE(
        user_id::text || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(email, ''),
        '  ',
        ' '
      )
    )
  ) STORED;
COMMENT ON COLUMN user_details.search_helper IS 'A generated helper column that allows us to efficiently search for users by name or email.';
CREATE INDEX user_details_search_helper_gist ON user_details USING gist (search_helper gist_trgm_ops);
CREATE INDEX user_details_search_helper_lower ON user_details (lower(search_helper));

DROP INDEX exercise_slide_submissions_user_id_exercise_slide_id_idx;

CREATE INDEX exercise_slide_submissions_user_id_exercise_slide_id_idx ON exercise_slide_submissions (user_id, exercise_slide_id);

DROP INDEX exercise_task_submissions_slide_submission_id_slide_id_idx;

DROP INDEX user_course_exercise_service_variables_user_id_course_id_idx;

DROP INDEX course_module_completions_user_id_course_id_idx;

DROP INDEX course_specific_consent_form_answers_course_id_user_id_idx;

DROP INDEX chatbot_conversation_messages_citations_conversation_id_idx;
