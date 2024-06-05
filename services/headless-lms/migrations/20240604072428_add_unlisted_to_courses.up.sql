ALTER TABLE courses
ADD COLUMN is_unlisted BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN courses.is_unlisted IS 'If true, the course is not listed on the organization page but students with a direct link to the course can access it.';
-- Course cannot be unlisted and draft at the same time
ALTER TABLE courses
ADD CONSTRAINT unlisted_xor_draft CHECK (
    NOT (
      is_unlisted
      AND is_draft
    )
  );
