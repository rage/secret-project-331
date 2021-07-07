-- Add down migration script here
ALTER TABLE ONLY email_deliveries DROP CONSTRAINT email_template_fk;
