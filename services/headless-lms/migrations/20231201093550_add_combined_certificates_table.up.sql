ALTER TABLE course_module_certificate_configurations
  RENAME TO certificate_configurations;
ALTER TABLE course_module_completion_certificates
  RENAME TO generated_certificates;
-- A certificate can be for many courses and for many modules. Conversely, course may have many certificates
-- We will handle this many-to-many relationship with a join table
CREATE TABLE certificate_configuration_to_requirements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  certificate_configuration_id UUID NOT NULL REFERENCES certificate_configurations(id),
  course_instance_id UUID REFERENCES course_instances(id),
  course_module_id UUID REFERENCES course_modules(id)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON certificate_configuration_to_requirements FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE certificate_configuration_to_requirements IS 'A join table that can be used to figure out what course modules and course instances are required to be completed to be eligible for a specific certificate. To find out all requirements one will need to query for all rows that match a certificate configuration id. Note that this is the correct table if you want a certificate to relate to a course or to courses because all courses have course modules and course instances.';
COMMENT ON COLUMN certificate_configuration_to_requirements.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN certificate_configuration_to_requirements.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN certificate_configuration_to_requirements.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN certificate_configuration_to_requirements.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN certificate_configuration_to_requirements.certificate_configuration_id IS 'Identifies the certificate this requirement is for.';
COMMENT ON COLUMN certificate_configuration_to_requirements.course_instance_id IS 'If defined, the referred course instance is a requirement for this certificate. If multiple course instances are a requirement for a certificate (multiple rows in this table), the user has to complete all of those course instances.';
COMMENT ON COLUMN certificate_configuration_to_requirements.course_module_id IS 'If defined, the referred course module is a requirement for this certificate. If multiple course modules are a requirement for a certificate (multiple rows in this table), the user has to complete all of those course modules.';
-- Generated certificates cannot no longer refer directly refer to the requirements as there may be many of them
-- We'll migrate the table to refer to the configuration instead
ALTER TABLE generated_certificates
ADD COLUMN certificate_configuration_id UUID REFERENCES certificate_configurations(id);
UPDATE generated_certificates gs
SET certificate_configuration_id = (
    SELECT id
    FROM certificate_configurations cc
    WHERE cc.course_instance_id = gs.course_instance_id
      AND cc.course_module_id = gs.course_module_id
  );
ALTER TABLE generated_certificates
ALTER COLUMN certificate_configuration_id
SET NOT NULL;
ALTER TABLE generated_certificates DROP COLUMN course_instance_id;
ALTER TABLE generated_certificates DROP COLUMN course_module_id;
-- Move the requirements from the certificate configurations table to the new join table
INSERT INTO certificate_configuration_to_requirements (
    certificate_configuration_id,
    course_instance_id,
    course_module_id
  )
SELECT id,
  course_instance_id,
  course_module_id
FROM certificate_configurations
WHERE deleted_at IS NULL;
ALTER TABLE certificate_configurations DROP COLUMN course_instance_id;
ALTER TABLE certificate_configurations DROP COLUMN course_module_id;
