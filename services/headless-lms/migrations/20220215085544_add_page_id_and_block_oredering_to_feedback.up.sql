ALTER TABLE feedback
ADD COLUMN page_id UUID REFERENCES pages(id);
COMMENT ON COLUMN feedback.page_id IS 'What page the feedback is related to.';
ALTER TABLE block_feedback
ADD COLUMN order_number INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN feedback.page_id IS 'A number that tells the order of the blocks.';
