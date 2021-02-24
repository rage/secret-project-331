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


CREATE TABLE courses (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name  VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON courses
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
