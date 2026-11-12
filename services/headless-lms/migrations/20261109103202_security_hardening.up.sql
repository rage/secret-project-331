ALTER TABLE pending_roles
ADD COLUMN organization_id UUID REFERENCES organizations(id),
  ADD COLUMN exam_id UUID REFERENCES exams(id),
  ADD COLUMN is_global BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE pending_roles DROP CONSTRAINT single_role_for_domain;
ALTER TABLE pending_roles
ADD CONSTRAINT single_role_for_domain CHECK (
    num_nonnulls(organization_id, course_id, course_instance_id, exam_id) = 1
    AND is_global = FALSE
    OR num_nonnulls(organization_id, course_id, course_instance_id, exam_id) = 0
    AND is_global = TRUE
  );

CREATE INDEX pending_roles_user_email_idx ON pending_roles (lower(user_email))
WHERE deleted_at IS NULL;

COMMENT ON TABLE pending_roles IS 'A role granted to an email address that is not verified yet. It becomes a role once the account holding that address verifies it, and lapses at expires_at; until then a student who merely typed someone else''s address into their profile gets nothing.';
COMMENT ON COLUMN pending_roles.user_email IS 'Email the role will be granted to, compared case-insensitively.';
COMMENT ON COLUMN pending_roles.course_instance_id IS 'The course instance the role is for';
COMMENT ON COLUMN pending_roles.expires_at IS 'When the pending role expires. Expiration is important to minimize the chance of someone impersonating a user.';
COMMENT ON COLUMN pending_roles.organization_id IS 'The organization the role is for';
COMMENT ON COLUMN pending_roles.exam_id IS 'The exam the role is for';
COMMENT ON COLUMN pending_roles.is_global IS 'Whether the role is global rather than for one organization, course, course instance or exam';

-- A review token can be replayed until it expires, so concurrent replays must not all count.
-- Duplicates from before this index are retired, keeping the first review of each answer.
UPDATE peer_or_self_review_submissions
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND id IN (
    SELECT id
    FROM (
        SELECT id,
          row_number() OVER (
            PARTITION BY user_id,
            exercise_slide_submission_id
            ORDER BY created_at,
              id
          ) AS nth
        FROM peer_or_self_review_submissions
        WHERE deleted_at IS NULL
      ) ranked
    WHERE nth > 1
  );
CREATE UNIQUE INDEX peer_or_self_review_submissions_one_per_reviewer_and_answer ON peer_or_self_review_submissions (user_id, exercise_slide_submission_id)
WHERE deleted_at IS NULL;
