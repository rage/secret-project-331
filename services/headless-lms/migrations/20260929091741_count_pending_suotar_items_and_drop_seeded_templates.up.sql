DELETE FROM email_templates
WHERE email_template_type IN ('credit_registration_action_needed', 'credit_registration_registered')
  AND course_id IS NULL
  AND created_at > NOW() - INTERVAL '5 minutes';

ALTER TABLE suotar_api_calls
ADD COLUMN pending_item_count INT NOT NULL DEFAULT 0;
COMMENT ON COLUMN suotar_api_calls.pending_item_count IS 'How many items the response answered with "not yet, check again later", such as a submission Sisu has not shown or an enrolment the student has not made. Counted apart from error_item_count.';
COMMENT ON COLUMN suotar_api_calls.error_item_count IS 'How many items the response rejected, not counting the ones counted in pending_item_count.';
