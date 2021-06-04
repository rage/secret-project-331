-- Add up migration script here
CREATE TYPE grading_progress AS ENUM ('fully-graded', 'pending', 'pending-manual', 'failed', 'not-ready');

CREATE TYPE user_points_update_strategy AS ENUM ('can-add-points-but-cannot-remove-points', 'can-add-points-and-can-remove-points');

CREATE TABLE gradings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  submission_id UUID REFERENCES submissions NOT NULL,
  course_id UUID REFERENCES courses NOT NULL,
  exercise_id UUID REFERENCES exercises NOT NULL,
  exercise_item_id UUID REFERENCES exercise_items NOT NULL,
  grading_priority INTEGER NOT NULL DEFAULT 100,
  score_given REAL,
  grading_progress grading_progress NOT NULL DEFAULT 'not-ready',
  unscaled_score_given REAL,
  unscaled_max_points INTEGER,
  grading_started_at TIMESTAMP,
  grading_completed_at TIMESTAMP,
  feedback_json JSONB,
  feedback_text TEXT,
  user_points_update_strategy user_points_update_strategy NOT NULL DEFAULT 'can-add-points-but-cannot-remove-points',
  deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON gradings
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

ALTER TABLE submissions
  ADD exercise_id UUID REFERENCES exercises NOT NULL,
  ADD course_id UUID REFERENCES courses NOT NULL,
  ADD exercise_item_id UUID REFERENCES exercise_items NOT NULL,
  ADD data_json JSONB,
  ADD grading_id UUID REFERENCES gradings NOT NULL,
  ADD metadata JSONB;

CREATE TABLE regradings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  regrading_started_at TIMESTAMP,
  regrading_completed_at TIMESTAMP,
  total_grading_progress grading_progress NOT NULL DEFAULT 'not-ready',
  deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON regradings
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE regrading_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  regrading_id UUID REFERENCES regradings NOT NULL,
  submission_id UUID REFERENCES submissions NOT NULL,
  grading_before_regrading UUID REFERENCES gradings NOT NULL,
  grading_after_regrading UUID REFERENCES gradings,
  deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON regrading_submissions
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
