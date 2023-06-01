COMMENT ON TABLE peer_review_queue_entries IS 'Table for queueing up for peer reviews. Once user posts their first peer review, they will get added to the queue where additional peer reviews given will increase their own priority of receiving peer reviews.';
COMMENT ON COLUMN peer_review_queue_entries.created_at IS 'Timestamp when the record was created.';
