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
