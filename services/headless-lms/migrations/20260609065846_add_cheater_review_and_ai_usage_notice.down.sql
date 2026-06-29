-- Reverses the changes in this migration, in the opposite order they were applied.

-- Per-course toggle for suspected-cheater detection
ALTER TABLE courses
DROP COLUMN cheater_detection_enabled;

-- AI-usage notice acknowledgements
DROP TABLE user_ai_usage_notice_acknowledgements;

-- Suspected-cheaters review: status enum back to the is_archived boolean.
-- Both 'flagged' and 'confirmed-cheating' map back to FALSE (the original boolean
-- could not represent the 'confirmed-cheating' state separately).
ALTER TABLE suspected_cheaters
ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE suspected_cheaters
SET is_archived = TRUE
WHERE status = 'dismissed';

ALTER TABLE suspected_cheaters DROP COLUMN status;

DROP TYPE suspected_cheater_status;
