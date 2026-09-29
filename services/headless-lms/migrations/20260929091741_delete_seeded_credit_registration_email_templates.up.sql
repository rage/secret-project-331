-- Only a database migrated just now: production already sent mails with these templates.
DELETE FROM email_templates
WHERE email_template_type IN ('credit_registration_action_needed', 'credit_registration_registered')
  AND course_id IS NULL
  AND created_at > NOW() - INTERVAL '5 minutes';
