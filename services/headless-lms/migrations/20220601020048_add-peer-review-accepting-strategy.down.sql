ALTER TABLE peer_reviews
  DROP COLUMN accepting_threshold,
  DROP COLUMN accepting_strategy;

DROP TYPE peer_review_accepting_strategy;