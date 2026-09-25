-- Configs of exercise blocks pasted from another course kept the source course's course_id.
UPDATE peer_or_self_review_configs posrc
SET course_id = e.course_id
FROM exercises e
WHERE e.id = posrc.exercise_id
  AND e.course_id IS NOT NULL
  AND posrc.course_id <> e.course_id;

-- exercises.chapter_id (a redundant copy of the page's chapter_id) went stale on page moves and chapter deletion.
UPDATE exercises e
SET chapter_id = p.chapter_id
FROM pages p
WHERE p.id = e.page_id
  AND e.course_id IS NOT NULL
  AND e.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND e.chapter_id IS DISTINCT FROM p.chapter_id;

-- Copied research forms named the source course's questions, which saves can no longer overwrite.
INSERT INTO course_specific_consent_form_questions (
    id,
    course_id,
    research_consent_form_id,
    question
  )
SELECT DISTINCT ON (f.id, q.id) uuid_generate_v5(f.course_id, q.id::text),
  f.course_id,
  f.id,
  COALESCE(block->'attributes'->>'content', q.question)
FROM course_specific_research_consent_forms f
  CROSS JOIN jsonb_array_elements(f.content) block
  JOIN course_specific_consent_form_questions q ON q.id::text = block->>'clientId'
WHERE jsonb_typeof(f.content) = 'array'
  AND block->>'name' = 'moocfi/research-consent-question'
  AND q.course_id <> f.course_id ON CONFLICT (id) DO NOTHING;

UPDATE course_specific_research_consent_forms f
SET content = (
    SELECT jsonb_agg(
        CASE
          WHEN q.id IS NOT NULL THEN jsonb_set(
            block,
            '{clientId}',
            to_jsonb(uuid_generate_v5(f.course_id, q.id::text)::text)
          )
          ELSE block
        END
        ORDER BY position
      )
    FROM jsonb_array_elements(f.content) WITH ORDINALITY AS blocks(block, position)
      LEFT JOIN course_specific_consent_form_questions q ON q.id::text = block->>'clientId'
      AND block->>'name' = 'moocfi/research-consent-question'
      AND q.course_id <> f.course_id
  )
WHERE jsonb_typeof(f.content) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(f.content) block
      JOIN course_specific_consent_form_questions q ON q.id::text = block->>'clientId'
    WHERE block->>'name' = 'moocfi/research-consent-question'
      AND q.course_id <> f.course_id
  );
