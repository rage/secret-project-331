-- Add up migration script here
CREATE TYPE user_role AS ENUM ('admin', 'assistant', 'teacher', 'reviewer');
CREATE TABLE roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID,
  course_id UUID,
  role user_role NOT NULL
);
