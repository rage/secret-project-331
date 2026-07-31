-- The three live-table reverts come last, and have to: the email_deliveries cleanup cannot run until
-- the new tables referencing it are gone.

-- Enum values cannot be removed, so the type is rebuilt without them. Templates of a retired type
-- are soft-deleted rather than relabelled: email_deliveries reference them, and a live 'generic'
-- template carrying credit-registration body text would be picked up by unrelated sends. deleted_at
-- has to differ per row because unique_email_templates_type_language_general keys on
-- (email_template_type, language, deleted_at) NULLS NOT DISTINCT.
UPDATE email_templates t
SET email_template_type = 'generic',
  deleted_at = now() + (r.n * INTERVAL '1 microsecond')
FROM (
    SELECT id,
      row_number() OVER (
        ORDER BY id
      ) AS n
    FROM email_templates
    WHERE email_template_type IN (
        'credit_registration_account_linking',
        'verify_email_address',
        'credit_registration_action_needed',
        'credit_registration_registered',
        'credit_registration_student_number_linked'
      )
  ) r
WHERE t.id = r.id;

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

-- Legacy pull-flow rows are attributed to the 'Default Registrar' the seeds create, so this DELETE
-- cannot reach them.
DELETE FROM course_module_completion_registered_to_study_registries
WHERE study_registry_registrar_id = '9da5a12f-0b96-4c35-a4fe-6d427d9c4292';

DELETE FROM study_registry_registrars
WHERE id = '9da5a12f-0b96-4c35-a4fe-6d427d9c4292';

DROP TABLE IF EXISTS credit_registration_daily_snapshots;

DROP TABLE IF EXISTS credit_registration_phase_state;

DROP TABLE IF EXISTS open_university_product_access_tokens;

DROP TABLE IF EXISTS credit_registration_admin_actions;

DROP TABLE IF EXISTS credit_registration_events;

DROP TABLE IF EXISTS suotar_api_calls;

DROP TABLE IF EXISTS credit_registrations;

DROP TYPE IF EXISTS credit_registration_admin_action_target;

DROP TYPE IF EXISTS credit_registration_admin_action;

DROP TYPE IF EXISTS suotar_endpoint;

DROP TYPE IF EXISTS credit_registration_event_kind;

DROP TYPE IF EXISTS credit_registration_error_code;

DROP TYPE IF EXISTS credit_registration_state;

DROP TABLE IF EXISTS course_credit_registration_consents;

DROP TABLE IF EXISTS credit_registration_account_linking_emails;

DROP TABLE IF EXISTS student_number_verification_tokens;

DROP TABLE IF EXISTS verified_student_numbers;

DROP TYPE IF EXISTS student_number_verification_method;

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

-- Deliveries addressed to a raw address cannot be represented once user_id is mandatory again, so
-- they go; email_delivery_errors cascades and the ledger that referenced them was dropped above.
DELETE FROM email_deliveries
WHERE user_id IS NULL;

ALTER TABLE email_deliveries DROP CONSTRAINT IF EXISTS email_deliveries_has_exactly_one_recipient;

ALTER TABLE email_deliveries DROP COLUMN IF EXISTS recipient_email,
  DROP COLUMN IF EXISTS placeholders;

ALTER TABLE email_deliveries
ALTER COLUMN user_id
SET NOT NULL;

COMMENT ON COLUMN email_deliveries.user_id IS 'The user to whom the email should be sent to. If the email template contains dynamic portions with user-specific information (like a grade from a course) this user_id will be used to derive the information.';

-- password_reset_backfill is written by the up migration's backfill and nothing else, so clearing by
-- method cannot discard a proof that came from somewhere stronger.
UPDATE user_details
SET email_verified_at = NULL,
  email_verified_method = NULL
WHERE email_verified_method = 'password_reset_backfill';

DROP TRIGGER IF EXISTS clear_email_verification ON user_details;

DROP FUNCTION IF EXISTS clear_email_verification_on_email_change();

ALTER TABLE user_details DROP CONSTRAINT IF EXISTS user_details_email_verification_consistent;

ALTER TABLE user_details DROP COLUMN IF EXISTS email_verified_at,
  DROP COLUMN IF EXISTS email_verified_method;

DROP TYPE IF EXISTS email_verification_method;

-- After the trigger function above, which reads user_email_codes.purpose.
DROP INDEX IF EXISTS unique_active_user_email_codes_user;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_user_email_codes_user ON user_email_codes(user_id, code)
WHERE deleted_at IS NULL
  AND used_at IS NULL;

ALTER TABLE user_email_codes DROP COLUMN IF EXISTS purpose,
  DROP COLUMN IF EXISTS attempt_count;

DROP TYPE IF EXISTS user_email_code_purpose;

COMMENT ON TABLE user_email_codes IS 'Stores single-use codes for actions like user account deletion verification.';
