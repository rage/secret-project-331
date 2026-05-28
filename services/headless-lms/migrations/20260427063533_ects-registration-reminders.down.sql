DROP TABLE IF EXISTS ects_reminder_email_sends;

ALTER TABLE user_details
  DROP COLUMN IF EXISTS ects_email_opt_out,
  DROP COLUMN IF EXISTS ects_unsubscribe_token;
