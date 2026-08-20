CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE course_designer_plan_stages
ADD CONSTRAINT course_designer_plan_stages_no_overlap EXCLUDE USING gist (
  course_designer_plan_id WITH =,
  daterange(planned_starts_on, planned_ends_on, '[]') WITH &&
)
WHERE (deleted_at IS NULL)
DEFERRABLE INITIALLY DEFERRED;
-- Like extract_searchable_text_from_document_schema, but additionally prunes the innerBlocks of
-- any moocfi/lock-chapter block, mirroring filter_lock_chapter_blocks(blocks, is_locked = false).
-- Used for public search snippets, which must never surface content hidden behind a locked chapter.
CREATE FUNCTION extract_public_searchable_text_from_document_schema(content jsonb) RETURNS setof text AS $$
BEGIN
RETURN QUERY WITH RECURSIVE walk(key, value) AS (
  SELECT NULL::text, content
  UNION ALL
  SELECT next.key, next.value
  FROM walk,
    LATERAL (
      SELECT o.key, o.value
      FROM jsonb_each(walk.value) AS o(key, value)
      WHERE jsonb_typeof(walk.value) = 'object'
        AND NOT (
          o.key = 'innerBlocks'
          AND walk.value ->> 'name' = 'moocfi/lock-chapter'
        )
      UNION ALL
      SELECT NULL::text, e.value
      FROM jsonb_array_elements(walk.value) AS e(value)
      WHERE jsonb_typeof(walk.value) = 'array'
    ) AS next
)
SELECT value #>> '{}'
FROM walk
WHERE jsonb_typeof(value) = 'string'
  AND key IN ('content', 'title', 'subtitle');
END;
$$ language 'plpgsql' STABLE;
