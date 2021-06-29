CREATE TABLE email_deliveries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  email_template_id UUID,
  error VARCHAR(255) DEFAULT NULL,
  sent BOOLEAN DEFAULT FALSE,
  user_id UUID,
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON email_deliveries FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE table_templates IS 'An email delivery table, which contains info about if an email has been sent to an user or if it failed';