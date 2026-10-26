CREATE TYPE credit_registration_need AS ENUM ('certificate', 'credits');

CREATE TYPE credit_registration_identification AS ENUM ('eidas', 'other_suomi_fi', 'none');

ALTER TABLE credit_registration_enrolment_routes
ADD COLUMN has_finnish_personal_identity_code BOOLEAN,
  ADD COLUMN need credit_registration_need,
  ADD COLUMN identification credit_registration_identification,
  ADD COLUMN need_after_reconsider credit_registration_need,
  ADD COLUMN certificate_chosen_at TIMESTAMP WITH TIME ZONE;

COMMENT ON TABLE credit_registration_enrolment_routes IS 'What the student said about enrolling, on the new registration page: which university relationship they have, their answers to the questions that steer open university students without strong authentication towards a certificate, whether they took the certificate, and that they have gone and enrolled. Advisory only -- it picks which instructions to show and how far the page''s step list has come, and the pipeline neither reads it nor waits for it. Kept apart from course_module_completions because a completion is a graded fact and this is one person''s answer to a question about it.';
COMMENT ON COLUMN credit_registration_enrolment_routes.has_finnish_personal_identity_code IS 'The student''s answer to whether they are Finnish or have a Finnish personal identity code, asked of open university students because enrolling needs strong authentication. Null until answered. Kept when the route changes, so a student who switches back finds their answers.';
COMMENT ON COLUMN credit_registration_enrolment_routes.need IS 'Whether the student said they need a certificate or credits in the study registry, asked of those without a Finnish personal identity code. Null until answered.';
COMMENT ON COLUMN credit_registration_enrolment_routes.identification IS 'How the student said they can identify themselves for enrolling: eidas, another Suomi.fi method, or none. Asked of those who said they need credits. Null until answered.';
COMMENT ON COLUMN credit_registration_enrolment_routes.need_after_reconsider IS 'What the student said they need when asked again after saying they have no way to identify themselves, which makes enrolling slow. Null until answered.';
COMMENT ON COLUMN credit_registration_enrolment_routes.certificate_chosen_at IS 'When the student said a certificate is enough and took it instead of registering credits. Null until they do, and cleared again if they take it back. Advisory like the rest of the row: the pipeline still registers the completion.';
