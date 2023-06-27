CREATE TABLE page_visit_datum_summary_by_pages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID REFERENCES courses(id),
  exam_id UUID REFERENCES exams(id),
  page_id UUID NOT NULL REFERENCES pages(id),
  country VARCHAR(255),
  device_type VARCHAR(255),
  referrer VARCHAR(1024),
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_term VARCHAR(255),
  utm_content VARCHAR(255),
  num_visitors INTEGER NOT NULL DEFAULT 0,
  visit_date DATE NOT NULL,
  UNIQUE NULLS NOT DISTINCT (
    page_id,
    course_id,
    exam_id,
    country,
    device_type,
    referrer,
    visit_date,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    deleted_at
  ),
  CONSTRAINT exam_xor_course_id CHECK (num_nonnulls(course_id, exam_id) = 1),
  CONSTRAINT num_visitors_positive CHECK (num_visitors >= 0)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_visit_datum_summary_by_pages FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE page_visit_datum_summary_by_pages IS 'Holds an aggregate of page view stats for a given page for a given day. Can be also used to count all visitors to a page if you sum visits from all combinations of columns (including null values).';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.utm_source IS 'The site that sent the traffic like google or facebook';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.utm_medium IS 'The type of traffic, such as email or cost-per-click (cpc)';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.utm_campaign IS 'The campaign name';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.utm_term IS 'The search terms';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.utm_content IS 'Identifies what was clicked';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.page_id IS 'The page that was visited';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.course_id IS 'If the page belongs to a course, the course that the page belongs to.';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.exam_id IS 'If the page belongs to an exam, the exam that the page belongs to.';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.country IS 'Where the visitor is from. Two letter short code e.g. fi';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.device_type IS 'What kind of device the user was using e.g. mobile or pc.';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.referrer IS 'What was the referrer of the visitor. Tells where the visitor came from.';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.num_visitors IS 'The number of visitors that visited the page with the given utm parameters';
COMMENT ON COLUMN page_visit_datum_summary_by_pages.visit_date IS 'The date that the page was visited';
---
CREATE TABLE page_visit_datum_summary_by_courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID REFERENCES courses(id),
  exam_id UUID REFERENCES exams(id),
  country VARCHAR(255),
  device_type VARCHAR(255),
  referrer VARCHAR(1024),
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_term VARCHAR(255),
  utm_content VARCHAR(255),
  num_visitors INTEGER NOT NULL DEFAULT 0,
  visit_date DATE NOT NULL,
  UNIQUE NULLS NOT DISTINCT (
    course_id,
    exam_id,
    country,
    device_type,
    referrer,
    visit_date,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    deleted_at
  ),
  CONSTRAINT exam_xor_course_id CHECK (num_nonnulls(course_id, exam_id) = 1),
  CONSTRAINT num_visitors_positive CHECK (num_visitors >= 0)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_visit_datum_summary_by_courses FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE page_visit_datum_summary_by_courses IS 'Holds an aggregate of page view stats for a whole course for a given day. Can be also used to count all visitors to a course if you sum visits from all combinations of columns (including null values).';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.utm_source IS 'The site that sent the traffic like google or facebook';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.utm_medium IS 'The type of traffic, such as email or cost-per-click (cpc)';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.utm_campaign IS 'The campaign name';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.utm_term IS 'The search terms';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.utm_content IS 'Identifies what was clicked';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.course_id IS 'If the page belongs to a course, the course that the page belongs to.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.exam_id IS 'If the page belongs to an exam, the exam that the page belongs to.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.country IS 'Where the visitor is from. Two letter short code e.g. fi';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.device_type IS 'What kind of device the user was using e.g. mobile or pc.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.referrer IS 'What was the referrer of the visitor. Tells where the visitor came from.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.num_visitors IS 'The number of visitors that visited the page with the given utm parameters';
COMMENT ON COLUMN page_visit_datum_summary_by_courses.visit_date IS 'The date that the page was visited';
---
CREATE TABLE page_visit_datum_summary_by_courses_device_types (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  country VARCHAR(255),
  browser VARCHAR(255),
  browser_version VARCHAR(255),
  operating_system VARCHAR(255),
  operating_system_version VARCHAR(255),
  device_type VARCHAR(255),
  course_id UUID REFERENCES courses(id),
  exam_id UUID REFERENCES exams(id),
  num_visitors INTEGER NOT NULL DEFAULT 0,
  visit_date DATE NOT NULL,
  UNIQUE NULLS NOT DISTINCT (
    course_id,
    exam_id,
    visit_date,
    country,
    browser,
    browser_version,
    operating_system,
    operating_system_version,
    device_type,
    deleted_at
  ),
  CONSTRAINT exam_xor_course_id CHECK (num_nonnulls(course_id, exam_id) = 1),
  CONSTRAINT num_visitors_positive CHECK (num_visitors >= 0)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_visit_datum_summary_by_courses_device_types FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE page_visit_datum_summary_by_courses_device_types IS 'Holds an aggregate of page view stats for a course and country for a given day. If someone visits any page on a course, they will be counted in this stat. Can be also used to count all visitors to a course if you sum visits from all countries.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.country IS 'The country the visitor is from.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.browser IS 'What browser the visitor was using e.g. Firefox.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.browser_version IS 'What what was the version of the browser the visitor was using e.g. 252.0';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.operating_system IS 'What was the visitor''s operating system e.g. Linux';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.operating_system_version IS 'What what was the version of the operating system the visitor was using.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.device_type IS 'What kind of device the user was using e.g. mobile or pc.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.course_id IS 'If the statistic is for a course, the course that the page belongs to.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.exam_id IS 'If the statistic is for an exam, the exam that the page belongs to.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.num_visitors IS 'The number of visitors that visited the page with the given referrer';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_device_types.visit_date IS 'The date that the page was visited';
---
ALTER TABLE page_visit_datum
ADD column utm_source VARCHAR(255);
UPDATE page_visit_datum
SET utm_source = (utm_tags#>>'{}')::jsonb->'utm_source';
---
ALTER TABLE page_visit_datum
ADD column utm_medium VARCHAR(255);
UPDATE page_visit_datum
SET utm_medium = (utm_tags#>>'{}')::jsonb->'utm_medium';
---
ALTER TABLE page_visit_datum
ADD column utm_campaign VARCHAR(255);
UPDATE page_visit_datum
SET utm_campaign = (utm_tags#>>'{}')::jsonb->'utm_campaign';
---
ALTER TABLE page_visit_datum
ADD column utm_term VARCHAR(255);
UPDATE page_visit_datum
SET utm_term = (utm_tags#>>'{}')::jsonb->'utm_term';
---
ALTER TABLE page_visit_datum
ADD column utm_content VARCHAR(255);
UPDATE page_visit_datum
SET utm_content = (utm_tags#>>'{}')::jsonb->'utm_content';
--
ALTER TABLE page_visit_datum DROP COLUMN utm_tags;
