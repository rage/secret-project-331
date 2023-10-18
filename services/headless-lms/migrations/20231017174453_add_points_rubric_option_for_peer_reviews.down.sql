ALTER TABLE peer_review_configs DROP COLUMN evaluation_type;
DROP TYPE peer_review_evaluation_type;
ALTER TYPE peer_review_question_type
RENAME VALUE 'statement-likert-scale' TO 'scale';
-- remove the enum variant give-points from peer_review_question_type
DELETE FROM peer_review_questions
WHERE question_type = 'give-points';
ALTER TYPE peer_review_question_type
RENAME TO peer_review_question_type_old;
CREATE TYPE peer_review_question_type AS ENUM('essay', 'scale');
ALTER TABLE peer_review_questions
ALTER COLUMN question_type TYPE peer_review_question_type USING question_type::text::peer_review_question_type;
DROP TYPE peer_review_question_type_old;
--
ALTER TABLE peer_review_questions
DROP COLUMN points_percentage;
