DROP TABLE IF EXISTS flagged_answers;

DROP TYPE IF EXISTS report_reason;

ALTER TABLE exercise_slide_submissions DROP COLUMN flag_count;

ALTER TABLE courses DROP COLUMN flagged_answers_threshold;
