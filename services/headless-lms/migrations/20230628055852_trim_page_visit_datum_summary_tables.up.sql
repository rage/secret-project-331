DELETE FROM page_visit_datum_summary_by_courses;
ALTER TABLE page_visit_datum_summary_by_courses DROP COLUMN device_type;
ALTER TABLE page_visit_datum_summary_by_courses DROP COLUMN country;
DELETE FROM page_visit_datum_summary_by_courses_device_types;
ALTER TABLE page_visit_datum_summary_by_courses_device_types DROP COLUMN country;
ALTER TABLE page_visit_datum_summary_by_courses_device_types DROP COLUMN operating_system_version;
DELETE FROM page_visit_datum_summary_by_pages;
ALTER TABLE page_visit_datum_summary_by_pages DROP COLUMN country;
ALTER TABLE page_visit_datum_summary_by_pages DROP COLUMN device_type;
ALTER TABLE page_visit_datum_summary_by_pages DROP COLUMN referrer;
ALTER TABLE page_visit_datum_summary_by_pages DROP COLUMN utm_source;
ALTER TABLE page_visit_datum_summary_by_pages DROP COLUMN utm_medium;
ALTER TABLE page_visit_datum_summary_by_pages DROP COLUMN utm_campaign;
ALTER TABLE page_visit_datum_summary_by_pages DROP COLUMN utm_content;
ALTER TABLE page_visit_datum_summary_by_pages DROP COLUMN utm_term;
-- constraints
ALTER TABLE page_visit_datum_summary_by_pages
ADD CONSTRAINT pvdsbp_no_duplicate_data UNIQUE NULLS NOT DISTINCT (
    page_id,
    course_id,
    exam_id,
    visit_date,
    deleted_at
  );
ALTER TABLE page_visit_datum_summary_by_courses
ADD CONSTRAINT pvdsbc_no_duplicate_data UNIQUE NULLS NOT DISTINCT (
    course_id,
    exam_id,
    referrer,
    visit_date,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    deleted_at
  );
ALTER TABLE page_visit_datum_summary_by_courses_device_types
ADD CONSTRAINT pvdsbcdt_no_duplicate_data UNIQUE NULLS NOT DISTINCT (
    course_id,
    exam_id,
    visit_date,
    browser,
    browser_version,
    operating_system,
    device_type,
    deleted_at
  );
-- new table for countries
CREATE TABLE page_visit_datum_summary_by_courses_countries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  country VARCHAR(255),
  course_id UUID REFERENCES courses(id),
  exam_id UUID REFERENCES exams(id),
  num_visitors INTEGER NOT NULL DEFAULT 0,
  visit_date DATE NOT NULL,
  UNIQUE NULLS NOT DISTINCT (
    course_id,
    exam_id,
    visit_date,
    country,
    deleted_at
  ),
  CONSTRAINT exam_xor_course_id CHECK (num_nonnulls(course_id, exam_id) = 1),
  CONSTRAINT num_visitors_positive CHECK (num_visitors >= 0)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_visit_datum_summary_by_courses_countries FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE page_visit_datum_summary_by_courses_countries IS 'Holds an aggregate of page view stats for a course and country for a given day. If someone visits any page on a course, they will be counted in this stat. Can be also used to count all visitors to a course if you sum visits from all countries.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_countries.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_countries.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_countries.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_countries.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_countries.country IS 'The country the visitor is from.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_countries.course_id IS 'If the statistic is for a course, the course that the page belongs to.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_countries.exam_id IS 'If the statistic is for an exam, the exam that the page belongs to.';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_countries.num_visitors IS 'The number of visitors that visited the page with the given referrer';
COMMENT ON COLUMN page_visit_datum_summary_by_courses_countries.visit_date IS 'The date that the page was visited';
-----
COMMENT ON TABLE page_visit_datum_summary_by_courses_device_types IS 'Holds an aggregate of page view stats for a course and differnet types of devices for a given day. For example, this table can be used to figure out what browsers people are using on the courses usually.';
