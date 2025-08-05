ALTER TABLE user_details
ADD COLUMN email_communication_consent BOOLEAN NOT NULL DEFAULT FALSE;


COMMENT ON COLUMN user_details.email_communication_consent IS 'Whether user has given consent to receive emails related to MOOC.fi courses and the development of the learning environment';
