UPDATE credit_registrations
SET action_needed_email_delivery_id = NULL
WHERE action_needed_email_delivery_id IN (
    SELECT ed.id
    FROM email_deliveries ed
      JOIN email_templates et ON et.id = ed.email_template_id
    WHERE et.email_template_type IN ('credit_registration_action_needed', 'credit_registration_registered')
      AND et.course_id IS NULL
  );

UPDATE credit_registrations
SET registered_email_delivery_id = NULL
WHERE registered_email_delivery_id IN (
    SELECT ed.id
    FROM email_deliveries ed
      JOIN email_templates et ON et.id = ed.email_template_id
    WHERE et.email_template_type IN ('credit_registration_action_needed', 'credit_registration_registered')
      AND et.course_id IS NULL
  );

DELETE FROM email_deliveries
WHERE email_template_id IN (
    SELECT id
    FROM email_templates
    WHERE email_template_type IN ('credit_registration_action_needed', 'credit_registration_registered')
      AND course_id IS NULL
  );

DELETE FROM email_templates
WHERE email_template_type IN ('credit_registration_action_needed', 'credit_registration_registered')
  AND course_id IS NULL;
