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
