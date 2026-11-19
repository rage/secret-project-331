COMMENT ON TABLE credit_registration_enrolment_routes IS 'What the student said about enrolling, on the new registration page: which university relationship they have, and that they have gone and enrolled. Advisory only -- it picks which enrolment instructions to show and how far the page''s step list has come, and the pipeline neither reads it nor waits for it. Kept apart from course_module_completions because a completion is a graded fact and this is one person''s answer to a question about it.';

ALTER TABLE credit_registration_enrolment_routes DROP COLUMN has_finnish_personal_identity_code,
  DROP COLUMN need,
  DROP COLUMN identification,
  DROP COLUMN need_after_reconsider,
  DROP COLUMN certificate_chosen_at;

DROP TYPE credit_registration_identification;

DROP TYPE credit_registration_need;
