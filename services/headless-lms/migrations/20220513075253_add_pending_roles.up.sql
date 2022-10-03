CREATE TABLE pending_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_email VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  course_id UUID references courses(id),
  course_instance_id UUID references course_instances(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + interval '2 weeks'
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON pending_roles FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE pending_roles IS 'A role that will be added for a user once they login to the system. Limited to course and course instance roles for security reasons';
COMMENT ON COLUMN pending_roles.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN pending_roles.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN pending_roles.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN pending_roles.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN pending_roles.user_email IS 'Email the role will be granted to.';
COMMENT ON COLUMN pending_roles.role IS 'The role to be granted.';
COMMENT ON COLUMN pending_roles.course_id IS 'The course the role is for';
COMMENT ON COLUMN pending_roles.course_instance_id IS 'The course instance the role is for';
COMMENT ON COLUMN pending_roles.course_instance_id IS 'When the pending role expires. Expiration is important to minimize the chance of someone impersonating a user.';
ALTER TABLE pending_roles
ADD CONSTRAINT single_role_for_domain CHECK (num_nonnulls(course_instance_id, course_id) = 1);
