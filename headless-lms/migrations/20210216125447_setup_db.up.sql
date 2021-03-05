-- Add up migration script here
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
    NEW.updated_at = now();
    RETURN NEW;
ELSE
    RETURN OLD;
END IF;
END;
$$ language 'plpgsql';


-- organizations
CREATE TABLE organizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name  VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- courses
CREATE TABLE courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name  VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  organization_id UUID REFERENCES organizations NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON courses
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- submissions
CREATE TABLE submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON submissions
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- exercises
CREATE TABLE exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  content JSONB,
  course_id UUID REFERENCES courses NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON exercises
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- exercise_line_items
CREATE TABLE exercise_line_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  exercise_id UUID REFERENCES exercises NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON exercise_line_items
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- pages
CREATE TABLE pages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  course_id UUID REFERENCES courses NOT NULL,
  content JSONB NOT NULL,
  url_path VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(url_path, deleted)
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON pages
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
