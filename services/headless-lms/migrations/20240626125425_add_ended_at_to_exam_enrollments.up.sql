ALTER TABLE exam_enrollments
ADD COLUMN ended_at TIMESTAMP WITH TIME ZONE;
COMMENT ON COLUMN exam_enrollments.ended_at IS 'Timestamp when the exam has ended. If null, the exam time has not ended.';
