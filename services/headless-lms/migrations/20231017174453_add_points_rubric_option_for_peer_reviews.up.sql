CREATE TYPE peer_review_evaluation_type AS ENUM('likert-statements', 'points-rubric');
-- Add the new column
ALTER TABLE peer_review_configs
ADD COLUMN evaluation_type peer_review_evaluation_type NOT NULL DEFAULT 'likert-statements';
ALTER TYPE peer_review_question_type
ADD VALUE 'give-points';
ALTER TYPE peer_review_question_type
RENAME VALUE 'scale' TO 'statement-likert-scale';
ALTER TABLE peer_review_questions
ADD COLUMN points_percentage REAL;
