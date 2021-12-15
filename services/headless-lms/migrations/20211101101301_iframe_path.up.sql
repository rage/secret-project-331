-- Add up migration script here
ALTER TABLE exercise_service_info
ADD COLUMN exercise_type_specific_user_interface_iframe VARCHAR(255) NOT NULL,
  DROP COLUMN submission_iframe_path,
  DROP COLUMN editor_iframe_path,
  DROP COLUMN exercise_iframe_path;
