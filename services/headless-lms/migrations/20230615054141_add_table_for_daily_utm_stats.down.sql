DROP TABLE page_visit_datum_summary_by_pages;
DROP TABLE page_visit_datum_summary_by_courses;
DROP TABLE page_visit_datum_summary_by_courses_device_types;
ALTER TABLE page_visit_datum DROP COLUMN utm_source;
ALTER TABLE page_visit_datum DROP COLUMN utm_medium;
ALTER TABLE page_visit_datum DROP COLUMN utm_campaign;
ALTER TABLE page_visit_datum DROP COLUMN utm_term;
ALTER TABLE page_visit_datum DROP COLUMN utm_content;
ALTER TABLE page_visit_datum
ADD COLUMN utm_tags JSONB;
