-- Add up migration script here
CREATE TABLE email_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  content JSONB NOT NULL,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  exercise_completions_threshold INTEGER,
  points_threshold INTEGER,
  course_instance_id UUID REFERENCES course_instances NOT NULL,
  CHECK (TRIM(subject) <> '')
);
