-- Add up migration script here
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE page_visit_datum_daily_visit_hashing_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  hashing_key BYTEA NOT NULL DEFAULT gen_random_bytes(255),
  valid_for_date DATE NOT NULL UNIQUE
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_visit_datum_daily_visit_hashing_keys FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE page_visit_datum_daily_visit_hashing_keys IS 'Stores daily rotated keys used for hashing the anonymous identifiers in page_visit_datum.';
COMMENT ON COLUMN page_visit_datum_daily_visit_hashing_keys.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_visit_datum_daily_visit_hashing_keys.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_visit_datum_daily_visit_hashing_keys.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN page_visit_datum_daily_visit_hashing_keys.valid_for_date IS 'The date when this specific hashing key is used.';
CREATE TABLE page_visit_datum (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID REFERENCES courses(id),
  exam_id UUID REFERENCES exams(id),
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
  utm_tags JSONB
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_visit_datum FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE page_visit_datum IS 'An anonymous piece of data used to count the number of visitors that has viewed a page.';
COMMENT ON COLUMN page_visit_datum.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_visit_datum.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_visit_datum.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN page_visit_datum.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN page_visit_datum.course_id IS 'Redundant, same information available though pages.course_id.';
COMMENT ON COLUMN page_visit_datum.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted. Here to make some queries easier.';
COMMENT ON COLUMN page_visit_datum.exam_id IS 'Redundant, same information available though pages.exam_id. Here to make some queries easier.';
COMMENT ON COLUMN page_visit_datum.exam_id IS 'The page that was visited.';
COMMENT ON COLUMN page_visit_datum.country IS 'Where the visitor is from. Two letter short code e.g. fi';
COMMENT ON COLUMN page_visit_datum.browser IS 'What browser the visitor was using e.g. Firefox.';
COMMENT ON COLUMN page_visit_datum.browser_version IS 'What what was the version of the browser the visitor was using e.g. 252.0';
COMMENT ON COLUMN page_visit_datum.operating_system IS 'What was the visitor''s operating system e.g. Linux';
COMMENT ON COLUMN page_visit_datum.operating_system_version IS 'What what was the version of the operating system the visitor was using.';
COMMENT ON COLUMN page_visit_datum.device_type IS 'What kind of device the user was using e.g. mobile or pc.';
COMMENT ON COLUMN page_visit_datum.referrer IS 'What was the referrer of the visitor. Tells where the visitor came from.';
COMMENT ON COLUMN page_visit_datum.is_bot IS 'Whether the user was detected to be a bot. The detection is not foolproof but it''s useful enough for example for excluding the bots from the statistics.';
COMMENT ON COLUMN page_visit_datum.anonymous_identifier IS 'An anonymous identifier of the user that is reversible and is not traceable to the user or their ip. It is hashed using a daily rotating hashing key, meaning this identifier changes for all visitors every day. The identifier is also unique for each course.';
COMMENT ON COLUMN page_visit_datum.utm_tags IS 'Values of the utm_* tags that were in the url of the browser requesting this page. Could be used to measure the effectiveness of different kind of campagns.';
