-- 1. Create types for module completion grades
CREATE TYPE grade_scale_id AS ENUM ('sis_0_5', 'sis_pass_fail');
CREATE TYPE grade_local_id AS ENUM('0', '1', '2', '3', '4', '5');
-- 2. Create function for calculating passed value
CREATE FUNCTION check_grade_passed(scale grade_scale_id, grade grade_local_id) RETURNS BOOLEAN AS $$ BEGIN CASE
  scale
  WHEN 'sis_0_5' THEN RETURN grade <> '0';
WHEN 'sis_pass_fail' THEN RETURN grade <> '0';
ELSE RETURN false;
END CASE
;
END;
$$ LANGUAGE 'plpgsql' IMMUTABLE;
-- 3. Create table course_module_completions
CREATE TABLE course_module_completions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  course_module_id UUID NOT NULL REFERENCES course_modules(id),
  user_id UUID NOT NULL REFERENCES users(id),
  completion_date TIMESTAMP WITH TIME ZONE NOT NULL,
  completion_registration_attempt_date TIMESTAMP WITH TIME ZONE,
  completion_language VARCHAR(255) NOT NULL,
  eligible_for_ects BOOLEAN NOT NULL,
  email VARCHAR(255) NOT NULL,
  grade_scale_id grade_scale_id NOT NULL,
  grade_local_id grade_local_id NOT NULL,
  passed BOOLEAN GENERATED ALWAYS AS (
    check_grade_passed(grade_scale_id, grade_local_id)
  ) STORED NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_module_completions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_module_completions IS 'Internal student completions for course modules.';
COMMENT ON COLUMN course_module_completions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_module_completions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_module_completions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_module_completions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_module_completions.course_id IS 'Course that the completion is a part of.';
COMMENT ON COLUMN course_module_completions.course_module_id IS 'Part of a course that the completion is for.';
COMMENT ON COLUMN course_module_completions.user_id IS 'User who the completion is registered for.';
COMMENT ON COLUMN course_module_completions.completion_date IS 'The date when the student completed the course. The value of this field is the date that will end up in the user''s study registry as the completion date. If the completion is created automatically, it is the date when the student passed the completion thresholds. If the teacher creates these completions manually, the teacher inputs this value. Usually the teacher would in this case input the date of the exam.';
COMMENT ON COLUMN course_module_completions.completion_registration_attempt_date IS 'Date when the student opened the form to register their credits to the open university.';
COMMENT ON COLUMN course_module_completions.completion_language IS 'The language used in the completion of the course.';
COMMENT ON COLUMN course_module_completions.eligible_for_ects IS 'Whether or not the student can receive study credits for this completion.';
COMMENT ON COLUMN course_module_completions.email IS 'Email at the time of completing the course. Used to match the student to the data that they will fill to the open university and it will remain unchanged in the event of email change because changing this would break the matching.';
COMMENT ON COLUMN course_module_completions.grade_scale_id IS 'Grading scale used when deciding whether the grade counts as passed or failed.';
COMMENT ON COLUMN course_module_completions.grade_local_id IS 'Grade for completion. Always a numeric value, that is interpreted according to grade_scale_id.';
COMMENT ON COLUMN course_module_completions.passed IS 'Whether or not the completion is valid for credits. Generated from grade_scale_id and grade_local_id.';
-- 4. Create table study_registry_registrars
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
-- 5. Create table course_module_completion_study_registry_registrations
CREATE TABLE course_module_completion_study_registry_registrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  course_module_completion_id UUID NOT NULL REFERENCES course_module_completions(id),
  course_module_id UUID NOT NULL REFERENCES course_modules(id),
  study_registry_registrar_id UUID NOT NULL REFERENCES study_registry_registrars(id),
  user_id UUID NOT NULL REFERENCES users(id),
  real_student_number VARCHAR(255) NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_module_completion_study_registry_registrations FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_module_completion_study_registry_registrations IS 'Completed course module completion registrations to study registries.';
COMMENT ON COLUMN course_module_completion_study_registry_registrations.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_module_completion_study_registry_registrations.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_module_completion_study_registry_registrations.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_module_completion_study_registry_registrations.course_id IS 'Course that the completion is a part of.';
COMMENT ON COLUMN course_module_completion_study_registry_registrations.course_module_completion_id IS 'Course module completion for this registation.';
COMMENT ON COLUMN course_module_completion_study_registry_registrations.course_module_id IS 'Course module that the related course module completion is based on.';
COMMENT ON COLUMN course_module_completion_study_registry_registrations.study_registry_registrar_id IS 'Registrar that registered this course module completion.';
COMMENT ON COLUMN course_module_completion_study_registry_registrations.user_id IS 'User that the related course module completion is based on.';
COMMENT ON COLUMN course_module_completion_study_registry_registrations.real_student_number IS 'Used by administrators and support staff to confirm the completion was registered to the correct student';
