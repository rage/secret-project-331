-- Enum values cannot be removed, so the type is rebuilt without them. Templates of a retired type
-- are soft-deleted rather than relabelled: email_deliveries reference them, and a live 'generic'
-- template carrying credit-registration body text would be picked up by unrelated sends. deleted_at
-- has to differ per row because unique_email_templates_type_language_general keys on
-- (email_template_type, language, deleted_at) NULLS NOT DISTINCT.
UPDATE email_templates t
SET email_template_type = 'generic',
  deleted_at = NOW() - (r.n * INTERVAL '1 microsecond')
FROM (
    SELECT id,
      row_number() OVER (
        ORDER BY id
      ) AS n
    FROM email_templates
    WHERE email_template_type = 'teacher_newsletter'
  ) r
WHERE t.id = r.id;

CREATE TYPE email_template_type_old AS ENUM (
  'reset_password_email',
  'delete_user_email',
  'generic',
  'confirm_email_code',
  'credit_registration_account_linking',
  'verify_email_address',
  'credit_registration_action_needed',
  'credit_registration_registered',
  'verify_network',
  'course_designer_weekly_digest'
);

ALTER TABLE email_templates
ALTER COLUMN email_template_type TYPE email_template_type_old USING (
    email_template_type::text::email_template_type_old
  );

DROP TYPE email_template_type;

ALTER TYPE email_template_type_old
RENAME TO email_template_type;

DROP TABLE teacher_newsletter_items;
DROP TABLE teacher_newsletter_subscriptions;
DROP TABLE teacher_newsletter_delivery;
