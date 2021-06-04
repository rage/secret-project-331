-- Add up migration script here
CREATE TABLE course_parts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name  VARCHAR(255) NOT NULL,
  course_id UUID REFERENCES courses NOT NULL,
  part_number INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(part_number, course_id)
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON course_parts
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
