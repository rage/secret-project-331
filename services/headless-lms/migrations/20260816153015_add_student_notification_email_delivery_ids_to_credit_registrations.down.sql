DROP INDEX IF EXISTS idx_credit_registrations_unnotified;

ALTER TABLE credit_registrations DROP COLUMN action_needed_email_delivery_id,
  DROP COLUMN registered_email_delivery_id;
