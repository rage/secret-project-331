-- Add up migration script here
CREATE TABLE student_countries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  course_instance_id UUID NOT NULL REFERENCES course_instances(id),
  country_code VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (
    user_id,
    course_id,
    course_instance_id
  ) REFERENCES course_instance_enrollments (user_id, course_id, course_instance_id)
);
COMMENT ON TABLE student_countries IS 'This table stores the country of each student in a course.';
COMMENT ON COLUMN student_countries.user_id IS 'The user that sent the country.';
COMMENT ON COLUMN student_countries.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN student_countries.course_instance_id IS 'The course instance of the course the student partakes in.';
COMMENT ON COLUMN student_countries.country_code IS 'The alpha-2 code of the student country.';
COMMENT ON COLUMN student_countries.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN student_countries.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
