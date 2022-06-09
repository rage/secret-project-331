-- 1. Add table course_module_completions
CREATE TABLE course_module_completions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  course_module_id UUID NOT NULL REFERENCES course_modules(id),
  user_id UUID NOT NULL REFERENCES users(id),
  completion_date TIMESTAMP WITH TIME ZONE,
  completion_registration_attempt_date TIMESTAMP WITH TIME ZONE,
  eligible_for_ects BOOLEAN NOT NULL,
  email VARCHAR(255) NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_module_completions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_module_completions IS '';
COMMENT ON COLUMN course_module_completions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_module_completions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_module_completions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_module_completions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_module_completions.course_id IS 'Course that the completion is a part of.';
COMMENT ON COLUMN course_module_completions.course_module_id IS 'Part of a course that the completion is for.';
COMMENT ON COLUMN course_module_completions.user_id IS 'User who the completion is registered for.';
COMMENT ON COLUMN course_module_completions.completion_date IS 'The date when a teacher has manually marked the course module as completed. For example, this may be the day of when an exam for the course took place.';
COMMENT ON COLUMN course_module_completions.completion_registration_attempt_date IS 'For courses with a student self-registration. As per convention stated in course materials, this is actually the date of the course registration.';
COMMENT ON COLUMN course_module_completions.eligible_for_ects IS 'Whether or not the student can receive study credits for this completion.';
COMMENT ON COLUMN course_module_completions.email IS 'Email at the time of completing the course. Used to match the student to the data that they will fill to the open university and it will remain unchanged in the event of email change because changing this would break the matching.';
-- 2. Add table study_registry_registrars
CREATE TABLE study_registry_registrars (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  secret_key VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON study_registry_registrars FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE study_registry_registrars IS 'Authorized third parties that can access course module completions for study registration purposes.';
COMMENT ON COLUMN study_registry_registrars.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN study_registry_registrars.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN study_registry_registrars.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN study_registry_registrars.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN study_registry_registrars.secret_key IS 'The secret key used to authenticate for the registry.';
COMMENT ON COLUMN study_registry_registrars.name IS 'The name of the registrar.';
