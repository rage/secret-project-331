ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'ects_initial_reminder';
ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'ects_follow_up_reminder';

ALTER TABLE user_details
  ADD COLUMN ects_email_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN ects_unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;

CREATE TABLE ects_reminder_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  user_id UUID NOT NULL REFERENCES users(id),
  course_module_completion_id UUID NOT NULL REFERENCES course_module_completions(id),
  email_type TEXT NOT NULL CHECK (email_type IN ('initial', 'follow_up')),
  email_delivery_id UUID REFERENCES email_deliveries(id),
  UNIQUE (course_module_completion_id, email_type)
);

CREATE INDEX ON ects_reminder_email_sends (course_module_completion_id);
CREATE INDEX ON ects_reminder_email_sends (email_delivery_id);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON ects_reminder_email_sends FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE ects_reminder_email_sends IS 'Tracks ECTS registration reminder emails sent to Finnish students who have earned ECTS-eligible completions but have not yet registered with the open university.';
COMMENT ON COLUMN ects_reminder_email_sends.email_type IS 'Either ''initial'' (sent shortly after completion) or ''follow_up'' (sent ~14 days later if still unregistered).';
COMMENT ON COLUMN user_details.ects_email_opt_out IS 'When true, no ECTS registration reminder emails will be sent to this user.';
COMMENT ON COLUMN user_details.ects_unsubscribe_token IS 'Token included in ECTS reminder email links to allow one-click unsubscribe without requiring login.';
