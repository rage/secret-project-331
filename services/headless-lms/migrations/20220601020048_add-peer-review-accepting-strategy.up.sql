CREATE TYPE peer_review_accepting_strategy AS ENUM (
  'automatically_accept_or_reject_by_average',
  'automatically_accept_or_manual_review_by_average',
  'manual_review_everything'
  );

COMMENT ON TYPE peer_review_accepting_strategy IS 'Determines how we will treat the answer being peer reviewed once it has received enough reviews.';
ALTER TABLE peer_reviews
  ADD COLUMN accepting_strategy peer_review_accepting_strategy NOT NULL DEFAULT  'automatically_accept_or_reject_by_average'
  , ADD COLUMN accepting_threshold REAL NOT NULL DEFAULT 3.0;
COMMENT ON COLUMN peer_reviews.accepting_strategy IS 'Determines how we will treat the answer being peer reviewed once it has received enough reviews. Some variants depend on accepting threshold.';
COMMENT ON COLUMN peer_reviews.accepting_threshold IS 'The threshold determining whether an answer should be automatically accepted. Depends on peer review accepting strategy. For example, if the accepting strategy is ''automatically_accept_or_reject_by_average'', this would determine the threshold value for the overall received review average above which we would automatically accept the answer. Peer review likert questions are on a scale from 1-5.';
