-- Add down migration script here
ALTER TABLE email_deliveries DROP CONSTRAINT email_template_fk;
