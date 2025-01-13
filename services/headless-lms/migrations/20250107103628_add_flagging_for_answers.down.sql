DROP TABLE IF EXISTS flagged_answers;

ALTER TABLE exercise_slide_submissions DROP COLUMN flag_count;

ALTER TABLE courses DROP COLUMN flagged_answers_threshold;
