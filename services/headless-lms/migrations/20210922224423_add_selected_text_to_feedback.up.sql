-- Add up migration script here
ALTER TABLE feedback
ADD selected_text TEXT;
COMMENT ON COLUMN feedback.selected_text IS 'The text the student selected to give feedback on.';