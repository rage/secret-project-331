DROP FUNCTION email_template_language(email_templates);
ALTER TABLE email_deliveries DROP COLUMN test_subject,
  DROP COLUMN test_content;
DROP TABLE email_layouts;
