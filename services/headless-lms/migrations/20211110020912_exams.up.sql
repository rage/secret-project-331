-- Add up migration script here
CREATE TABLE exams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  organization_id UUID NOT NULL REFERENCES organizations,
  name VARCHAR(255) NOT NULL,
  opens_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER
);
COMMENT ON TABLE exams IS 'An exam is a special set of exercises with a common deadline.';
COMMENT ON COLUMN exams.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exams.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN exams.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exams.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN exams.name IS 'A name for the exam to differentiate it from other exams.';
COMMENT ON COLUMN exams.opens_at IS 'The timestamp after which the exam can be started.';
COMMENT ON COLUMN exams.duration_minutes IS 'The duration the exam stays open after it has been started.';
CREATE TABLE course_exams (
  course_id UUID NOT NULL REFERENCES courses,
  exam_id UUID NOT NULL REFERENCES exams,
  PRIMARY KEY (course_id, exam_id)
);
COMMENT ON TABLE course_exams IS 'Links exams to courses.';
COMMENT ON COLUMN course_exams.course_id IS 'The id of a course the exam is associated with.';
COMMENT ON COLUMN course_exams.exam_id IS 'The id of an exam.';
CREATE TABLE exam_enrollments (
  user_id UUID NOT NULL REFERENCES users,
  exam_id UUID NOT NULL REFERENCES exams,
  started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (user_id, exam_id)
);
COMMENT ON TABLE exam_enrollments IS 'Stores which users are enrolled in which exams and related data.';
COMMENT ON COLUMN exam_enrollments.user_id IS 'The user that has enrolled in the exam.';
COMMENT ON COLUMN exam_enrollments.exam_id IS 'The exam the user has enrolled in.';
COMMENT ON COLUMN exam_enrollments.started_at IS 'The moment the user started the exam.';
COMMENT ON COLUMN exam_enrollments.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN exam_enrollments.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exam_enrollments.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
ALTER TABLE pages ALTER course_id DROP NOT NULL,
  ADD exam_id UUID REFERENCES exams,
  ADD CONSTRAINT course_or_exam_id_set CHECK ((course_id IS NULL) <> (exam_id IS NULL));
COMMENT ON COLUMN pages.exam_id IS 'The exam the page is associated with.';
COMMENT ON CONSTRAINT course_or_exam_id_set ON pages IS 'A page must be associated with either a course or an exam.';
ALTER TABLE exercises ALTER course_id DROP NOT NULL,
  ADD exam_id UUID REFERENCES exams,
  ADD CONSTRAINT course_or_exam_id_set CHECK ((course_id IS NULL) <> (exam_id IS NULL));
COMMENT ON COLUMN exercises.exam_id IS 'The exam the exercise is associated with.';
COMMENT ON CONSTRAINT course_or_exam_id_set ON exercises IS 'An exercise must be associated with either a course or an exam.';
ALTER TABLE user_exercise_states DROP CONSTRAINT user_exercise_states_pkey,
  ADD id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ALTER course_instance_id DROP NOT NULL,
  ADD exam_id UUID REFERENCES exams,
  ADD CONSTRAINT course_instance_or_exam_id_set CHECK (
    (course_instance_id IS NULL) <> (exam_id IS NULL)
  );
COMMENT ON COLUMN user_exercise_states.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN user_exercise_states.exam_id IS 'The exam the user exercise state is associated with.';
COMMENT ON CONSTRAINT course_instance_or_exam_id_set ON user_exercise_states IS 'A user exercise state must be associated with either a course instance or an exam.';
ALTER TABLE submissions ALTER course_id DROP NOT NULL,
  ALTER course_instance_id DROP NOT NULL,
  ADD exam_id UUID REFERENCES exams,
  ADD CONSTRAINT course_instance_or_exam_id_set CHECK ((course_id IS NULL) <> (exam_id IS NULL));
COMMENT ON COLUMN submissions.exam_id IS 'The exam the submission is associated with.';
COMMENT ON CONSTRAINT course_instance_or_exam_id_set ON submissions IS 'A submission must be associated with either a course instance or an exam.';
ALTER TABLE gradings ALTER course_id DROP NOT NULL,
  ADD exam_id UUID REFERENCES exams,
  ADD CONSTRAINT course_or_exam_id_set CHECK ((course_id IS NULL) <> (exam_id IS NULL));
COMMENT ON COLUMN gradings.exam_id IS 'The exam the grading is associated with.';
COMMENT ON CONSTRAINT course_or_exam_id_set ON gradings IS 'A grading must be associated with either a course or an exam.';
ALTER TABLE feedback ALTER course_id DROP NOT NULL,
  ADD exam_id UUID REFERENCES exams,
  ADD CONSTRAINT course_or_exam_id_set CHECK ((course_id IS NULL) <> (exam_id IS NULL));
COMMENT ON COLUMN feedback.exam_id IS 'The exam the feedback is associated with.';
COMMENT ON CONSTRAINT course_or_exam_id_set ON feedback IS 'A feedback must be associated with either a course or an exam.';
ALTER TABLE roles
ADD exam_id UUID REFERENCES exams;
COMMENT ON COLUMN roles.exam_id IS 'The exam the role is associated with.';
