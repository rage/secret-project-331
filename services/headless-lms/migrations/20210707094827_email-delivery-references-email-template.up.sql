-- Add up migration script here
ALTER TABLE email_deliveries
ADD CONSTRAINT email_template_fk FOREIGN KEY (email_template_id) REFERENCES email_templates (id) MATCH FULL;
