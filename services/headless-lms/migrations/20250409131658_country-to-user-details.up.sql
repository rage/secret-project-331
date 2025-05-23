ALTER TABLE user_details
ADD COLUMN country VARCHAR(255);

COMMENT ON COLUMN user_details.country IS 'The country that the user has provided to the system.';
