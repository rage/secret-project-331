ALTER TABLE rejected_exercise_slide_submissions
ADD COLUMN response_body TEXT;

COMMENT ON COLUMN rejected_exercise_slide_submissions.response_body IS 'The response body from the HTTP response that caused the rejection';
