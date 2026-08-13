ALTER TYPE reviewing_stage
ADD VALUE IF NOT EXISTS 'not_answered_and_locked' AFTER 'locked';
