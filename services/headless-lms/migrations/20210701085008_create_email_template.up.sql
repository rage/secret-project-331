-- Add up migration script here
CREATE TABLE email_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  content JSONB,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  exercise_completions_threshold INTEGER,
  points_threshold INTEGER,
  course_instance_id UUID REFERENCES course_instances NOT NULL,
  CHECK (TRIM(subject) <> '')
);
COMMENT ON TABLE email_templates IS 'An email template table, which contains the email subject and content written in the Gutenberg Editor. Supports adding exercise points/completions threshold templates for course instances.';
