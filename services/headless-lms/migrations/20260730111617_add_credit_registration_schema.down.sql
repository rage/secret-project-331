-- Reverses the credit registration schema, in the mirror of the up migration's order.
-- The up migration adds a trigger to user_details and drops none, so there is no pre-existing
-- trigger to recreate here.
-- 17. Enum values cannot be removed, so the type is rebuilt without them. Any template that took a
-- new type falls back to generic rather than being deleted, because email_deliveries reference it.
UPDATE email_templates
SET email_template_type = 'generic'
WHERE email_template_type IN (
    'credit_registration_account_linking',
    'verify_email_address',
    'credit_registration_action_needed',
    'credit_registration_registered',
    'credit_registration_student_number_linked'
  );

CREATE TYPE email_template_type_old AS ENUM (
  'reset_password_email',
  'delete_user_email',
  'generic',
  'confirm_email_code'
);

ALTER TABLE email_templates
ALTER COLUMN email_template_type TYPE email_template_type_old USING (
    email_template_type::text::email_template_type_old
  );

DROP TYPE email_template_type;

ALTER TYPE email_template_type_old
RENAME TO email_template_type;

COMMENT ON TYPE email_template_type IS 'Type of email template: generic templates do not support automated placeholder replacements, others do.';

-- 16. The push registrar and anything it registered.
DELETE FROM course_module_completion_registered_to_study_registries
WHERE study_registry_registrar_id = '9da5a12f-0b96-4c35-a4fe-6d427d9c4292';

DELETE FROM study_registry_registrars
WHERE id = '9da5a12f-0b96-4c35-a4fe-6d427d9c4292';

-- 15 and 14. Operational tables.
DROP TABLE IF EXISTS credit_registration_daily_snapshots;

DROP TABLE IF EXISTS credit_registration_phase_state;

-- 13. Per-module configuration.
DROP TABLE IF EXISTS course_module_suotar_realisations;

DROP INDEX IF EXISTS idx_course_modules_suotar_enabled;

ALTER TABLE course_modules DROP COLUMN IF EXISTS enable_credit_registration_via_suotar,
  DROP COLUMN IF EXISTS open_university_product_id,
  DROP COLUMN IF EXISTS credit_registration_grade_scale_id,
  DROP COLUMN IF EXISTS credit_registration_paused_at,
  DROP COLUMN IF EXISTS credit_registration_paused_by_user_id,
  DROP COLUMN IF EXISTS credit_registration_pause_reason,
  DROP COLUMN IF EXISTS credit_registration_config_checked_at,
  DROP COLUMN IF EXISTS credit_registration_course_code_resolves,
  DROP COLUMN IF EXISTS credit_registration_product_token_found,
  DROP COLUMN IF EXISTS credit_registration_config_check_message;

-- 12 down to 8. The ledger and its satellites, dropped before the enums they use.
DROP TABLE IF EXISTS open_university_product_access_tokens;

DROP TABLE IF EXISTS credit_registration_admin_actions;

DROP TABLE IF EXISTS credit_registration_events;

DROP TABLE IF EXISTS suotar_api_calls;

DROP TABLE IF EXISTS credit_registrations;

-- 7. Ledger enums.
DROP TYPE IF EXISTS credit_registration_admin_action_target;

DROP TYPE IF EXISTS credit_registration_admin_action;

DROP TYPE IF EXISTS suotar_endpoint;

DROP TYPE IF EXISTS credit_registration_event_kind;

DROP TYPE IF EXISTS credit_registration_error_code;

DROP TYPE IF EXISTS credit_registration_state;

-- 6 down to 3. Consents, linking mail ledger, tokens, links.
DROP TABLE IF EXISTS course_credit_registration_consents;

DROP TABLE IF EXISTS credit_registration_account_linking_emails;

DROP TABLE IF EXISTS student_number_verification_tokens;

DROP TABLE IF EXISTS verified_student_numbers;

DROP TYPE IF EXISTS student_number_verification_method;

-- 2b. Email-ownership tokens. Dropped before the email_deliveries revert below, whose DELETE of
-- raw-address deliveries would otherwise trip this table's foreign key.
DROP TABLE IF EXISTS email_ownership_verification_tokens;

-- 2. user_details email-ownership verification.
DROP TRIGGER IF EXISTS clear_email_verification ON user_details;

DROP FUNCTION IF EXISTS clear_email_verification_on_email_change();

DROP INDEX IF EXISTS idx_user_details_verified_email;

ALTER TABLE user_details DROP CONSTRAINT IF EXISTS user_details_email_verification_consistent;

ALTER TABLE user_details DROP COLUMN IF EXISTS email_verified_at,
  DROP COLUMN IF EXISTS email_verified_method;

DROP TYPE IF EXISTS email_verification_method;

-- 1. email_deliveries. Deliveries addressed to a raw address cannot be represented once user_id is
-- mandatory again, so they go; email_delivery_errors cascades and the linking-mail ledger that
-- referenced them was already dropped above.
DELETE FROM email_deliveries
WHERE user_id IS NULL;

DROP INDEX IF EXISTS email_deliveries_recipient_email_idx;

ALTER TABLE email_deliveries DROP CONSTRAINT IF EXISTS email_deliveries_has_exactly_one_recipient;

ALTER TABLE email_deliveries DROP COLUMN IF EXISTS recipient_email,
  DROP COLUMN IF EXISTS placeholders;

ALTER TABLE email_deliveries
ALTER COLUMN user_id
SET NOT NULL;

COMMENT ON COLUMN email_deliveries.user_id IS 'The user to whom the email should be sent to. If the email template contains dynamic portions with user-specific information (like a grade from a course) this user_id will be used to derive the information.';
