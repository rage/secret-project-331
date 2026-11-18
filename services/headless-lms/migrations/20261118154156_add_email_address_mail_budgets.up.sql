CREATE TABLE email_address_mail_budgets (
  inbox_key BYTEA NOT NULL CHECK (length(inbox_key) = 32),
  day DATE NOT NULL,
  mails_queued INTEGER NOT NULL DEFAULT 1 CHECK (mails_queued > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (inbox_key, day)
);
CREATE INDEX email_address_mail_budgets_day ON email_address_mail_budgets (day);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON email_address_mail_budgets FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE email_address_mail_budgets IS 'How many budgeted account mails (password resets, codes to unproven addresses) each inbox has been sent on a UTC day. Every address variant that reaches the same inbox shares one row. A mail is queued only while the day''s count is under the daily budget. Rows older than two days are hard-deleted.';
COMMENT ON COLUMN email_address_mail_budgets.inbox_key IS 'Keyed HMAC-SHA-256 of the recipient address reduced to its inbox (provider aliases, dots and +tags folded). Not reversible to an address and never used to identify an account.';
COMMENT ON COLUMN email_address_mail_budgets.day IS 'The UTC day the mails were queued on.';
COMMENT ON COLUMN email_address_mail_budgets.mails_queued IS 'Budgeted mails queued to the inbox on the day.';
COMMENT ON COLUMN email_address_mail_budgets.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN email_address_mail_budgets.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
