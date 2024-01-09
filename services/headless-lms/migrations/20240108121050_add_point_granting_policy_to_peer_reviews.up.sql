ALTER TABLE peer_review_configs
ADD COLUMN points_are_all_or_nothing BOOLEAN NOT NULL DEFAULT TRUE;
COMMENT ON COLUMN peer_review_configs.points_are_all_or_nothing IS 'True by default and recommended to keep it that way for most courses. If set to true, the student will always receive either full points or no points from the peer reviewed exercise. If set to false, the points will be weighted according to a weight in each peer review question.';
ALTER TABLE peer_review_questions
ADD COLUMN weight REAL NOT NULL DEFAULT 0;
COMMENT ON COLUMN peer_review_questions.weight IS 'The weight of the question in the peer review. The weight is used to calculate the points the student receives from the peer review. The points are calculated by multiplying the weight of the question with the points the student gave to the answer. The points are then summed up and divided by the sum of the weights of all questions in the peer review. The result is rounded to the nearest integer.';
ALTER TYPE peer_review_accepting_strategy
RENAME TO peer_review_processing_strategy;
ALTER TYPE peer_review_processing_strategy
RENAME VALUE 'automatically_accept_or_reject_by_average' TO 'automatically_grade_by_average';
ALTER TYPE peer_review_processing_strategy
RENAME VALUE 'automatically_accept_or_manual_review_by_average' TO 'automatically_grade_or_manual_review_by_average';
COMMENT ON COLUMN peer_review_configs.accepting_threshold IS 'The threshold on the average review received for "passing" a peer reviewed exercise. If points_are_all_or_nothing is true, this threshold tells whether to give full points or zero points. If points_are_all_or_nothing is false and peer_review_processing_strategy is automatically_grade_or_manual_review_by average all averages under this threshold will cause an answer to be sent to manual review. In all other cases, this column will be ignored. Peer review questions are on a scale from 1 to 5.';
ALTER table peer_review_configs
  RENAME COLUMN accepting_strategy TO processing_strategy;
