CREATE TABLE course_module_completion_certificates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users,
  course_module_id UUID NOT NULL REFERENCES course_modules,
  course_instance_id UUID NOT NULL REFERENCES course_instances,
  name_on_certificate VARCHAR(512) NOT NULL,
  verification_id VARCHAR(512) UNIQUE NOT NULL
);
COMMENT ON TABLE course_module_completion_certificates IS 'A certificate generated for a student to provide proof that they have completed a given course module.';
COMMENT ON COLUMN course_module_completion_certificates.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_module_completion_certificates.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_module_completion_certificates.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_module_completion_certificates.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_module_completion_certificates.user_id IS 'The user for which the certificate belongs to.';
COMMENT ON COLUMN course_module_completion_certificates.course_module_id IS 'The course module that the certificate is for.';
COMMENT ON COLUMN course_module_completion_certificates.course_instance_id IS 'The course instance that the certificate is for.';
COMMENT ON COLUMN course_module_completion_certificates.name_on_certificate IS 'The name displayed on the certificate.';
COMMENT ON COLUMN course_module_completion_certificates.verification_id IS 'An identifier that can be used to verify the validity of the certificate.';
ALTER TABLE course_modules
ADD COLUMN certification_enabled BOOLEAN DEFAULT FALSE NOT NULL;
COMMENT ON COLUMN course_modules.certification_enabled IS 'If true, certificates can be generated for this course module.';