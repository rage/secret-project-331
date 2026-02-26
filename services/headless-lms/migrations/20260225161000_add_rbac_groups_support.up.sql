CREATE TABLE groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  CHECK (TRIM(name) <> '')
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON groups FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE groups IS 'Organization-level RBAC groups for assigning roles to multiple users at once.';
COMMENT ON COLUMN groups.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN groups.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN groups.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN groups.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN groups.organization_id IS 'The organization this group belongs to.';
COMMENT ON COLUMN groups.name IS 'The group name. Unique within an organization among active rows (case-insensitive).';
CREATE INDEX groups_organization_id_deleted_at_idx ON groups (organization_id, deleted_at);
CREATE UNIQUE INDEX groups_organization_id_lower_name_deleted_at_unique_idx
ON groups (organization_id, LOWER(name), deleted_at) NULLS NOT DISTINCT;

CREATE TABLE group_memberships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  group_id UUID NOT NULL REFERENCES groups(id),
  user_id UUID NOT NULL REFERENCES users(id),
  CONSTRAINT group_memberships_group_id_user_id_deleted_at_key UNIQUE NULLS NOT DISTINCT (group_id, user_id, deleted_at)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON group_memberships FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE group_memberships IS 'Memberships that connect users to organization groups.';
COMMENT ON COLUMN group_memberships.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN group_memberships.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN group_memberships.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN group_memberships.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN group_memberships.group_id IS 'The group the user belongs to.';
COMMENT ON COLUMN group_memberships.user_id IS 'The user who belongs to the group.';
CREATE INDEX group_memberships_group_id_deleted_at_idx ON group_memberships (group_id, deleted_at);
CREATE INDEX group_memberships_user_id_deleted_at_idx ON group_memberships (user_id, deleted_at);

CREATE TABLE group_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  group_id UUID NOT NULL REFERENCES groups(id),
  role user_role NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  course_id UUID REFERENCES courses(id),
  course_instance_id UUID REFERENCES course_instances(id),
  exam_id UUID REFERENCES exams(id),
  CONSTRAINT group_roles_single_domain CHECK (
    num_nonnulls(organization_id, course_id, course_instance_id, exam_id) = 1
  ),
  CONSTRAINT group_roles_group_role_domain_deleted_at_key UNIQUE NULLS NOT DISTINCT (
    group_id,
    role,
    organization_id,
    course_id,
    course_instance_id,
    exam_id,
    deleted_at
  )
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON group_roles FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE group_roles IS 'RBAC role assignments for groups in non-global scopes.';
COMMENT ON COLUMN group_roles.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN group_roles.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN group_roles.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN group_roles.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN group_roles.group_id IS 'The group receiving the role assignment.';
COMMENT ON COLUMN group_roles.role IS 'The role granted to the group.';
COMMENT ON COLUMN group_roles.organization_id IS 'Organization scope for the role assignment. Exactly one domain column must be non-null.';
COMMENT ON COLUMN group_roles.course_id IS 'Course scope for the role assignment. Exactly one domain column must be non-null.';
COMMENT ON COLUMN group_roles.course_instance_id IS 'Course instance scope for the role assignment. Exactly one domain column must be non-null.';
COMMENT ON COLUMN group_roles.exam_id IS 'Exam scope for the role assignment. Exactly one domain column must be non-null.';
CREATE INDEX group_roles_group_id_deleted_at_idx ON group_roles (group_id, deleted_at);
CREATE INDEX group_roles_organization_id_deleted_at_idx ON group_roles (organization_id, deleted_at);
CREATE INDEX group_roles_course_id_deleted_at_idx ON group_roles (course_id, deleted_at);
CREATE INDEX group_roles_course_instance_id_deleted_at_idx ON group_roles (course_instance_id, deleted_at);
CREATE INDEX group_roles_exam_id_deleted_at_idx ON group_roles (exam_id, deleted_at);
