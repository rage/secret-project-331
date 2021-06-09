-- Add up migration script here
CREATE TYPE user_role AS ENUM ('admin', 'assistant', 'teacher', 'reviewer');
CREATE TABLE roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users,
  organization_id UUID REFERENCES organizations,
  course_id UUID REFERENCES courses,
  role user_role NOT NULL
);
