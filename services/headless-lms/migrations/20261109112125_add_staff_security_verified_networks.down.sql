DROP TABLE staff_security_verified_networks;
DROP TABLE staff_security_verified_browsers;

-- Enum values cannot be dropped; move rows off them so the values are at least unused.
DELETE FROM user_email_codes
WHERE purpose = 'network_verification';
UPDATE email_templates
SET deleted_at = now()
WHERE email_template_type = 'verify_network'
  AND deleted_at IS NULL;

COMMENT ON TABLE user_email_codes IS 'Single-use codes emailed to a user to prove they can read their own mailbox before an action: the administrator login second factor, account deletion, and email address ownership verification. At most one live code per user per purpose; requesting a new one retires the old.';
