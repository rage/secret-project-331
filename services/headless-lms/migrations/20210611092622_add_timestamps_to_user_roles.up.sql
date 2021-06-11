-- Add up migration script here
ALTER TABLE roles
ADD created_at TIMESTAMP NOT NULL DEFAULT now(),
  ADD updated_at TIMESTAMP NOT NULL DEFAULT now(),
  ADD deleted_at TIMESTAMP;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON roles FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
