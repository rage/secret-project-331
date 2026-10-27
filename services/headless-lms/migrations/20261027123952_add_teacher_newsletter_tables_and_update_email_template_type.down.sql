DROP TABLE teacher_newsletter_items;
DROP TABLE teacher_newsletter_subscriptions;

ALTER TYPE email_template_type
RENAME TO email_template_type_old;

CREATE TYPE email_template_type AS ENUM (
  'reset_password_email',
  'delete_user_email',
  'generic',
  'confirm_email_code',
  'credit_registration_account_linking',
  'verify_email_address',
  'credit_registration_action_needed',
  'credit_registration_registered'
);

ALTER TABLE email_templates
ALTER COLUMN email_template_type TYPE email_template_type USING (
    email_template_type::text::email_template_type
  );

DROP TYPE email_template_type_old;
