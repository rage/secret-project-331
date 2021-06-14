-- Add up migration script here
ALTER TABLE roles
ADD created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD deleted_at TIMESTAMPTZ;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON roles FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
