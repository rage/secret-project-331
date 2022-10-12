CREATE TABLE user_course_instance_exercise_service_variables (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  exercise_service_slug VARCHAR(255) NOT NULL,
  user_id UUID references users NOT NULL,
  course_instance_id UUID references course_instances,
  exam_id UUID references exams,
  variable_key varchar(255) NOT NULL,
  variable_value JSONB NOT NULL,
  CHECK ((course_instance_id IS NULL) <> (exam_id IS NULL))
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_course_instance_exercise_service_variables FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE user_course_instance_exercise_service_variables IS 'An example';
COMMENT ON COLUMN user_course_instance_exercise_service_variables.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN user_course_instance_exercise_service_variables.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN user_course_instance_exercise_service_variables.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_course_instance_exercise_service_variables.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN user_course_instance_exercise_service_variables.exercise_service_slug IS 'Identifier for the exercise service type that stored this variable. The same identifier needs to exist in exercise_services.slug for the variable to work.';
COMMENT ON COLUMN user_course_instance_exercise_service_variables.user_id IS 'The user the variable was created for.';
COMMENT ON COLUMN user_course_instance_exercise_service_variables.course_instance_id IS 'The course instance the variable is scoped to. Each variable is only visible in the current course instance to prevent other courses or other course instances from interfering with each other. Either course_instance_id or exam_id must be set.';
COMMENT ON COLUMN user_course_instance_exercise_service_variables.exam_id IS 'The variable can be alternatively scoped to an exam instead of the exercise service. Either course_instance_id or exam_id must be set.';
COMMENT ON COLUMN user_course_instance_exercise_service_variables.variable_key IS 'Key used to set or to access the variable.';
COMMENT ON COLUMN user_course_instance_exercise_service_variables.variable_value IS 'The thing being stored.';

-- We don't have this yet in postgres 14: https://blog.rustprooflabs.com/2022/07/postgres-15-unique-improvement-with-null
-- Either exam id or course instance id is always null, enforced with a constraint.
CREATE UNIQUE INDEX no_duplicate_keys_instance ON user_course_instance_exercise_service_variables (variable_key, user_id, course_instance_id, exercise_service_slug) WHERE deleted_at IS NULL AND course_instance_id IS NOT NULL;
CREATE UNIQUE INDEX no_duplicate_keys_exam ON user_course_instance_exercise_service_variables (variable_key, user_id, exam_id, exercise_service_slug) WHERE deleted_at IS NULL AND exam_id IS NOT NULL;
