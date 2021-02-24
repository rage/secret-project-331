-- Add down migration script here
CREATE TABLE submissions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON submissions
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
