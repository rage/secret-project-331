DROP INDEX peer_or_self_review_submissions_one_per_reviewer_and_answer;

DELETE FROM pending_roles
WHERE organization_id IS NOT NULL
  OR exam_id IS NOT NULL
  OR is_global;

DROP INDEX pending_roles_user_email_idx;

ALTER TABLE pending_roles DROP CONSTRAINT single_role_for_domain;
ALTER TABLE pending_roles
ADD CONSTRAINT single_role_for_domain CHECK (num_nonnulls(course_instance_id, course_id) = 1);

ALTER TABLE pending_roles DROP COLUMN organization_id,
  DROP COLUMN exam_id,
  DROP COLUMN is_global;

COMMENT ON TABLE pending_roles IS 'A role that will be added for a user once they login to the system. Limited to course and course instance roles for security reasons';
COMMENT ON COLUMN pending_roles.user_email IS 'Email the role will be granted to.';
COMMENT ON COLUMN pending_roles.course_instance_id IS 'When the pending role expires. Expiration is important to minimize the chance of someone impersonating a user.';
COMMENT ON COLUMN pending_roles.expires_at IS NULL;
