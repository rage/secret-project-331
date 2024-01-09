-- Add back the course_instance_id and course_module_id columns to the certificate_configurations table
ALTER TABLE certificate_configurations
ADD COLUMN course_instance_id UUID REFERENCES course_instances(id);
ALTER TABLE certificate_configurations
ADD COLUMN course_module_id UUID REFERENCES course_modules(id);
-- Move the requirements from the join table back to the certificate_configurations table
UPDATE certificate_configurations cc
SET course_instance_id = cctr.course_instance_id,
  course_module_id = cctr.course_module_id
FROM certificate_configuration_to_requirements cctr
WHERE cc.id = cctr.certificate_configuration_id
  AND cc.deleted_at IS NULL;
-- Delete the records from the join table
DROP TABLE certificate_configuration_to_requirements;
-- Add back the course_instance_id and course_module_id columns to the generated_certificates table
ALTER TABLE generated_certificates
ADD COLUMN course_instance_id UUID REFERENCES course_instances(id);
ALTER TABLE generated_certificates
ADD COLUMN course_module_id UUID REFERENCES course_modules(id);
-- Update the course_instance_id and course_module_id columns in the generated_certificates table
UPDATE generated_certificates gc
SET course_instance_id = cc.course_instance_id,
  course_module_id = cc.course_module_id
FROM certificate_configurations cc
WHERE gc.certificate_configuration_id = cc.id;
-- DROP the not needed certificate_configuration_id column
ALTER TABLE generated_certificates DROP COLUMN certificate_configuration_id;
-- Rename the tables back to the original names
ALTER TABLE certificate_configurations
  RENAME TO course_module_certificate_configurations;
ALTER TABLE generated_certificates
  RENAME TO course_module_completion_certificates;
