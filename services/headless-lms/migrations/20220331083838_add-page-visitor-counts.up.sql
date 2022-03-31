-- Add up migration script here
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE page_visit_datum_daily_visit_hashing_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  hashing_key BYTEA NOT NULL DEFAULT gen_random_bytes(255),
  date DATE NOT NULL,
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_visit_datum_daily_visit_hashing_keys FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE page_visit_datum_daily_visit_hashing_keys IS 'Stores daily rotated keys used for hashing the anonymous identifiers in page_visit_datum.';
COMMENT ON COLUMN page_visit_datum_daily_visit_hashing_keys.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_visit_datum_daily_visit_hashing_keys.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_visit_datum_daily_visit_hashing_keys.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
CREATE TABLE page_visit_datum (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES course(id),
  page_id UUID NOT NULL REFERENCES pages(id),
  country VARCHAR(255),
  browser VARCHAR(255),
  browser_version VARCHAR(255),
  operating_system VARCHAR(255),
  operating_system_version VARCHAR(255),
  device_type VARCHAR(255),
  referrer VARCHAR(1024),
  is_bot BOOLEAN NOT NULL DEFAULT false,
  anonymous_identifier VARCHAR(255),
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_visit_datum FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE page_visit_datum IS 'An anonymous datum used to count the number of visitors that has viewed a page.';
COMMENT ON COLUMN page_visit_datum.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_visit_datum.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_visit_datum.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN page_visit_datum.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
