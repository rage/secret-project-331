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
