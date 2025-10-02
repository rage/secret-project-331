ALTER TABLE rejected_exercise_slide_submissions
ADD COLUMN http_status_code INTEGER,
  ADD COLUMN error_message TEXT;

COMMENT ON COLUMN rejected_exercise_slide_submissions.http_status_code IS 'HTTP status code from the response that caused the rejection';
COMMENT ON COLUMN rejected_exercise_slide_submissions.error_message IS 'Error message from the HTTP response body that caused the rejection';
