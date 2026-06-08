-- Replaces the confusing `is_archived` boolean on suspected_cheaters with an explicit
-- 3-state status enum.
--
-- The old boolean read backwards and conflated two states: a newly auto-flagged student
-- awaiting review and a teacher-confirmed cheater were BOTH is_archived = FALSE, while
-- is_archived = TRUE actually meant "dismissed as a false alarm".
--
-- Data mapping:
--   is_archived = TRUE  -> 'dismissed'  (teacher decided it was a false alarm)
--   is_archived = FALSE -> 'flagged'    (awaiting review)
-- NOTE: existing rows cannot distinguish an already-confirmed cheater from a
-- not-yet-reviewed one (both were FALSE), so all such rows become 'flagged'. The
-- 'confirmed-cheating' state only arises for decisions made after this migration.
CREATE TYPE suspected_cheater_status AS ENUM (
  'flagged',
  'confirmed-cheating',
  'dismissed'
);

ALTER TABLE suspected_cheaters
ADD COLUMN status suspected_cheater_status NOT NULL DEFAULT 'flagged';

COMMENT ON COLUMN suspected_cheaters.status IS 'Review state of a suspected cheater: flagged (auto-flagged, awaiting teacher review), confirmed-cheating (teacher confirmed cheating; the student is failed), or dismissed (teacher decided it was a false alarm).';

UPDATE suspected_cheaters
SET status = 'dismissed'
WHERE is_archived = TRUE;

ALTER TABLE suspected_cheaters DROP COLUMN is_archived;
