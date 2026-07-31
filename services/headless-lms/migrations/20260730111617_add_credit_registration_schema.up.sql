-- Statement order minimises lock hold time: new types and tables first, the live tables the pods
-- read on every request (course_modules, email_deliveries, user_details) last.

CREATE TYPE student_number_verification_method AS ENUM (
  'emailed_link',
  'email_match_fast_track',
  'admin_manual'
);

COMMENT ON TYPE student_number_verification_method IS 'How a student number was proven to belong to an account. A discriminator, not a flag: reads that care about strength of proof must match exhaustively.';

CREATE TABLE verified_student_numbers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  student_number VARCHAR(32) NOT NULL,
  sisu_person_id VARCHAR(255) NOT NULL,
  first_names VARCHAR(255),
  last_name VARCHAR(255),
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_via student_number_verification_method NOT NULL DEFAULT 'emailed_link',
  verified_via_email VARCHAR(255),
  verified_via_email_match_field VARCHAR(16),
  account_email_verified_at TIMESTAMP WITH TIME ZONE,
  linked_by_user_id UUID REFERENCES users(id),
  link_reason TEXT,
  verified_from_course_id UUID REFERENCES courses(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  -- TODO: Suotar has not confirmed their normalisation. Kept loose on purpose: real UH numbers are
  -- 9 digits, but do not hard-code 9 and never trim leading zeros.
  CONSTRAINT student_number_format CHECK (student_number ~ '^[0-9]{6,12}$'),
  -- admin_manual rows rest on a human decision, so they carry no proving address; the other two
  -- methods both rest on the Sisu-held address.
  CONSTRAINT verified_student_numbers_proof_address CHECK (
    (verified_via = 'admin_manual') = (verified_via_email IS NULL)
  ),
  CONSTRAINT verified_student_numbers_match_field_method CHECK (
    verified_via = 'email_match_fast_track'
    OR verified_via_email_match_field IS NULL
  ),
  -- Iff, not one-way like its neighbours: an admin_manual row naming no admin is the case to catch.
  CONSTRAINT verified_student_numbers_admin_linker CHECK (
    (verified_via = 'admin_manual') = (linked_by_user_id IS NOT NULL)
  ),
  CONSTRAINT verified_student_numbers_link_reason CHECK (
    verified_via = 'admin_manual'
    OR link_reason IS NULL
  )
);
CREATE UNIQUE INDEX uq_verified_student_numbers_user ON verified_student_numbers (user_id)
WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_verified_student_numbers_number ON verified_student_numbers (student_number)
WHERE deleted_at IS NULL;
-- One account per Sisu person: the number changes on a programme move, the person id does not.
CREATE UNIQUE INDEX uq_verified_student_numbers_person ON verified_student_numbers (sisu_person_id)
WHERE deleted_at IS NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON verified_student_numbers FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE verified_student_numbers IS 'Student numbers proven to belong to a courses.mooc.fi account. Global per account: one live row per user, one per student number and one per Sisu person id. Relinking soft-deletes the old row and inserts a new one; student_number is never updated in place because the old value is audit-relevant.';
COMMENT ON COLUMN verified_student_numbers.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN verified_student_numbers.user_id IS 'The account that holds this student number.';
COMMENT ON COLUMN verified_student_numbers.student_number IS 'The University of Helsinki student number, normalised (whitespace stripped, leading zeros preserved).';
COMMENT ON COLUMN verified_student_numbers.sisu_person_id IS 'Sisu person id reported alongside the student number. Stable across student number changes, live-unique, and the identity the double-registration guards key on.';
COMMENT ON COLUMN verified_student_numbers.first_names IS 'First names as Sisu reports them, shown on the link confirmation page and in support views.';
COMMENT ON COLUMN verified_student_numbers.last_name IS 'Last name as Sisu reports it, shown on the link confirmation page and in support views.';
COMMENT ON COLUMN verified_student_numbers.verified_at IS 'When the link was established.';
COMMENT ON COLUMN verified_student_numbers.verified_via IS 'Which proof established the link.';
COMMENT ON COLUMN verified_student_numbers.verified_via_email IS 'The Sisu-held address the proof rests on: the address the link was mailed to, or the matched address for the fast track. NULL exactly for admin_manual rows.';
COMMENT ON COLUMN verified_student_numbers.verified_via_email_match_field IS 'Which Sisu address field matched for email_match_fast_track rows: primary (secondary is reserved and not currently accepted). NULL for other methods.';
COMMENT ON COLUMN verified_student_numbers.account_email_verified_at IS 'The account email verification timestamp as it stood at link time, frozen here on purpose: user_details.email_verified_at is cleared on the next address change, and an audit years later must still be able to answer how old the proof was.';
COMMENT ON COLUMN verified_student_numbers.linked_by_user_id IS 'The admin who established an admin_manual link. NULL for other methods. Duplicates the audit log deliberately: "on what authority does this account hold this number" must be answerable from the row itself.';
COMMENT ON COLUMN verified_student_numbers.link_reason IS 'The reason the acting admin typed for an admin_manual link. NULL for other methods.';
COMMENT ON COLUMN verified_student_numbers.verified_from_course_id IS 'The course whose registration flow produced this link, for support context. NULL when not attributable to one course.';
COMMENT ON COLUMN verified_student_numbers.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN verified_student_numbers.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN verified_student_numbers.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TABLE student_number_verification_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token VARCHAR(255) NOT NULL,
  claimed_by_user_id UUID REFERENCES users(id),
  student_number VARCHAR(32) NOT NULL,
  sisu_person_id VARCHAR(255) NOT NULL,
  first_names VARCHAR(255),
  last_name VARCHAR(255),
  emailed_to VARCHAR(255) NOT NULL,
  course_id UUID REFERENCES courses(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + INTERVAL '14 days',
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT student_number_verification_token_length CHECK (LENGTH(token) >= 128)
);
CREATE UNIQUE INDEX uq_student_number_verification_token ON student_number_verification_tokens (token, deleted_at) NULLS NOT DISTINCT
WHERE used_at IS NULL;
CREATE INDEX idx_student_number_verification_tokens_number ON student_number_verification_tokens (student_number, created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_student_number_verification_tokens_claimed_by ON student_number_verification_tokens (claimed_by_user_id, created_at DESC)
WHERE claimed_by_user_id IS NOT NULL
  AND deleted_at IS NULL;
CREATE INDEX idx_student_number_verification_tokens_expires ON student_number_verification_tokens (expires_at)
WHERE used_at IS NULL
  AND deleted_at IS NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON student_number_verification_tokens FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE student_number_verification_tokens IS 'One-click links mailed to the address Sisu holds for a person, to bind a student number to whichever courses.mooc.fi account opens the link while logged in. Deliberately not bound to an account at creation time: the two addresses routinely differ, which is the entire reason this flow exists.';
COMMENT ON COLUMN student_number_verification_tokens.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN student_number_verification_tokens.token IS 'Long random string (at least 128 characters) that is the only proof of ownership. Not scoped to an account, so entropy matters more here than in the admin login flow.';
COMMENT ON COLUMN student_number_verification_tokens.claimed_by_user_id IS 'The account that opened the link, written together with used_at. NULL until claimed.';
COMMENT ON COLUMN student_number_verification_tokens.student_number IS 'The student number this token would link.';
COMMENT ON COLUMN student_number_verification_tokens.sisu_person_id IS 'Sisu person id this token identifies. Before the claim, the token identifies a Sisu person rather than one of our accounts.';
COMMENT ON COLUMN student_number_verification_tokens.first_names IS 'First names as Sisu reports them, shown on the confirmation page so the recipient can see what they are linking.';
COMMENT ON COLUMN student_number_verification_tokens.last_name IS 'Last name as Sisu reports it, shown on the confirmation page.';
COMMENT ON COLUMN student_number_verification_tokens.emailed_to IS 'The address the link was mailed to.';
COMMENT ON COLUMN student_number_verification_tokens.course_id IS 'The course whose registration flow produced this token, for the mail copy and support context.';
COMMENT ON COLUMN student_number_verification_tokens.expires_at IS 'When the link stops working. Default 14 days: this link arrives in an email the student did not ask for and may read a week later.';
COMMENT ON COLUMN student_number_verification_tokens.used_at IS 'When the link was opened and the link established. Null if unused.';
COMMENT ON COLUMN student_number_verification_tokens.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN student_number_verification_tokens.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN student_number_verification_tokens.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TABLE credit_registration_account_linking_emails (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_number VARCHAR(32) NOT NULL,
  sisu_person_id VARCHAR(255) NOT NULL,
  course_id UUID NOT NULL REFERENCES courses(id),
  emailed_to VARCHAR(255) NOT NULL,
  student_number_verification_token_id UUID REFERENCES student_number_verification_tokens(id),
  email_delivery_id UUID REFERENCES email_deliveries(id),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
-- The dedup mechanism: the sender inserts ON CONFLICT DO NOTHING in the transaction that mints the
-- token and the delivery row, and mails only when a row came back. Keyed on the person id, not the
-- number, which changes; the address is in the key so primaryEmail and secondaryEmail each get one.
CREATE UNIQUE INDEX uq_account_linking_email_person_course_address ON credit_registration_account_linking_emails (
  sisu_person_id,
  course_id,
  LOWER(emailed_to),
  deleted_at
) NULLS NOT DISTINCT;
CREATE INDEX idx_account_linking_emails_course ON credit_registration_account_linking_emails (course_id, sent_at DESC)
WHERE deleted_at IS NULL;
-- Rate cap lookups: "have we mailed this person anywhere recently?"
CREATE INDEX idx_account_linking_emails_person_sent ON credit_registration_account_linking_emails (sisu_person_id, sent_at DESC)
WHERE deleted_at IS NULL;
-- No read uses this: it stops a hard-deleted token from seq-scanning here through the foreign key.
CREATE INDEX idx_account_linking_emails_token ON credit_registration_account_linking_emails (student_number_verification_token_id)
WHERE student_number_verification_token_id IS NOT NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registration_account_linking_emails FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE credit_registration_account_linking_emails IS 'One row per account-linking mail we queued, keyed on the Sisu person id plus the recipient address. Prevents mailing the same Sisu person twice for the same course and backs the per-person rate caps.';
COMMENT ON COLUMN credit_registration_account_linking_emails.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_account_linking_emails.student_number IS 'The student number the mail was about, for support and audit. Not a key: it changes when a student moves between programmes.';
COMMENT ON COLUMN credit_registration_account_linking_emails.sisu_person_id IS 'Sisu person id the mail was about. The dedup and rate cap key, because at send time there is no account of ours to key on.';
COMMENT ON COLUMN credit_registration_account_linking_emails.course_id IS 'The course whose registration flow triggered the mail.';
COMMENT ON COLUMN credit_registration_account_linking_emails.emailed_to IS 'The address the mail was queued to.';
COMMENT ON COLUMN credit_registration_account_linking_emails.student_number_verification_token_id IS 'The token whose link the mail carried.';
COMMENT ON COLUMN credit_registration_account_linking_emails.email_delivery_id IS 'The email_deliveries row, which carries our send status. We report send status, never delivery.';
COMMENT ON COLUMN credit_registration_account_linking_emails.sent_at IS 'When the mail was queued for sending. Not a delivery confirmation.';
COMMENT ON COLUMN credit_registration_account_linking_emails.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registration_account_linking_emails.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registration_account_linking_emails.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TABLE course_credit_registration_consents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  consent_given BOOLEAN NOT NULL,
  consent_given_at TIMESTAMP WITH TIME ZONE,
  consent_withdrawn_at TIMESTAMP WITH TIME ZONE,
  asked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  -- Without this, "when did this student consent?" can answer NULL on a consent record.
  CONSTRAINT course_credit_registration_consents_flag_timestamp CHECK (
    CASE
      WHEN consent_given THEN consent_given_at IS NOT NULL
      ELSE consent_withdrawn_at IS NOT NULL
    END
  )
);
CREATE UNIQUE INDEX uq_course_credit_registration_consents_user_course ON course_credit_registration_consents (user_id, course_id, deleted_at) NULLS NOT DISTINCT;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_credit_registration_consents FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE course_credit_registration_consents IS 'Per (user, course) consent to register completions into the study registry. One consent covers every module of the course. No row means never asked, which is what makes the course-start dialog appear; consent_given = false means asked and declined, which must not re-ask on every page load.';
COMMENT ON COLUMN course_credit_registration_consents.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_credit_registration_consents.user_id IS 'The student who was asked.';
COMMENT ON COLUMN course_credit_registration_consents.course_id IS 'The course the consent covers, including all of its modules.';
COMMENT ON COLUMN course_credit_registration_consents.consent_given IS 'The current answer. Flipping it stamps the corresponding timestamp and leaves the other one intact, so gave-then-withdrew history survives in the row.';
COMMENT ON COLUMN course_credit_registration_consents.consent_given_at IS 'When consent was last given.';
COMMENT ON COLUMN course_credit_registration_consents.consent_withdrawn_at IS 'When consent was last withdrawn. Withdrawal stops future submissions and abandons in-flight ones; it cannot un-register anything already in Sisu.';
COMMENT ON COLUMN course_credit_registration_consents.asked_at IS 'When the student was first asked.';
COMMENT ON COLUMN course_credit_registration_consents.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_credit_registration_consents.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_credit_registration_consents.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TYPE credit_registration_state AS ENUM (
  'pending_prerequisites',
  'pending_consent',
  'pending_student_number',
  'ready_to_submit',
  'checking_enrolment',
  'no_usable_enrolment',
  'submitting',
  'submission_uncertain',
  'awaiting_verification',
  'registered',
  'duplicate',
  'not_improved',
  'misregistered',
  'failed_retryable',
  'failed_permanent',
  'blocked',
  'cancelled',
  'abandoned_by_consent_withdrawal'
);

COMMENT ON TYPE credit_registration_state IS 'Lifecycle state of one credit registration. The success set for reporting and for the double-registration guard is exactly {registered, duplicate, not_improved}. abandoned_by_consent_withdrawal is in neither the success nor the failure set: the Sisu-side outcome is permanently unknown to us, so every count, alert and stuck query must exclude it.';

CREATE TYPE credit_registration_error_code AS ENUM (
  'person_not_found',
  'course_code_not_found',
  'enrolment_not_found',
  'enrolment_not_accepted',
  'invalid_grade_for_grade_scale',
  'course_not_allowed',
  'invalid_credits',
  'study_right_not_valid',
  'acceptor_not_found',
  'sisu_validation_failed',
  'sisu_timeout',
  'sisu_temporarily_unavailable',
  'misregistered',
  'unauthorized',
  'malformed_request',
  'transport_error',
  'unexpected_response',
  'no_grade_scale_mapping',
  'missing_uh_course_code',
  'missing_ects_credits',
  'retry_window_expired',
  'unknown'
);

COMMENT ON TYPE credit_registration_error_code IS 'Why a credit registration is where it is. The first thirteen values are Suotar per-item codes taken verbatim from the accepted API proposal; the rest are ours. sisu_temporarily_unavailable and transport_error normally sit on failed_retryable, everything else on failed_permanent.';

CREATE TYPE credit_registration_event_kind AS ENUM (
  'created',
  'state_changed',
  'suotar_response',
  'retry_scheduled',
  'admin_action',
  'student_action',
  'cancelled'
);

COMMENT ON TYPE credit_registration_event_kind IS 'What kind of thing an append-only credit registration event records.';

CREATE TYPE suotar_endpoint AS ENUM (
  'resolve_persons',
  'resolve_enrolments',
  'import_attainments',
  'verify_attainments',
  'product_access_tokens',
  'list_by_course'
);

COMMENT ON TYPE suotar_endpoint IS 'Which Suotar endpoint an API call row is about.';

CREATE TYPE credit_registration_admin_action AS ENUM (
  'retry_item',
  'retry_failed_for_course',
  'force_recheck',
  'mark_resolved',
  'requeue_batch',
  'transition_item',
  'cancel_registration',
  'pause_course_module',
  'resume_course_module',
  'pause_phase',
  'resume_phase',
  'run_phase_now',
  'resend_link_email',
  'unlink_student_number',
  'manual_link_student_number',
  'override_rate_cap'
);

COMMENT ON TYPE credit_registration_admin_action IS 'Manual actions a global admin or a course teacher can take on the credit registration pipeline. There is deliberately no per-item pause: the per-module pause plus needs_admin_attention cover that case.';

CREATE TYPE credit_registration_admin_action_target AS ENUM (
  'credit_registration',
  'course_module',
  'course',
  'phase',
  'verified_student_number',
  'student_number_verification_token'
);

COMMENT ON TYPE credit_registration_admin_action_target IS 'What kind of thing a manual action was taken on. Not every target is a credit registration, which is why the manual-action audit cannot live on the per-item event table alone.';

CREATE TABLE credit_registrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_module_completion_id UUID NOT NULL REFERENCES course_module_completions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  course_module_id UUID NOT NULL REFERENCES course_modules(id),
  course_instance_id UUID NOT NULL REFERENCES course_instances(id),
  state credit_registration_state NOT NULL DEFAULT 'pending_prerequisites',
  state_entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error_code credit_registration_error_code,
  error_message TEXT,
  needs_admin_attention BOOLEAN NOT NULL DEFAULT FALSE,
  enrolment_banner_dismissed_at TIMESTAMP WITH TIME ZONE,
  student_number VARCHAR(32),
  sisu_person_id VARCHAR(255),
  uh_course_code VARCHAR(255),
  selected_enrolment_id VARCHAR(255),
  selected_enrolment_kind VARCHAR(64),
  selected_enrolment_realisation_id VARCHAR(255),
  attainment_date DATE,
  attainment_language VARCHAR(15),
  -- TODO: Suotar has not confirmed the pass/fail grade scale id spelling (sis-hyv-hyl vs
  -- sis-hyl-hyv). Whatever the client sends lands here verbatim.
  grade_scale_id VARCHAR(64),
  grade_id VARCHAR(16),
  credits REAL,
  request_item_id VARCHAR(128) NOT NULL,
  -- TODO: unknown whether a sisuTimeout ever carries a submittedAttainmentId. Without one,
  -- submission_uncertain recovery must fall back to resolve-enrolments' existingAttainments.
  -- Never resubmit either way.
  submitted_attainment_id VARCHAR(255),
  submitted_attainment_type VARCHAR(64),
  sisu_attainment_id VARCHAR(255),
  sisu_attainment_type VARCHAR(64),
  submit_retry_count INT NOT NULL DEFAULT 0,
  verify_attempt_count INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  first_failed_at TIMESTAMP WITH TIME ZONE,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  attempt_number INT NOT NULL DEFAULT 1,
  superseded_by_id UUID REFERENCES credit_registrations(id),
  superseded_at TIMESTAMP WITH TIME ZONE,
  enrolment_checked_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  registered_at TIMESTAMP WITH TIME ZONE,
  terminal_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Exactly one live registration per completion. Superseded rows (a grade improvement resubmitted a
-- better grade) stay as history and are excluded, so attempts accumulate but never two in flight.
CREATE UNIQUE INDEX uq_credit_registrations_completion ON credit_registrations (course_module_completion_id)
WHERE deleted_at IS NULL
  AND superseded_by_id IS NULL;
-- Makes "attempt 2 of 3" renderable and a double materialisation of one attempt impossible.
CREATE UNIQUE INDEX uq_credit_registrations_completion_attempt ON credit_registrations (course_module_completion_id, attempt_number)
WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_credit_registrations_submitted_attainment ON credit_registrations (submitted_attainment_id)
WHERE submitted_attainment_id IS NOT NULL
  AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_credit_registrations_sisu_attainment ON credit_registrations (sisu_attainment_id)
WHERE sisu_attainment_id IS NOT NULL
  AND deleted_at IS NULL;
-- Globally unique so a Suotar-side log line maps to exactly one row.
CREATE UNIQUE INDEX uq_credit_registrations_request_item_id ON credit_registrations (request_item_id);
-- The worker claim query.
CREATE INDEX idx_credit_registrations_due ON credit_registrations (state, next_attempt_at)
WHERE deleted_at IS NULL;
-- The stuck detector and the pipeline funnel.
CREATE INDEX idx_credit_registrations_state_entered ON credit_registrations (state, state_entered_at)
WHERE terminal_at IS NULL
  AND deleted_at IS NULL;
CREATE INDEX idx_credit_registrations_terminal_at ON credit_registrations (terminal_at)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registrations_user ON credit_registrations (user_id, created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registrations_course_module ON credit_registrations (course_module_id, state)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registrations_course_state ON credit_registrations (course_id, state)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registrations_admin_attention ON credit_registrations (updated_at DESC)
WHERE needs_admin_attention
  AND deleted_at IS NULL;
-- One Sisu person, not one student number: the number changes on a move to a degree programme, so a
-- guard keyed on it would let the same person register twice from two accounts. Superseded rows are
-- excluded because a grade improvement is deliberately a second submission for the same pair.
CREATE UNIQUE INDEX uq_credit_registrations_person_module ON credit_registrations (sisu_person_id, course_module_id)
WHERE sisu_person_id IS NOT NULL
  AND deleted_at IS NULL
  AND superseded_by_id IS NULL
  AND state IN (
    'submitting',
    'submission_uncertain',
    'awaiting_verification',
    'registered',
    'duplicate',
    'not_improved'
  );
CREATE INDEX idx_credit_registrations_superseded_by ON credit_registrations (superseded_by_id)
WHERE superseded_by_id IS NOT NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registrations FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE credit_registrations IS 'The credit registration ledger: one row per attempt at registering one course module completion into the study registry via Suotar. Every state write goes through credit_registrations::transition, which stamps state_entered_at and appends an event row in the same transaction; nothing else may update state.';
COMMENT ON COLUMN credit_registrations.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registrations.course_module_completion_id IS 'The completion being registered.';
COMMENT ON COLUMN credit_registrations.user_id IS 'The student whose completion this is.';
COMMENT ON COLUMN credit_registrations.course_id IS 'The course, denormalised from the completion so per-course reads need no join.';
COMMENT ON COLUMN credit_registrations.course_module_id IS 'The module, which is what carries the per-module configuration and pause.';
COMMENT ON COLUMN credit_registrations.course_instance_id IS 'The instance the completion was earned on.';
COMMENT ON COLUMN credit_registrations.state IS 'What the pipeline does next with this row.';
COMMENT ON COLUMN credit_registrations.state_entered_at IS 'When this row entered the state it is in now. A deliberate denormalisation of the newest state_changed event: every stuck-item query the dashboard runs filters on it, and expressing that against the event table would mean a correlated subquery on the hottest admin query in the product.';
COMMENT ON COLUMN credit_registrations.error_code IS 'Why the row is where it is. NULL when nothing has gone wrong.';
COMMENT ON COLUMN credit_registrations.error_message IS 'Human-readable detail for error_code, scrubbed of personal data before storage.';
COMMENT ON COLUMN credit_registrations.needs_admin_attention IS 'Set when the pipeline has given up deciding and a human must look. Takes the row out of every stuck count without stopping the pipeline.';
COMMENT ON COLUMN credit_registrations.enrolment_banner_dismissed_at IS 'When the student dismissed the persistent in-course-material re-enrol banner for this registration. Cleared on every fresh entry to no_usable_enrolment so a new problem is shown again.';
COMMENT ON COLUMN credit_registrations.student_number IS 'Frozen snapshot of the student number submitted. Filled while the enrolment is being checked and not changed afterwards, so a later regrade cannot silently alter a submitted row.';
COMMENT ON COLUMN credit_registrations.sisu_person_id IS 'Frozen snapshot of the Sisu person id submitted.';
COMMENT ON COLUMN credit_registrations.uh_course_code IS 'Frozen snapshot of the University of Helsinki course code submitted.';
COMMENT ON COLUMN credit_registrations.selected_enrolment_id IS 'The enrolment chosen by the selection policy and submitted.';
COMMENT ON COLUMN credit_registrations.selected_enrolment_kind IS 'Which kind of enrolment was chosen (degree or open university), for reporting on the selection policy.';
COMMENT ON COLUMN credit_registrations.selected_enrolment_realisation_id IS 'The course unit realisation the chosen enrolment belongs to.';
COMMENT ON COLUMN credit_registrations.attainment_date IS 'Frozen attainment date submitted.';
COMMENT ON COLUMN credit_registrations.attainment_language IS 'Frozen attainment language submitted, in whatever form the client sends.';
COMMENT ON COLUMN credit_registrations.grade_scale_id IS 'Frozen Sisu grade scale id submitted.';
COMMENT ON COLUMN credit_registrations.grade_id IS 'Frozen Sisu grade id submitted, within grade_scale_id.';
COMMENT ON COLUMN credit_registrations.credits IS 'Frozen ECTS credits submitted. REAL to match course_modules.ects_credits.';
COMMENT ON COLUMN credit_registrations.request_item_id IS 'The per-item id Suotar sees, generated once at row creation and stable for the row. Deterministic and greppable on both sides, so a Suotar log line maps to exactly one ledger row without an id allocation table.';
COMMENT ON COLUMN credit_registrations.submitted_attainment_id IS 'The attainment id Suotar returned when it accepted the import. The only handle verify polling has.';
COMMENT ON COLUMN credit_registrations.submitted_attainment_type IS 'The attainment type Suotar returned alongside submitted_attainment_id.';
COMMENT ON COLUMN credit_registrations.sisu_attainment_id IS 'The attainment id Sisu confirmed, learned from verify.';
COMMENT ON COLUMN credit_registrations.sisu_attainment_type IS 'The attainment type Sisu confirmed.';
COMMENT ON COLUMN credit_registrations.submit_retry_count IS 'How many times submission has been retried after a transient failure.';
COMMENT ON COLUMN credit_registrations.verify_attempt_count IS 'How many verify polls have been made. Also part of the verify request item id.';
COMMENT ON COLUMN credit_registrations.next_attempt_at IS 'When the pipeline may next claim this row. Backoff and verify cadence both write it.';
COMMENT ON COLUMN credit_registrations.first_failed_at IS 'When the first failure happened, the anchor of the retry window.';
COMMENT ON COLUMN credit_registrations.last_attempt_at IS 'When the pipeline last acted on this row.';
COMMENT ON COLUMN credit_registrations.attempt_number IS 'Which attempt at this completion this row is. Grade improvements insert a new attempt rather than mutating the registered one, and the UIs render "attempt 2 of 3" from this.';
COMMENT ON COLUMN credit_registrations.superseded_by_id IS 'The newer attempt that replaced this row. Set when a strictly better grade is resubmitted; the old row keeps its state and terminal_at, because it really was registered.';
COMMENT ON COLUMN credit_registrations.superseded_at IS 'When this row was superseded by a newer attempt.';
COMMENT ON COLUMN credit_registrations.enrolment_checked_at IS 'When enrolments were last resolved for this row.';
COMMENT ON COLUMN credit_registrations.submitted_at IS 'When the import request was sent.';
COMMENT ON COLUMN credit_registrations.registered_at IS 'When Sisu confirmed the attainment.';
COMMENT ON COLUMN credit_registrations.terminal_at IS 'When the row reached a terminal state. Set for every terminal state, which makes both the standard non-terminal filter and time-to-registration percentiles trivial.';
COMMENT ON COLUMN credit_registrations.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registrations.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registrations.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TABLE suotar_api_calls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  endpoint suotar_endpoint NOT NULL,
  request_item_count INT NOT NULL,
  http_status INT,
  duration_ms INT,
  succeeded BOOLEAN NOT NULL,
  ok_item_count INT NOT NULL DEFAULT 0,
  error_item_count INT NOT NULL DEFAULT 0,
  request_level_error_code VARCHAR(64),
  error_message TEXT,
  request_body_sample JSONB,
  response_body_sample JSONB,
  credit_registration_ids UUID [] NOT NULL DEFAULT '{}',
  worker_name VARCHAR(64) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_suotar_api_calls_endpoint_started ON suotar_api_calls (endpoint, started_at DESC);
CREATE INDEX idx_suotar_api_calls_started ON suotar_api_calls (started_at DESC);
CREATE INDEX idx_suotar_api_calls_failures ON suotar_api_calls (started_at DESC)
WHERE NOT succeeded;
-- GIN cannot serve `= ANY`, so the drill-down predicate has to stay `credit_registration_ids @> ...`.
CREATE INDEX idx_suotar_api_calls_registration_ids ON suotar_api_calls USING GIN (credit_registration_ids);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON suotar_api_calls FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE suotar_api_calls IS 'One row per HTTP call to Suotar, per batch rather than per item. Gives latency percentiles and error rate by endpoint without adding a metrics system. Retention is 90 days and the stored bodies are scrubbed; both, not either.';
COMMENT ON COLUMN suotar_api_calls.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN suotar_api_calls.endpoint IS 'Which Suotar endpoint was called.';
COMMENT ON COLUMN suotar_api_calls.request_item_count IS 'How many items the batch carried.';
COMMENT ON COLUMN suotar_api_calls.http_status IS 'HTTP status returned. NULL when the request never got a response.';
COMMENT ON COLUMN suotar_api_calls.duration_ms IS 'Wall-clock duration of the call in milliseconds.';
COMMENT ON COLUMN suotar_api_calls.succeeded IS 'Whether the call itself succeeded at the request level. Per-item errors do not make a call unsuccessful.';
COMMENT ON COLUMN suotar_api_calls.ok_item_count IS 'How many items the response accepted.';
COMMENT ON COLUMN suotar_api_calls.error_item_count IS 'How many items the response rejected.';
COMMENT ON COLUMN suotar_api_calls.request_level_error_code IS 'The code returned when the whole request was rejected rather than individual items.';
COMMENT ON COLUMN suotar_api_calls.error_message IS 'Request-level error detail, scrubbed before storage.';
COMMENT ON COLUMN suotar_api_calls.request_body_sample IS 'Scrubbed sample of the request body: full body for at most 20 items, otherwise the first 5 plus a count, truncated to 64 kB. scrub_suotar_body redacts at write time on a best-effort basis: student numbers, email addresses, access tokens and the known person fields go, while a personal name quoted in a free-text error message is deliberately kept because the study registry holds it anyway. Keys are kept so the payload shape stays debuggable. Rows here are swept after 90 days.';
COMMENT ON COLUMN suotar_api_calls.response_body_sample IS 'Scrubbed sample of the response body, same rules as request_body_sample.';
COMMENT ON COLUMN suotar_api_calls.credit_registration_ids IS 'The ledger rows this call covered, in request item id order. This is the replacement for the personal data removed from the bodies: debugging walks body to registration id to ledger row, where the real values are held in exactly one place.';
COMMENT ON COLUMN suotar_api_calls.worker_name IS 'Which worker or manual action made the call, so the submitter, the verify poller and an admin retry are distinguishable.';
COMMENT ON COLUMN suotar_api_calls.started_at IS 'When the request was sent. The retention sweep works on this.';
COMMENT ON COLUMN suotar_api_calls.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN suotar_api_calls.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN suotar_api_calls.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TABLE credit_registration_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  credit_registration_id UUID NOT NULL REFERENCES credit_registrations(id) ON DELETE RESTRICT,
  kind credit_registration_event_kind NOT NULL,
  from_state credit_registration_state,
  to_state credit_registration_state,
  error_code credit_registration_error_code,
  message TEXT,
  -- SET NULL, not RESTRICT: this table is permanent but suotar_api_calls is swept after 90 days, so
  -- the reference must be allowed to go stale rather than block the sweep.
  suotar_api_call_id UUID REFERENCES suotar_api_calls(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id),
  details JSONB,
  -- clock_timestamp(), not now(): events appended in one transaction must not all claim the same
  -- instant, or the timeline cannot be ordered.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_credit_registration_events_registration ON credit_registration_events (credit_registration_id, created_at DESC);
CREATE INDEX idx_credit_registration_events_kind_created ON credit_registration_events (kind, created_at DESC);
CREATE INDEX idx_credit_registration_events_error_code ON credit_registration_events (error_code, created_at DESC)
WHERE error_code IS NOT NULL;
-- The SET NULL above scans this table once per swept call, and it is never pruned.
CREATE INDEX idx_credit_registration_events_api_call ON credit_registration_events (suotar_api_call_id)
WHERE suotar_api_call_id IS NOT NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registration_events FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE credit_registration_events IS 'Append-only audit trail for the credit registration ledger. There is no retention sweep here, so anything stored survives the 90-day suotar_api_calls window; every Suotar payload written to details is scrubbed at write time, but only best-effort — email addresses, student-number-shaped digit runs, access tokens and the known person fields are removed, while a personal name quoted in a free-text error message is deliberately left in place because the study registry holds it anyway. Treat this table as holding personal data, not as a guaranteed personal-data-free store.';
COMMENT ON COLUMN credit_registration_events.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_events.credit_registration_id IS 'The ledger row this event belongs to. Also the reference that replaces the identifiers removed from details, since the ledger row holds the real snapshot values.';
COMMENT ON COLUMN credit_registration_events.kind IS 'What kind of event this is.';
COMMENT ON COLUMN credit_registration_events.from_state IS 'State before the change, for state_changed events.';
COMMENT ON COLUMN credit_registration_events.to_state IS 'State after the change, for state_changed events.';
COMMENT ON COLUMN credit_registration_events.error_code IS 'The error code that caused this event, when there was one.';
COMMENT ON COLUMN credit_registration_events.message IS 'Human-readable description, scrubbed of personal data before storage.';
COMMENT ON COLUMN credit_registration_events.suotar_api_call_id IS 'The batch call this event came out of, if any.';
COMMENT ON COLUMN credit_registration_events.actor_user_id IS 'The acting user, set for admin_action and student_action events.';
COMMENT ON COLUMN credit_registration_events.details IS 'Scrubbed per-item Suotar exchange, shaped {"request": <the item we sent>, "response": <the result or error we got>}. Both sides, because the admin drill-down renders them side by side and inferring the request afterwards is guesswork the moment anything is retried. Either key may be absent for non-Suotar events. Passed through scrub_suotar_body at every write site, never at read time.';
COMMENT ON COLUMN credit_registration_events.created_at IS 'Timestamp when the record was created, taken from the wall clock rather than the transaction start, so events appended in one transaction stay orderable. This is what the timeline sorts on.';
COMMENT ON COLUMN credit_registration_events.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registration_events.deleted_at IS 'Timestamp when the record was deleted. Exists for convention and for personal data erasure; events are not soft-deleted in normal operation.';

CREATE TABLE credit_registration_admin_actions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action credit_registration_admin_action NOT NULL,
  target_kind credit_registration_admin_action_target NOT NULL,
  target_id UUID,
  target_phase VARCHAR(64),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  actor_role VARCHAR(32) NOT NULL,
  actor_course_id UUID REFERENCES courses(id),
  reason TEXT,
  before_state credit_registration_state,
  after_state credit_registration_state,
  details JSONB,
  affected_row_count INT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  -- A row breaking either of these is reachable from neither get_by_target nor get_by_phase.
  CONSTRAINT credit_registration_admin_actions_target_id_kind CHECK (
    (target_id IS NULL) = (target_kind = 'phase')
  ),
  CONSTRAINT credit_registration_admin_actions_target_phase_kind CHECK (
    (target_phase IS NOT NULL) = (target_kind = 'phase')
  )
);
CREATE INDEX idx_credit_registration_admin_actions_created ON credit_registration_admin_actions (created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registration_admin_actions_actor ON credit_registration_admin_actions (actor_user_id, created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registration_admin_actions_target ON credit_registration_admin_actions (target_kind, target_id, created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registration_admin_actions_course ON credit_registration_admin_actions (actor_course_id, created_at DESC)
WHERE actor_course_id IS NOT NULL
  AND deleted_at IS NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registration_admin_actions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE credit_registration_admin_actions IS 'One row per manual action on the credit registration pipeline, written in the same transaction as the effect. Separate from credit_registration_events because this is a global, actor-ordered read with a before/after pair and targets that are not registrations at all: a phase, a course module, a student-number link.';
COMMENT ON COLUMN credit_registration_admin_actions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_admin_actions.action IS 'Which action was taken.';
COMMENT ON COLUMN credit_registration_admin_actions.target_kind IS 'What kind of thing the action was taken on.';
COMMENT ON COLUMN credit_registration_admin_actions.target_id IS 'The target row. NULL only for phase targets, which are keyed by name instead.';
COMMENT ON COLUMN credit_registration_admin_actions.target_phase IS 'The pipeline phase acted on, set exactly when target_kind is phase.';
COMMENT ON COLUMN credit_registration_admin_actions.actor_user_id IS 'Who took the action.';
COMMENT ON COLUMN credit_registration_admin_actions.actor_role IS 'Whether the actor acted as global_admin or as course_teacher. The same action can arrive from either, and "was this done by staff on their own course, or by us?" is the first audit question.';
COMMENT ON COLUMN credit_registration_admin_actions.actor_course_id IS 'The course whose edit permission authorised a teacher action, so "a teacher retried 40 items on a course they no longer teach" is answerable. NULL for global admin actions.';
COMMENT ON COLUMN credit_registration_admin_actions.reason IS 'The reason the actor typed. Nullable in the schema but required by the handlers for the destructive and overriding actions, because the required set will change and a migration per policy tweak is not worth it.';
COMMENT ON COLUMN credit_registration_admin_actions.before_state IS 'Ledger state before the action, for item-targeted actions.';
COMMENT ON COLUMN credit_registration_admin_actions.after_state IS 'Ledger state after the action, for item-targeted actions.';
COMMENT ON COLUMN credit_registration_admin_actions.details IS 'Freeform context for the action, scrubbed before storage if it ever carries a Suotar payload.';
COMMENT ON COLUMN credit_registration_admin_actions.affected_row_count IS 'Blast radius of a bulk action such as retrying every failed item on a course.';
COMMENT ON COLUMN credit_registration_admin_actions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registration_admin_actions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registration_admin_actions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TABLE open_university_product_access_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  open_university_product_id VARCHAR(255) NOT NULL,
  access_token VARCHAR(255) NOT NULL,
  state VARCHAR(64) NOT NULL,
  document_state VARCHAR(64) NOT NULL,
  suotar_token_id VARCHAR(255),
  last_refreshed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_refresh_failed_at TIMESTAMP WITH TIME ZONE,
  last_refresh_error TEXT,
  consecutive_failures INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX uq_ou_product_access_tokens_product ON open_university_product_access_tokens (open_university_product_id, deleted_at) NULLS NOT DISTINCT;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON open_university_product_access_tokens FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE open_university_product_access_tokens IS 'Access tokens used to build working Sisu enrolment links for open university products. The last good token is kept when a refresh fails on purpose: a link that works with a slightly stale token beats a broken page.';
COMMENT ON COLUMN open_university_product_access_tokens.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN open_university_product_access_tokens.open_university_product_id IS 'The open university product the token is for.';
COMMENT ON COLUMN open_university_product_access_tokens.access_token IS 'The token itself. A secret: it must never reach a log line or a stored Suotar body sample.';
COMMENT ON COLUMN open_university_product_access_tokens.state IS 'Token state as Suotar reports it.';
COMMENT ON COLUMN open_university_product_access_tokens.document_state IS 'Document state as Suotar reports it.';
COMMENT ON COLUMN open_university_product_access_tokens.suotar_token_id IS 'Suotar-side identifier for this token, for support conversations.';
COMMENT ON COLUMN open_university_product_access_tokens.last_refreshed_at IS 'When the token was last successfully refreshed.';
COMMENT ON COLUMN open_university_product_access_tokens.last_refresh_failed_at IS 'When a refresh last failed.';
COMMENT ON COLUMN open_university_product_access_tokens.last_refresh_error IS 'Why the last refresh failed.';
COMMENT ON COLUMN open_university_product_access_tokens.consecutive_failures IS 'How many refreshes have failed in a row. Drives the amber or red badge on the admin dashboard.';
COMMENT ON COLUMN open_university_product_access_tokens.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN open_university_product_access_tokens.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN open_university_product_access_tokens.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TABLE credit_registration_phase_state (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phase VARCHAR(64) NOT NULL,
  process_name VARCHAR(64) NOT NULL,
  expected_interval_secs INT NOT NULL,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  last_run_started_at TIMESTAMP WITH TIME ZONE,
  last_run_finished_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  items_processed_last_run INT,
  items_failed_last_run INT,
  consecutive_failures INT NOT NULL DEFAULT 0,
  last_error TEXT,
  paused_at TIMESTAMP WITH TIME ZONE,
  paused_by_user_id UUID REFERENCES users(id),
  pause_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX uq_credit_registration_phase_state_phase ON credit_registration_phase_state (phase, deleted_at) NULLS NOT DISTINCT;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registration_phase_state FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE credit_registration_phase_state IS 'One row per pipeline phase, not per worker process. Phases are what an operator reasons about, what the dashboard lists and what the system tests tick individually. Rows are seeded by migration and thereafter only ever updated.';
COMMENT ON COLUMN credit_registration_phase_state.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_phase_state.phase IS 'The canonical phase name, used verbatim here, in the test tick endpoint, in the dashboard and in the audit log.';
COMMENT ON COLUMN credit_registration_phase_state.process_name IS 'Which worker process runs this phase.';
COMMENT ON COLUMN credit_registration_phase_state.expected_interval_secs IS 'How often the phase is expected to run. Persisted rather than hardcoded in the frontend because the "phase is down" rule is evaluated server-side and rendered client-side, and it should be one number in one place.';
COMMENT ON COLUMN credit_registration_phase_state.last_heartbeat_at IS 'Written on every iteration whether or not there was work, so idle and wedged are distinguishable.';
COMMENT ON COLUMN credit_registration_phase_state.last_run_started_at IS 'When the phase last began an iteration.';
COMMENT ON COLUMN credit_registration_phase_state.last_run_finished_at IS 'When the phase last finished an iteration.';
COMMENT ON COLUMN credit_registration_phase_state.last_success_at IS 'When the phase last completed a unit of work without error.';
COMMENT ON COLUMN credit_registration_phase_state.next_run_at IS 'When the phase should next run. Setting it to now() is how the admin run-now action works, using the same mechanism the phase already uses for its own scheduling.';
COMMENT ON COLUMN credit_registration_phase_state.items_processed_last_run IS 'How many items the last iteration handled.';
COMMENT ON COLUMN credit_registration_phase_state.items_failed_last_run IS 'How many items the last iteration failed on.';
COMMENT ON COLUMN credit_registration_phase_state.consecutive_failures IS 'Observable copy of the in-process circuit-breaker counter, written each tick.';
COMMENT ON COLUMN credit_registration_phase_state.last_error IS 'The last error the phase recorded.';
COMMENT ON COLUMN credit_registration_phase_state.paused_at IS 'While set, the phase skips its body. A phase flag rather than scaling a deployment to zero, because half the phases are database-only and useful during a Suotar outage.';
COMMENT ON COLUMN credit_registration_phase_state.paused_by_user_id IS 'Who paused the phase.';
COMMENT ON COLUMN credit_registration_phase_state.pause_reason IS 'Why the phase was paused.';
COMMENT ON COLUMN credit_registration_phase_state.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registration_phase_state.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registration_phase_state.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

INSERT INTO credit_registration_phase_state (phase, process_name, expected_interval_secs)
VALUES ('materialize', 'credit-registrar', 60),
  ('preconditions', 'credit-registrar', 10),
  ('resolve-enrolments', 'credit-registrar', 10),
  ('import', 'credit-registrar', 10),
  ('verify', 'credit-registrar', 60),
  ('legacy-mirror', 'credit-registrar', 60),
  ('student-notifications', 'credit-registrar', 60),
  ('enrolment-discovery', 'suotar-syncer', 1800),
  ('link-emails', 'suotar-syncer', 1800),
  ('product-token-refresh', 'suotar-syncer', 21600),
  ('config-validation', 'suotar-syncer', 86400),
  ('retention-sweep', 'suotar-syncer', 3600);

CREATE TABLE credit_registration_daily_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  state credit_registration_state NOT NULL,
  count INT NOT NULL,
  entered_count INT NOT NULL DEFAULT 0,
  left_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX uq_credit_registration_daily_snapshots ON credit_registration_daily_snapshots (snapshot_date, state, deleted_at) NULLS NOT DISTINCT;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registration_daily_snapshots FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE credit_registration_daily_snapshots IS 'Daily queue depth per ledger state. The ledger holds current state only, so a row that passed through a state in an hour leaves no depth trace and the dashboard trend charts have nothing to read. Aggregates only, deliberately: anything per-person belongs in the ledger. Roughly sixteen rows a day, so no retention policy is needed.';
COMMENT ON COLUMN credit_registration_daily_snapshots.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_daily_snapshots.snapshot_date IS 'The day this row describes.';
COMMENT ON COLUMN credit_registration_daily_snapshots.state IS 'The ledger state this row counts.';
COMMENT ON COLUMN credit_registration_daily_snapshots.count IS 'End-of-day depth in this state.';
COMMENT ON COLUMN credit_registration_daily_snapshots.entered_count IS 'How many rows entered this state that day, from the event table. Makes the funnel flow columns cheap.';
COMMENT ON COLUMN credit_registration_daily_snapshots.left_count IS 'How many rows left this state that day, from the event table.';
COMMENT ON COLUMN credit_registration_daily_snapshots.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registration_daily_snapshots.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registration_daily_snapshots.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

-- The registrar the push path attributes its legacy-ledger mirror rows to, which keeps the existing
-- teacher UI's registered boolean and ?exclude_already_registered=true working. The id is fixed so
-- seeds and tests can reference it.
INSERT INTO study_registry_registrars (id, name, secret_key)
VALUES (
    '9da5a12f-0b96-4c35-a4fe-6d427d9c4292',
    'Suotar (push)',
    encode(gen_random_bytes(32), 'hex')
  );

-- Added ahead of use: a new enum value cannot be used in the transaction that adds it, so nothing
-- here can seed a template row.
ALTER TYPE email_template_type
ADD VALUE 'credit_registration_account_linking';
ALTER TYPE email_template_type
ADD VALUE 'verify_email_address';
ALTER TYPE email_template_type
ADD VALUE 'credit_registration_action_needed';
ALTER TYPE email_template_type
ADD VALUE 'credit_registration_registered';
ALTER TYPE email_template_type
ADD VALUE 'credit_registration_student_number_linked';

ALTER TABLE course_modules
ADD COLUMN enable_credit_registration_via_suotar BOOLEAN NOT NULL DEFAULT FALSE,
  -- TODO: unknown whether Suotar's API returns openUniversityProductId. Until it does, teachers
  -- type it in here; prefer a returned id over this one once there is one.
  ADD COLUMN open_university_product_id VARCHAR(255),
  -- The override exists because a module may be pass/fail here but graded in Sisu, or vice versa.
  ADD COLUMN credit_registration_grade_scale_id VARCHAR(64),
  ADD COLUMN credit_registration_paused_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN credit_registration_paused_by_user_id UUID REFERENCES users(id),
  ADD COLUMN credit_registration_pause_reason TEXT,
  ADD COLUMN credit_registration_config_checked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN credit_registration_course_code_resolves BOOLEAN,
  ADD COLUMN credit_registration_product_token_found BOOLEAN,
  ADD COLUMN credit_registration_config_check_message TEXT;

-- NOT VALID: enable_credit_registration_via_suotar is FALSE in every existing row, which conforms.
-- Inserts and updates are still checked.
ALTER TABLE course_modules
ADD CONSTRAINT course_modules_one_credit_registration_path CHECK (
    NOT (
      enable_credit_registration_via_suotar
      AND enable_registering_completion_to_uh_open_university
    )
  ) NOT VALID;

CREATE INDEX idx_course_modules_suotar_enabled ON course_modules (course_id, order_number)
WHERE enable_credit_registration_via_suotar
  AND deleted_at IS NULL;

COMMENT ON COLUMN course_modules.enable_credit_registration_via_suotar IS 'The per-module opt-in for credit registration via Suotar, and the rollout switch. The course_modules_one_credit_registration_path constraint keeps it mutually exclusive with enable_registering_completion_to_uh_open_university, because both paths would register the same attainment in Sisu; while it is on, the legacy pull API must not see this modules completions.';
COMMENT ON COLUMN course_modules.open_university_product_id IS 'The open university product used to build Sisu enrolment links for this module.';
COMMENT ON COLUMN course_modules.credit_registration_grade_scale_id IS 'Per-module override of the Sisu grade scale id. NULL means derive it from the completion.';
COMMENT ON COLUMN course_modules.credit_registration_paused_at IS 'While set, no pipeline phase claims rows for this module and the module renders as paused rather than broken. Pausing does not rewrite ledger states, which is what makes resuming a no-op.';
COMMENT ON COLUMN course_modules.credit_registration_paused_by_user_id IS 'Who paused credit registration for this module.';
COMMENT ON COLUMN course_modules.credit_registration_pause_reason IS 'Why credit registration was paused for this module.';
COMMENT ON COLUMN course_modules.credit_registration_config_checked_at IS 'When the config-validation phase last checked this module. NULL together with the two check booleans means never checked, so the admin view can show unknown instead of implying a passing check it never ran.';
COMMENT ON COLUMN course_modules.credit_registration_course_code_resolves IS 'Whether the configured course code resolved at the last config check. NULL means not checked yet.';
COMMENT ON COLUMN course_modules.credit_registration_product_token_found IS 'Whether an access token was found for the configured product at the last config check. NULL means not checked yet.';
COMMENT ON COLUMN course_modules.credit_registration_config_check_message IS 'Human-readable detail from the last config check.';

CREATE TABLE course_module_suotar_realisations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_module_id UUID NOT NULL REFERENCES course_modules(id),
  course_unit_realisation_id VARCHAR(255) NOT NULL,
  label VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_listed_at TIMESTAMP WITH TIME ZONE,
  last_listed_person_count INT,
  last_already_linked_count INT,
  last_mailed_count INT,
  last_suppressed_by_dedup_count INT,
  last_suppressed_by_rate_cap_count INT,
  last_no_address_count INT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX uq_course_module_suotar_realisations ON course_module_suotar_realisations (
  course_module_id,
  course_unit_realisation_id,
  deleted_at
) NULLS NOT DISTINCT;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_module_suotar_realisations FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE course_module_suotar_realisations IS 'Which Sisu course unit realisations a module maps to, one per term. Enrolment discovery polls the active ones. The last-run counters give teachers and admins feedback that the configuration is right without reading logs.';
COMMENT ON COLUMN course_module_suotar_realisations.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_module_suotar_realisations.course_module_id IS 'The module this realisation belongs to.';
COMMENT ON COLUMN course_module_suotar_realisations.course_unit_realisation_id IS 'The Sisu course unit realisation id.';
COMMENT ON COLUMN course_module_suotar_realisations.label IS 'Human-readable label for the realisation, for the admin and teacher views.';
COMMENT ON COLUMN course_module_suotar_realisations.active IS 'Whether enrolment discovery currently polls this realisation.';
COMMENT ON COLUMN course_module_suotar_realisations.last_listed_at IS 'When enrolment discovery last listed this realisation.';
COMMENT ON COLUMN course_module_suotar_realisations.last_listed_person_count IS 'How many persons the last listing returned.';
COMMENT ON COLUMN course_module_suotar_realisations.last_already_linked_count IS 'Of the last listing, how many persons already had a linked account.';
COMMENT ON COLUMN course_module_suotar_realisations.last_mailed_count IS 'Of the last listing, how many linking mails were queued.';
COMMENT ON COLUMN course_module_suotar_realisations.last_suppressed_by_dedup_count IS 'Of the last listing, how many mails were suppressed because we had already mailed that person and address for this course.';
COMMENT ON COLUMN course_module_suotar_realisations.last_suppressed_by_rate_cap_count IS 'Of the last listing, how many mails were suppressed by a per-person rate cap.';
COMMENT ON COLUMN course_module_suotar_realisations.last_no_address_count IS 'Of the last listing, how many persons had no usable address to mail.';
COMMENT ON COLUMN course_module_suotar_realisations.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_module_suotar_realisations.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_module_suotar_realisations.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

ALTER TABLE email_deliveries
ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN recipient_email VARCHAR(255),
  ADD COLUMN placeholders JSONB;

-- Not "exactly one": retention nulls recipient_email once the address is no longer needed, leaving a
-- row with neither. Such a row must be unsendable, hence the second clause -- and fetch_emails also
-- skips it, because a NULL recipient_email with no user_id yields no address to send to.
-- NOT VALID: every existing row has user_id set and no recipient_email, so it already conforms.
-- Inserts and updates are still checked.
ALTER TABLE email_deliveries
ADD CONSTRAINT email_deliveries_has_exactly_one_recipient CHECK (
    NOT (
      user_id IS NOT NULL
      AND recipient_email IS NOT NULL
    )
    AND (
      sent
      OR deleted_at IS NOT NULL
      OR user_id IS NOT NULL
      OR recipient_email IS NOT NULL
    )
  ) NOT VALID;

COMMENT ON COLUMN email_deliveries.user_id IS 'The user to whom the email should be sent. NULL for emails addressed to a raw external address (see recipient_email), e.g. student-number linking mails sent to the address Sisu holds for a person who may not have an account here. Never set together with recipient_email.';
COMMENT ON COLUMN email_deliveries.recipient_email IS 'Explicit recipient address, used when the email is not addressed to a known user. Never set together with user_id, and nulled by retention once the delivery is sent or retired, so an old row holds no address.';
COMMENT ON COLUMN email_deliveries.placeholders IS 'Placeholder bag substituted into the template body at send time. Used when the recipient has no account, so the sender needs no user lookup. NULL means the template derives its placeholders from user_id.';

CREATE TYPE user_email_code_purpose AS ENUM (
  'admin_login',
  'account_deletion',
  'email_ownership_verification'
);

COMMENT ON TYPE user_email_code_purpose IS 'What an emailed single-use code authorises. A discriminator, not a label: every read of user_email_codes is scoped by it, so a code mailed for one action cannot be spent on another.';

-- ADD COLUMN with a DEFAULT is metadata-only on PG 11+, so the live table is not rewritten; the
-- default is then dropped because a purpose must always be stated by the writer.
ALTER TABLE user_email_codes
ADD COLUMN purpose user_email_code_purpose NOT NULL DEFAULT 'account_deletion',
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE user_email_codes
ALTER COLUMN purpose DROP DEFAULT;

-- Pre-existing rows are single-use codes with a one hour TTL, so any still live are already dead in
-- practice. Retiring them means no code outlives the purpose change with an invented purpose.
UPDATE user_email_codes
SET deleted_at = now()
WHERE deleted_at IS NULL;

DROP INDEX unique_active_user_email_codes_user;

CREATE UNIQUE INDEX unique_active_user_email_codes_user ON user_email_codes (user_id, purpose)
WHERE deleted_at IS NULL
  AND used_at IS NULL;

COMMENT ON TABLE user_email_codes IS 'Single-use codes emailed to a user to prove they can read their own mailbox before an action: the administrator login second factor, account deletion, and email address ownership verification. At most one live code per user per purpose; requesting a new one retires the old.';
COMMENT ON COLUMN user_email_codes.purpose IS 'Which action this code authorises.';
COMMENT ON COLUMN user_email_codes.attempt_count IS 'Wrong guesses recorded against this code. The checking handler retires the code once its own limit is reached, which is what stops a six digit code from being brute forced.';

CREATE TYPE email_verification_method AS ENUM (
  'emailed_code',
  'password_reset_backfill',
  'tmc_confirmed',
  'admin_asserted'
);

COMMENT ON TYPE email_verification_method IS 'How proof of control over user_details.email was obtained. admin_asserted is deliberately weaker than the others and is not accepted by the credit-registration email-match fast track.';

ALTER TABLE user_details
ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN email_verified_method email_verification_method;

-- NOT VALID: both columns are NULL in every existing row, which conforms. Inserts and updates are
-- still checked.
ALTER TABLE user_details
ADD CONSTRAINT user_details_email_verification_consistent CHECK (
    (email_verified_at IS NULL) = (email_verified_method IS NULL)
  ) NOT VALID;

COMMENT ON COLUMN user_details.email_verified_at IS 'When the user last proved control of the address currently in email. NULL means unproven. Automatically reset to NULL by the clear_email_verification trigger whenever email changes, so a non-NULL value always refers to the current address. Never set this without a proof of mailbox control.';
COMMENT ON COLUMN user_details.email_verified_method IS 'How email_verified_at was obtained. The credit-registration email-match fast track accepts emailed_code and tmc_confirmed only.';

-- Structural, not remembered per writer: there are already three writers of user_details.email and
-- the fourth will be added by someone who has not read the fast-track design. Retiring the pending
-- verification code belongs here for the same reason, and because a code mailed to the old address
-- must not be able to prove the new one.
CREATE FUNCTION clear_email_verification_on_email_change() RETURNS trigger AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.email_verified_at := NULL;
    NEW.email_verified_method := NULL;
    UPDATE user_email_codes
    SET deleted_at = now()
    WHERE user_id = NEW.user_id
      AND purpose = 'email_ownership_verification'
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clear_email_verification BEFORE
UPDATE ON user_details FOR EACH ROW EXECUTE FUNCTION clear_email_verification_on_email_change();

-- A consumed password_reset_token proves control of the address held at used_at. updated_at is the
-- only bound available on "the address has not changed since", so this is sound but deliberately
-- under-inclusive; deleted_at is ignored because insert_password_reset_token soft-deletes used rows
-- too. Re-running after a revert finds nothing: this write bumps updated_at past last_used.
UPDATE user_details ud
SET email_verified_at = t.last_used,
  email_verified_method = 'password_reset_backfill'
FROM (
    SELECT user_id,
      MAX(used_at) AS last_used
    FROM password_reset_tokens
    WHERE used_at IS NOT NULL
    GROUP BY user_id
  ) t
WHERE t.user_id = ud.user_id
  AND t.last_used > ud.updated_at;
