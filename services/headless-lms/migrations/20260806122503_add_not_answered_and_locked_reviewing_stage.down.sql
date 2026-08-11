UPDATE user_exercise_states
SET reviewing_stage = 'locked'
WHERE reviewing_stage = 'not_answered_and_locked';

UPDATE user_exercise_states_copy
SET reviewing_stage = 'locked'
WHERE reviewing_stage = 'not_answered_and_locked';

ALTER TYPE reviewing_stage
RENAME TO reviewing_stage_old;

CREATE TYPE reviewing_stage AS ENUM (
  'not_started',
  'peer_review',
  'self_review',
  'waiting_for_peer_reviews',
  'waiting_for_manual_grading',
  'reviewed_and_locked',
  'locked'
);

-- Both columns default to a value of the old type, so the defaults have to be dropped before
-- the swap and restored after. user_exercise_states_copy is the safety copy left behind by
-- 20250902102839; dropping the old type fails while it still references it.
ALTER TABLE user_exercise_states
ALTER COLUMN reviewing_stage DROP DEFAULT;

ALTER TABLE user_exercise_states_copy
ALTER COLUMN reviewing_stage DROP DEFAULT;

ALTER TABLE user_exercise_states
ALTER COLUMN reviewing_stage TYPE reviewing_stage USING reviewing_stage::text::reviewing_stage;

ALTER TABLE user_exercise_states_copy
ALTER COLUMN reviewing_stage TYPE reviewing_stage USING reviewing_stage::text::reviewing_stage;

ALTER TABLE user_exercise_states
ALTER COLUMN reviewing_stage
SET DEFAULT 'not_started';

ALTER TABLE user_exercise_states_copy
ALTER COLUMN reviewing_stage
SET DEFAULT 'not_started';

DROP TYPE reviewing_stage_old;
