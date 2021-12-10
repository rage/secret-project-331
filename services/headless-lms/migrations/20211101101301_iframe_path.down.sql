-- Add down migration script here
ALTER TABLE exercise_service_info
ADD COLUMN submission_iframe_path VARCHAR(255) NOT NULL,
  ADD COLUMN editor_iframe_path VARCHAR(255) NOT NULL,
  ADD COLUMN exercise_iframe_path VARCHAR(255) NOT NULL,
  DROP COLUMN exercise_type_specific_user_interface_iframe;
