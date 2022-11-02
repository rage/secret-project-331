-- Add down migration script here
ALTER TABLE course_modules DROP column completion_registration_link_override;
