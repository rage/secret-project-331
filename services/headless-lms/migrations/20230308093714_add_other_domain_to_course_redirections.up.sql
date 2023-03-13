CREATE TABLE other_domain_to_course_redirections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  domain VARCHAR(255) NOT NULL CHECK (
    domain LIKE '%.%'
    AND domain NOT LIKE '%/%'
    AND domain NOT LIKE '% %'
  ),
  course_id UUID NOT NULL REFERENCES courses
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON other_domain_to_course_redirections FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE other_domain_to_course_redirections IS 'Allows to redirect other domains than the site''s main domain to specific courses. For example, For example https://example-course.mooc.fi could redirect one to https://courses.mooc.fi/org/uh-cs/courses/example-course. ';
COMMENT ON COLUMN other_domain_to_course_redirections.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN other_domain_to_course_redirections.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN other_domain_to_course_redirections.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN other_domain_to_course_redirections.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN other_domain_to_course_redirections.domain IS 'Domain that is redirected, for example "example-course.mooc.fi". Has to be just the domain, cannot contain the protocol or the path.';
COMMENT ON COLUMN other_domain_to_course_redirections.course_id IS 'The course where the redirection is going.';