-- Rebuild search_helper:
--   1. Keep exact substring search for both first-name last-name and last-name first-name input.
--   2. Drop the unused lower(search_helper) btree index; trigram GiST serves LIKE and distance queries.
-- Stored generated columns require immutable expressions, so do not use concat_ws.
DROP INDEX user_details_search_helper_gist;
DROP INDEX user_details_search_helper_lower;
ALTER TABLE user_details DROP COLUMN search_helper;
ALTER TABLE user_details
ADD COLUMN search_helper TEXT GENERATED ALWAYS AS (
    lower(
      REPLACE(
        user_id::text || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(email, ''),
        '  ',
        ' '
      )
    )
  ) STORED;
COMMENT ON COLUMN user_details.search_helper IS 'Helps us to search users with one trigram-indexed column. It contains user id, email, first-name last-name, and last-name first-name; both names are intentionally repeated so partial name searches work in either order.';
CREATE INDEX user_details_search_helper_gist ON user_details USING gist (search_helper gist_trgm_ops);

-- The email search uses lower(email) LIKE '%x%' which needs a trigram index;
-- a plain B-tree (users_email) cannot serve leading-wildcard patterns.
CREATE INDEX user_details_email_trgm_idx ON user_details USING gist (lower(email::text) gist_trgm_ops);

CREATE INDEX chatbot_conversation_messages_citations_conversation_id_idx ON chatbot_conversation_messages_citations (conversation_id)
WHERE deleted_at IS NULL;

CREATE INDEX course_specific_consent_form_answers_course_id_user_id_idx ON course_specific_consent_form_answers (course_id, user_id);

CREATE INDEX course_module_completions_user_id_course_id_idx ON course_module_completions (user_id, course_id);

CREATE INDEX user_course_exercise_service_variables_user_id_course_id_idx ON user_course_exercise_service_variables (user_id, course_id)
WHERE deleted_at IS NULL;

CREATE INDEX exercise_task_submissions_slide_submission_id_slide_id_idx ON exercise_task_submissions (exercise_slide_submission_id, exercise_slide_id)
WHERE deleted_at IS NULL;

-- Make the (user_id, exercise_slide_id) index partial so deleted_at IS NULL is
-- enforced at the index level instead of as a post-heap-fetch filter.
DROP INDEX exercise_slide_submissions_user_id_exercise_slide_id_idx;

CREATE INDEX exercise_slide_submissions_user_id_exercise_slide_id_idx ON exercise_slide_submissions (user_id, exercise_slide_id)
WHERE deleted_at IS NULL;

-- Replace the (page_id, created_at DESC) index with one that also covers id DESC,
-- so the full ORDER BY (page_id, created_at DESC, id DESC) used by DISTINCT ON queries
-- can be satisfied from the index alone, eliminating the sort step.
DROP INDEX page_history_page_id_created_at_idx;

CREATE INDEX page_history_page_id_created_at_id_idx ON page_history (page_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL;
