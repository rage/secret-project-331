-- Add up migration script here
CREATE TABLE exams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE TABLE course_exams (
  course_id UUID NOT NULL REFERENCES courses,
  exam_id UUID NOT NULL REFERENCES exams,
  PRIMARY KEY (course_id, exam_id)
);
CREATE TABLE exam_enrollments (
  user_id UUID NOT NULL REFERENCES users,
  exam_id UUID NOT NULL REFERENCES exams,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (user_id, exam_id)
);
ALTER TABLE pages ALTER course_id DROP NOT NULL,
  ADD exam_id UUID REFERENCES exams,
  ADD CONSTRAINT course_or_exam_id_set CHECK ((course_id IS NULL) <> (exam_id IS NULL));
ALTER TABLE exercises ALTER course_id DROP NOT NULL,
  ADD exam_id UUID REFERENCES exams;
ALTER TABLE user_exercise_states DROP CONSTRAINT user_exercise_states_pkey,
  ADD id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ALTER course_instance_id DROP NOT NULL,
  ADD exam_id UUID REFERENCES exams;
ALTER TABLE submissions ALTER course_id DROP NOT NULL,
  ALTER course_instance_id DROP NOT NULL,
  ADD exam_id UUID REFERENCES exams;
ALTER TABLE gradings ALTER course_id DROP NOT NULL,
  ADD exam_id UUID REFERENCES exams;
ALTER TABLE feedback ALTER course_id DROP NOT NULL,
  ADD exam_id UUID REFERENCES exams;
ALTER TABLE roles
ADD exam_id UUID REFERENCES exams;
