UPDATE user_exercise_states
SET reviewing_stage = 'reviewed_and_locked'
WHERE reviewing_stage = 'locked';
UPDATE user_exercise_states_copy
SET reviewing_stage = 'reviewed_and_locked'
WHERE reviewing_stage = 'locked';

ALTER TYPE reviewing_stage
RENAME TO reviewing_stage_old;

CREATE TYPE reviewing_stage AS ENUM (
  'not_started',
  'peer_review',
  'self_review',
  'waiting_for_peer_reviews',
  'waiting_for_manual_grading',
  'reviewed_and_locked'
);

ALTER TABLE user_exercise_states
ALTER COLUMN reviewing_stage DROP DEFAULT,
  ALTER COLUMN reviewing_stage TYPE reviewing_stage USING reviewing_stage::text::reviewing_stage,
  ALTER COLUMN reviewing_stage
SET DEFAULT 'not_started'::reviewing_stage;

ALTER TABLE user_exercise_states_copy
ALTER COLUMN reviewing_stage DROP DEFAULT,
  ALTER COLUMN reviewing_stage TYPE reviewing_stage USING reviewing_stage::text::reviewing_stage,
  ALTER COLUMN reviewing_stage
SET DEFAULT 'not_started'::reviewing_stage;

DROP TYPE reviewing_stage_old;
