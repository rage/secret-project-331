ALTER TABLE user_details
ADD COLUMN IF NOT EXISTS name_search_helper text GENERATED ALWAYS AS (
    lower(
      btrim(
        COALESCE(first_name, '') || ' ' ||
        COALESCE(last_name, '') || ' ' ||
        COALESCE(last_name, '') || ' ' ||
        COALESCE(first_name, '')
      )
    )
  ) STORED,
ADD COLUMN IF NOT EXISTS email_search_helper text GENERATED ALWAYS AS (
    lower(COALESCE(email, ''))
  ) STORED;

COMMENT ON COLUMN user_details.name_search_helper IS 'Generated helper column for typo-resistant user name search. Contains first-name last-name and last-name first-name in lowercase.';
COMMENT ON COLUMN user_details.email_search_helper IS 'Generated helper column for typo-resistant full email search in lowercase.';

CREATE INDEX IF NOT EXISTS user_details_name_search_helper_gist ON user_details USING gist (name_search_helper gist_trgm_ops);
CREATE INDEX IF NOT EXISTS user_details_email_search_helper_gist ON user_details USING gist (email_search_helper gist_trgm_ops);

DROP INDEX IF EXISTS user_details_search_helper_gist;

WITH ranked_suspected_cheaters AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id,
      course_id
      ORDER BY is_archived DESC,
        updated_at DESC NULLS LAST,
        created_at DESC,
        id DESC
    ) AS row_number
  FROM suspected_cheaters
  WHERE deleted_at IS NULL
)
UPDATE suspected_cheaters
SET deleted_at = NOW()
WHERE id IN (
    SELECT id
    FROM ranked_suspected_cheaters
    WHERE row_number > 1
  );

UPDATE course_module_completions cmc
SET needs_to_be_reviewed = FALSE
FROM suspected_cheaters sc
WHERE cmc.user_id = sc.user_id
  AND cmc.course_id = sc.course_id
  AND cmc.deleted_at IS NULL
  AND sc.deleted_at IS NULL
  AND sc.is_archived = TRUE
  AND cmc.needs_to_be_reviewed = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS suspected_cheaters_user_course_not_deleted_idx ON suspected_cheaters (user_id, course_id)
WHERE deleted_at IS NULL;
