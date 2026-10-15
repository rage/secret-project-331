DROP TABLE staff_security_verified_networks;
DROP TABLE staff_security_verified_browsers;

-- Enum values cannot be dropped; move rows off them so the values are at least unused.
DELETE FROM user_email_codes
WHERE purpose = 'network_verification';
UPDATE email_templates
SET deleted_at = now()
WHERE email_template_type = 'verify_network'
  AND deleted_at IS NULL;
