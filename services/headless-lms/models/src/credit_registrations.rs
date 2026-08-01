//! The credit registration ledger.
//!
//! [`transition`] is the only writer of `state`, stamping `state_entered_at`, the lifecycle
//! timestamps and the audit event in one transaction. Policy — which transition to make, how to
//! back off, grade mapping, enrolment choice — lives in the state machine, not here.
use chrono::NaiveDate;
use utoipa::ToSchema;

use crate::credit_registration_events::{CreditRegistrationEventKind, NewCreditRegistrationEvent};
use crate::library::students_view::escape_like_pattern;
use crate::prelude::*;
use crate::suotar_api_calls::SuotarEndpoint;
use crate::verified_student_numbers::StudentNumberVerificationMethod;

/// What the pipeline does next with a ledger row.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, Type, ToSchema)]
#[sqlx(type_name = "credit_registration_state", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationState {
    PendingPrerequisites,
    PendingConsent,
    PendingStudentNumber,
    ReadyToSubmit,
    CheckingEnrolment,
    NoUsableEnrolment,
    Submitting,
    SubmissionUncertain,
    AwaitingVerification,
    Registered,
    Duplicate,
    NotImproved,
    Misregistered,
    FailedRetryable,
    FailedPermanent,
    Blocked,
    Cancelled,
    AbandonedByConsentWithdrawal,
}

impl CreditRegistrationState {
    /// Every state, so a classification can be proven exhaustive at runtime as well as at compile
    /// time.
    pub const ALL: [Self; 18] = [
        Self::PendingPrerequisites,
        Self::PendingConsent,
        Self::PendingStudentNumber,
        Self::ReadyToSubmit,
        Self::CheckingEnrolment,
        Self::NoUsableEnrolment,
        Self::Submitting,
        Self::SubmissionUncertain,
        Self::AwaitingVerification,
        Self::Registered,
        Self::Duplicate,
        Self::NotImproved,
        Self::Misregistered,
        Self::FailedRetryable,
        Self::FailedPermanent,
        Self::Blocked,
        Self::Cancelled,
        Self::AbandonedByConsentWithdrawal,
    ];

    /// States the pipeline never leaves on its own. `terminal_at` tracks membership: stamped on
    /// entry, cleared on exit, so an admin retry becomes visible to the stuck queries again.
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Registered
                | Self::Duplicate
                | Self::NotImproved
                | Self::FailedPermanent
                | Self::Cancelled
                | Self::AbandonedByConsentWithdrawal
        )
    }

    /// Entry to one of these anchors the retry window in `first_failed_at`.
    pub fn is_failure(self) -> bool {
        matches!(self, Self::FailedRetryable | Self::FailedPermanent)
    }

    /// Used for reporting and for the double-registration guard.
    pub fn is_success(self) -> bool {
        matches!(self, Self::Registered | Self::Duplicate | Self::NotImproved)
    }
}

/// Why a ledger row is where it is; `state` says what happens to it next.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, Type, ToSchema)]
#[sqlx(
    type_name = "credit_registration_error_code",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationErrorCode {
    PersonNotFound,
    CourseCodeNotFound,
    EnrolmentNotFound,
    EnrolmentNotAccepted,
    InvalidGradeForGradeScale,
    CourseNotAllowed,
    InvalidCredits,
    StudyRightNotValid,
    AcceptorNotFound,
    SisuValidationFailed,
    SisuTimeout,
    SisuTemporarilyUnavailable,
    Misregistered,
    Unauthorized,
    MalformedRequest,
    TransportError,
    UnexpectedResponse,
    NoGradeScaleMapping,
    MissingUhCourseCode,
    MissingEctsCredits,
    RetryWindowExpired,
    Unknown,
}

impl CreditRegistrationErrorCode {
    /// Every code, so the retryability classification can be proven total at runtime as well as at
    /// compile time.
    pub const ALL: [Self; 22] = [
        Self::PersonNotFound,
        Self::CourseCodeNotFound,
        Self::EnrolmentNotFound,
        Self::EnrolmentNotAccepted,
        Self::InvalidGradeForGradeScale,
        Self::CourseNotAllowed,
        Self::InvalidCredits,
        Self::StudyRightNotValid,
        Self::AcceptorNotFound,
        Self::SisuValidationFailed,
        Self::SisuTimeout,
        Self::SisuTemporarilyUnavailable,
        Self::Misregistered,
        Self::Unauthorized,
        Self::MalformedRequest,
        Self::TransportError,
        Self::UnexpectedResponse,
        Self::NoGradeScaleMapping,
        Self::MissingUhCourseCode,
        Self::MissingEctsCredits,
        Self::RetryWindowExpired,
        Self::Unknown,
    ];
}

/// Suotar's per-item `code` as a ledger error code.
///
/// `None` where the code names no failure of ours to record: every success code, and verify's
/// `notRegistered`, which only means Sisu has not finished yet. An unrecognised code becomes
/// [`CreditRegistrationErrorCode::Unknown`] and keeps its raw string in `error_message`, because
/// Suotar may add codes and a strict mapping would take the pipeline down the day they do.
pub fn map_code(endpoint: SuotarEndpoint, code: &str) -> Option<CreditRegistrationErrorCode> {
    use CreditRegistrationErrorCode as Code;
    let mapped = match code {
        "personFound"
        | "enrolmentFound"
        | "registered"
        | "sent"
        | "duplicateAttainment"
        | "notImprovedAttainment"
        | "found"
        | "enrolmentsListed"
        | "notRegistered" => return None,
        "personNotFound" => Code::PersonNotFound,
        "courseCodeNotFound" => Code::CourseCodeNotFound,
        "enrolmentNotFound" => Code::EnrolmentNotFound,
        "enrolmentNotAccepted" => Code::EnrolmentNotAccepted,
        "invalidGradeForGradeScale" => Code::InvalidGradeForGradeScale,
        "courseNotAllowed" => Code::CourseNotAllowed,
        "invalidCredits" => Code::InvalidCredits,
        "studyRightNotValid" => Code::StudyRightNotValid,
        "acceptorNotFound" => Code::AcceptorNotFound,
        "sisuValidationFailed" => Code::SisuValidationFailed,
        "sisuTimeout" => Code::SisuTimeout,
        "misregistered" => Code::Misregistered,
        "unauthorized" => Code::Unauthorized,
        "malformedRequest" => Code::MalformedRequest,
        // Import's contract has no per-item transient, so one arriving there is not evidence that
        // nothing was created. Retrying it could put a second attainment on a transcript.
        "sisuTemporarilyUnavailable" if endpoint == SuotarEndpoint::ImportAttainments => {
            Code::SisuTimeout
        }
        "sisuTemporarilyUnavailable" => Code::SisuTemporarilyUnavailable,
        _ => Code::Unknown,
    };
    Some(mapped)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_module_completion_id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub course_instance_id: Uuid,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub error_message: Option<String>,
    pub needs_admin_attention: bool,
    pub enrolment_banner_dismissed_at: Option<DateTime<Utc>>,
    pub student_number: Option<String>,
    pub sisu_person_id: Option<String>,
    pub uh_course_code: Option<String>,
    pub selected_enrolment_id: Option<String>,
    pub selected_enrolment_kind: Option<String>,
    pub selected_enrolment_realisation_id: Option<String>,
    pub attainment_date: Option<NaiveDate>,
    pub attainment_language: Option<String>,
    pub grade_scale_id: Option<String>,
    pub grade_id: Option<String>,
    pub credits: Option<f32>,
    pub request_item_id: String,
    pub submitted_attainment_id: Option<String>,
    pub submitted_attainment_type: Option<String>,
    pub sisu_attainment_id: Option<String>,
    pub sisu_attainment_type: Option<String>,
    pub submit_retry_count: i32,
    pub verify_attempt_count: i32,
    pub next_attempt_at: DateTime<Utc>,
    pub first_failed_at: Option<DateTime<Utc>>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub attempt_number: i32,
    pub superseded_by_id: Option<Uuid>,
    pub superseded_at: Option<DateTime<Utc>>,
    pub enrolment_checked_at: Option<DateTime<Utc>>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub registered_at: Option<DateTime<Utc>>,
    pub terminal_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewCreditRegistration {
    pub course_module_completion_id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub course_instance_id: Uuid,
    pub attempt_number: i32,
}

/// The item id Suotar sees for the import and resolve calls. Deterministic, so a Suotar log line
/// maps to exactly one ledger row without an id allocation table.
pub fn import_request_item_id(registration_id: Uuid) -> String {
    format!("cr-{registration_id}")
}

/// The item id Suotar sees for one verify poll.
pub fn verify_request_item_id(registration_id: Uuid, verify_attempt_count: i32) -> String {
    format!("vf-{registration_id}-{verify_attempt_count}")
}

/// Creates a ledger row at `pending_prerequisites` with a `created` event. The id is allocated here
/// because `request_item_id` derives from it.
pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new: &NewCreditRegistration,
    event_message: Option<&str>,
) -> ModelResult<Uuid> {
    let id = pkey_policy.into_uuid();
    let mut tx = conn.begin().await?;
    sqlx::query!(
        r#"
INSERT INTO credit_registrations (
    id,
    course_module_completion_id,
    user_id,
    course_id,
    course_module_id,
    course_instance_id,
    attempt_number,
    request_item_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
        id,
        new.course_module_completion_id,
        new.user_id,
        new.course_id,
        new.course_module_id,
        new.course_instance_id,
        new.attempt_number,
        import_request_item_id(id),
    )
    .execute(&mut *tx)
    .await?;

    crate::credit_registration_events::insert(
        &mut tx,
        &NewCreditRegistrationEvent {
            message: event_message.map(str::to_string),
            ..NewCreditRegistrationEvent::new(id, CreditRegistrationEventKind::Created)
        },
    )
    .await?;

    tx.commit().await?;
    Ok(id)
}

#[derive(Debug, Clone, PartialEq)]
pub struct Transition {
    pub to_state: CreditRegistrationState,
    pub error_code: Option<CreditRegistrationErrorCode>,
    /// Scrub before passing: this is persisted.
    pub error_message: Option<String>,
    pub needs_admin_attention: Option<bool>,
    pub event_kind: CreditRegistrationEventKind,
    pub event_message: Option<String>,
    pub actor_user_id: Option<Uuid>,
    pub suotar_api_call_id: Option<Uuid>,
    /// Already scrubbed `{request, response}` payload for the event row.
    pub event_details: Option<serde_json::Value>,
}

impl Transition {
    pub fn to(to_state: CreditRegistrationState) -> Self {
        Self {
            to_state,
            error_code: None,
            error_message: None,
            needs_admin_attention: None,
            event_kind: CreditRegistrationEventKind::StateChanged,
            event_message: None,
            actor_user_id: None,
            suotar_api_call_id: None,
            event_details: None,
        }
    }
}

/// Moves a ledger row to a new state and appends the matching audit event, atomically.
///
/// Also stamps, so callers must not: `state_entered_at` (every call, including a self-transition),
/// `terminal_at` (set on entry to a terminal state, cleared on leaving one), `first_failed_at` (the
/// first failure only), `registered_at`, `submitted_at`, `enrolment_checked_at` (on leaving
/// `checking_enrolment`), and clears `enrolment_banner_dismissed_at` on entry to
/// `no_usable_enrolment` so a fresh enrolment problem shows the banner again.
pub async fn transition(
    conn: &mut PgConnection,
    id: Uuid,
    transition: &Transition,
) -> ModelResult<CreditRegistration> {
    let mut tx = conn.begin().await?;

    let before = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT *
FROM credit_registrations
WHERE id = $1
  AND deleted_at IS NULL
FOR UPDATE
        "#,
        id
    )
    .fetch_one(&mut *tx)
    .await?;

    let to_state = transition.to_state;
    let after = sqlx::query_as!(
        CreditRegistration,
        r#"
UPDATE credit_registrations
SET state = $2::credit_registration_state,
  -- clock_timestamp(), not now(): now() is the transaction timestamp, so several state changes in
  -- one transaction would share an instant and the timeline would lose their order.
  state_entered_at = clock_timestamp(),
  error_code = $3,
  error_message = $4,
  needs_admin_attention = COALESCE($5, needs_admin_attention),
  -- ELSE NULL: without it an admin retry stays invisible to every terminal_at IS NULL query.
  terminal_at = CASE
    WHEN $6 THEN COALESCE(terminal_at, now())
    ELSE NULL
  END,
  first_failed_at = CASE
    WHEN $7 THEN COALESCE(first_failed_at, now())
    ELSE first_failed_at
  END,
  registered_at = CASE
    WHEN $2::credit_registration_state = 'registered' THEN COALESCE(registered_at, now())
    ELSE registered_at
  END,
  submitted_at = CASE
    WHEN $2::credit_registration_state = 'submitting' THEN now()
    ELSE submitted_at
  END,
  enrolment_checked_at = CASE
    WHEN state = 'checking_enrolment'
    AND $2::credit_registration_state <> 'checking_enrolment' THEN now()
    ELSE enrolment_checked_at
  END,
  enrolment_banner_dismissed_at = CASE
    WHEN $2::credit_registration_state = 'no_usable_enrolment' THEN NULL
    ELSE enrolment_banner_dismissed_at
  END
WHERE id = $1
  AND deleted_at IS NULL
RETURNING *
        "#,
        id,
        to_state as CreditRegistrationState,
        transition.error_code as Option<CreditRegistrationErrorCode>,
        transition.error_message,
        transition.needs_admin_attention,
        to_state.is_terminal(),
        to_state.is_failure(),
    )
    .fetch_one(&mut *tx)
    .await?;

    crate::credit_registration_events::insert(
        &mut tx,
        &NewCreditRegistrationEvent {
            credit_registration_id: id,
            kind: transition.event_kind,
            from_state: Some(before.state),
            to_state: Some(to_state),
            error_code: transition.error_code,
            message: transition.event_message.clone(),
            suotar_api_call_id: transition.suotar_api_call_id,
            actor_user_id: transition.actor_user_id,
            details: transition.event_details.clone(),
        },
    )
    .await?;

    tx.commit().await?;
    Ok(after)
}

/// Which rows a phase iteration may touch.
///
/// Empty means every row, which is what production runs. A narrowed scope exists so a test can
/// drive the pipeline for its own course without sweeping a shared database: it is one predicate on
/// the same claim query rather than a query of its own, so a scoped run cannot behave differently
/// from an unscoped one.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct RegistrationScope {
    pub course_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    /// The precision escape hatch, for a caller that already knows its ledger rows.
    pub credit_registration_ids: Vec<Uuid>,
}

impl RegistrationScope {
    pub fn is_unscoped(&self) -> bool {
        self.course_id.is_none()
            && self.user_id.is_none()
            && self.credit_registration_ids.is_empty()
    }

    pub fn for_course(course_id: Uuid) -> Self {
        Self {
            course_id: Some(course_id),
            ..Self::default()
        }
    }
}

/// Claims up to `limit` due rows in the given states for this worker.
///
/// The `SKIP LOCKED` row locks live until the caller's transaction ends, so callers must pass a
/// transaction. Rows on a paused course module are never claimed, enforced here so no phase can
/// forget it.
pub async fn claim_due(
    conn: &mut PgConnection,
    states: &[CreditRegistrationState],
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<Vec<CreditRegistration>> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
WITH due AS (
  SELECT cr.id
  FROM credit_registrations cr
    LEFT JOIN course_module_suotar_configurations c ON c.course_module_id = cr.course_module_id
    AND c.deleted_at IS NULL
  WHERE cr.deleted_at IS NULL
    AND cr.superseded_by_id IS NULL
    AND cr.state = ANY($1::credit_registration_state [])
    AND cr.next_attempt_at <= now()
    AND c.paused_at IS NULL
    AND ($3::uuid IS NULL OR cr.course_id = $3)
    AND ($4::uuid IS NULL OR cr.user_id = $4)
    AND (
      cardinality($5::uuid []) = 0
      OR cr.id = ANY($5::uuid [])
    )
  ORDER BY cr.next_attempt_at
  FOR UPDATE OF cr SKIP LOCKED
  LIMIT $2
)
UPDATE credit_registrations cr
SET last_attempt_at = now()
FROM due
WHERE cr.id = due.id
RETURNING cr.*
        "#,
        states as &[CreditRegistrationState],
        limit,
        scope.course_id,
        scope.user_id,
        &scope.credit_registration_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<CreditRegistration> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT *
FROM credit_registrations
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_ids(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> ModelResult<Vec<CreditRegistration>> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT *
FROM credit_registrations
WHERE id = ANY($1::uuid [])
  AND deleted_at IS NULL
        "#,
        ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The live (non-superseded) row for a completion.
pub async fn get_live_by_completion_id(
    conn: &mut PgConnection,
    course_module_completion_id: Uuid,
) -> ModelResult<Option<CreditRegistration>> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT *
FROM credit_registrations
WHERE course_module_completion_id = $1
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
        course_module_completion_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// Every attempt for a completion, newest first. Superseded rows are included on purpose: if Sisu
/// ended up holding both attainments the student must see both.
pub async fn get_all_attempts_by_completion_id(
    conn: &mut PgConnection,
    course_module_completion_id: Uuid,
) -> ModelResult<Vec<CreditRegistration>> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT *
FROM credit_registrations
WHERE course_module_completion_id = $1
  AND deleted_at IS NULL
ORDER BY attempt_number DESC
        "#,
        course_module_completion_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<CreditRegistration>> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT *
FROM credit_registrations
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
        "#,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CreditRegistration>> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT *
FROM credit_registrations
WHERE course_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// One ledger row with the course, module and enrolment facts every student view of it needs, so a
/// status page is one query rather than a fan-out per row.
#[derive(Debug, Clone, PartialEq)]
pub struct StudentCreditRegistration {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_slug: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub state: CreditRegistrationState,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub next_attempt_at: DateTime<Utc>,
    pub registered_at: Option<DateTime<Utc>>,
    pub sisu_attainment_id: Option<String>,
    pub credits: Option<f32>,
    pub grade_id: Option<String>,
    pub attempt_number: i32,
    pub superseded_by_id: Option<Uuid>,
    pub superseded_at: Option<DateTime<Utc>>,
    pub enrolment_checked_at: Option<DateTime<Utc>>,
    /// The teacher's label for the realisation we submitted against, not a Sisu id.
    pub enrolment_realisation_name: Option<String>,
    /// Needed to build the enrolment link a student with no usable enrolment is sent to.
    pub open_university_product_id: Option<String>,
}

/// The user's registrations as the student surfaces show them, newest completion first. Superseded
/// attempts are included: the student is entitled to see an earlier attempt Sisu may still hold.
///
/// `course_module_id` narrows it to the one module the completion status page is about.
pub async fn get_student_facing_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_module_id: Option<Uuid>,
) -> ModelResult<Vec<StudentCreditRegistration>> {
    let res = sqlx::query_as!(
        StudentCreditRegistration,
        r#"
SELECT cr.id,
  cr.course_id,
  c.name AS course_name,
  c.slug AS course_slug,
  cr.course_module_id,
  cm.name AS course_module_name,
  cm.uh_course_code,
  cm.ects_credits,
  cr.course_module_completion_id,
  cmc.completion_date,
  cr.state AS "state: CreditRegistrationState",
  cr.error_code AS "error_code?: CreditRegistrationErrorCode",
  cr.next_attempt_at,
  cr.registered_at,
  cr.sisu_attainment_id,
  cr.credits,
  cr.grade_id,
  cr.attempt_number,
  cr.superseded_by_id,
  cr.superseded_at,
  cr.enrolment_checked_at,
  r.label AS "enrolment_realisation_name?",
  conf.open_university_product_id AS "open_university_product_id?"
FROM credit_registrations cr
  JOIN courses c ON c.id = cr.course_id
  JOIN course_modules cm ON cm.id = cr.course_module_id
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cr.course_module_id
  AND conf.deleted_at IS NULL
  LEFT JOIN course_module_suotar_realisations r ON r.course_module_id = cr.course_module_id
  AND r.course_unit_realisation_id = cr.selected_enrolment_realisation_id
  AND r.deleted_at IS NULL
WHERE cr.user_id = $1
  AND cr.deleted_at IS NULL
  AND ($2::uuid IS NULL OR cr.course_module_id = $2)
ORDER BY cmc.completion_date DESC,
  cr.attempt_number DESC
        "#,
        user_id,
        course_module_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Frozen copy of what we are about to submit. Written once, before the row leaves
/// `checking_enrolment`: a later regrade must not alter a submitted row.
#[derive(Debug, Clone, PartialEq)]
pub struct PayloadSnapshot {
    pub student_number: String,
    pub sisu_person_id: String,
    pub uh_course_code: String,
    pub selected_enrolment_id: Option<String>,
    pub selected_enrolment_kind: Option<String>,
    pub selected_enrolment_realisation_id: Option<String>,
    pub attainment_date: NaiveDate,
    pub attainment_language: String,
    pub grade_scale_id: String,
    pub grade_id: String,
    pub credits: f32,
}

pub async fn set_payload_snapshot(
    conn: &mut PgConnection,
    id: Uuid,
    snapshot: &PayloadSnapshot,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET student_number = $2,
  sisu_person_id = $3,
  uh_course_code = $4,
  selected_enrolment_id = $5,
  selected_enrolment_kind = $6,
  selected_enrolment_realisation_id = $7,
  attainment_date = $8,
  attainment_language = $9,
  grade_scale_id = $10,
  grade_id = $11,
  credits = $12
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        snapshot.student_number,
        snapshot.sisu_person_id,
        snapshot.uh_course_code,
        snapshot.selected_enrolment_id,
        snapshot.selected_enrolment_kind,
        snapshot.selected_enrolment_realisation_id,
        snapshot.attainment_date,
        snapshot.attainment_language,
        snapshot.grade_scale_id,
        snapshot.grade_id,
        snapshot.credits,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_submitted_attainment(
    conn: &mut PgConnection,
    id: Uuid,
    submitted_attainment_id: &str,
    submitted_attainment_type: Option<&str>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET submitted_attainment_id = $2,
  submitted_attainment_type = $3
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        submitted_attainment_id,
        submitted_attainment_type,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_sisu_attainment(
    conn: &mut PgConnection,
    id: Uuid,
    sisu_attainment_id: &str,
    sisu_attainment_type: Option<&str>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET sisu_attainment_id = $2,
  sisu_attainment_type = $3
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        sisu_attainment_id,
        sisu_attainment_type,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records the attainment the study registry holds, unless another live row already claims it.
///
/// Returns whether it was recorded. Two rows may legitimately be told about one attainment — a
/// grade improvement Sisu declines names the attainment the first attempt registered — and a unique
/// index would turn that into a failed transition rather than the terminal state it should be.
pub async fn set_sisu_attainment_if_unclaimed(
    conn: &mut PgConnection,
    id: Uuid,
    sisu_attainment_id: &str,
    sisu_attainment_type: Option<&str>,
) -> ModelResult<bool> {
    let updated = sqlx::query_scalar!(
        r#"
UPDATE credit_registrations
SET sisu_attainment_id = $2,
  sisu_attainment_type = $3
WHERE id = $1
  AND deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM credit_registrations other
    WHERE other.sisu_attainment_id = $2
      AND other.deleted_at IS NULL
      AND other.id <> $1
  )
RETURNING id
        "#,
        id,
        sisu_attainment_id,
        sisu_attainment_type,
    )
    .fetch_optional(conn)
    .await?;
    Ok(updated.is_some())
}

/// Defers when the pipeline may next claim this row; the delay is the caller's policy.
///
/// Does not touch `first_failed_at`, which [`transition`] owns: states that wait on a human must
/// defer to stay out of `claim_due`'s `LIMIT`, and anchoring the retry window there would expire them.
pub async fn schedule_next_attempt(
    conn: &mut PgConnection,
    id: Uuid,
    next_attempt_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET next_attempt_at = $2
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        next_attempt_at,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Brings forward the recheck of rows parked for want of an enrolment, for students the study
/// registry now lists as enrolled.
///
/// Only the clock moves. The precondition recompute is what takes the row back to `ready_to_submit`,
/// so the enrolment is re-resolved rather than assumed from a roster entry.
pub async fn recheck_no_usable_enrolment_now(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_ids: &[Uuid],
) -> ModelResult<u64> {
    let res = sqlx::query!(
        r#"
UPDATE credit_registrations
SET next_attempt_at = now()
WHERE course_id = $1
  AND user_id = ANY($2::uuid [])
  AND state = 'no_usable_enrolment'
  AND next_attempt_at > now()
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
        course_id,
        user_ids,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}

pub async fn increment_submit_retry_count(conn: &mut PgConnection, id: Uuid) -> ModelResult<i32> {
    let res = sqlx::query!(
        r#"
UPDATE credit_registrations
SET submit_retry_count = submit_retry_count + 1
WHERE id = $1
  AND deleted_at IS NULL
RETURNING submit_retry_count
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.submit_retry_count)
}

pub async fn increment_verify_attempt_count(conn: &mut PgConnection, id: Uuid) -> ModelResult<i32> {
    let res = sqlx::query!(
        r#"
UPDATE credit_registrations
SET verify_attempt_count = verify_attempt_count + 1
WHERE id = $1
  AND deleted_at IS NULL
RETURNING verify_attempt_count
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.verify_attempt_count)
}

pub async fn set_needs_admin_attention(
    conn: &mut PgConnection,
    id: Uuid,
    needs_admin_attention: bool,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET needs_admin_attention = $2
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        needs_admin_attention,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The student dismissed the in-course-material re-enrol banner for this registration.
pub async fn dismiss_enrolment_banner(
    conn: &mut PgConnection,
    id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET enrolment_banner_dismissed_at = now()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
        "#,
        id,
        user_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Points an old attempt at the newer one that replaced it. The old row keeps its state and
/// `terminal_at`: it really was registered.
pub async fn mark_superseded(
    conn: &mut PgConnection,
    id: Uuid,
    superseded_by_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET superseded_by_id = $2,
  superseded_at = now()
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        superseded_by_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Live rows per state, for the dashboard funnel.
///
/// Superseded attempts are excluded, as they are in the per-course sibling: a course that regrades
/// holds two rows per student and would otherwise be counted twice in every tile.
pub async fn count_by_state(
    conn: &mut PgConnection,
) -> ModelResult<Vec<(CreditRegistrationState, i64)>> {
    let rows = sqlx::query!(
        r#"
SELECT state AS "state: CreditRegistrationState",
  COUNT(*) AS "count!"
FROM credit_registrations
WHERE superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY state
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows.into_iter().map(|r| (r.state, r.count)).collect())
}

/// Live rows of one course per module and state, for the teacher's per-module summary.
pub async fn count_by_module_and_state_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<(Uuid, CreditRegistrationState, i64)>> {
    let rows = sqlx::query!(
        r#"
SELECT course_module_id,
  state AS "state: CreditRegistrationState",
  COUNT(*) AS "count!"
FROM credit_registrations
WHERE course_id = $1
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY course_module_id,
  state
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| (r.course_module_id, r.state, r.count))
        .collect())
}

/// Live rows of one course needing a human, per module.
pub async fn count_needing_admin_attention_by_module_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<(Uuid, i64)>> {
    let rows = sqlx::query!(
        r#"
SELECT course_module_id,
  COUNT(*) AS "count!"
FROM credit_registrations
WHERE course_id = $1
  AND needs_admin_attention
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY course_module_id
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| (r.course_module_id, r.count))
        .collect())
}

/// One ledger row as a teacher sees it: the raw state, the student's identity and the unmasked
/// verified student number, without the study registry's own error text.
#[derive(Debug, Clone, PartialEq)]
pub struct TeacherCreditRegistration {
    pub id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub course_instance_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub needs_admin_attention: bool,
    pub next_attempt_at: DateTime<Utc>,
    pub registered_at: Option<DateTime<Utc>>,
    pub sisu_attainment_id: Option<String>,
    pub grade_id: Option<String>,
    pub credits: Option<f32>,
    pub attempt_number: i32,
    pub superseded_by_id: Option<Uuid>,
    /// Live only: a soft-deleted link is no longer a number we hold for this student.
    pub student_number: Option<String>,
    pub student_number_verified_at: Option<DateTime<Utc>>,
    pub student_number_verified_via: Option<StudentNumberVerificationMethod>,
    /// Needed to find the account's linking mails, which are keyed on the Sisu person.
    pub sisu_person_id: Option<String>,
    pub enrolment_realisation_name: Option<String>,
}

/// The optional narrowings a teacher surface applies, all of them in SQL.
#[derive(Debug, Clone, Default)]
pub struct TeacherCreditRegistrationFilters<'a> {
    /// The students-tab batch: the users of one identity-list page.
    pub user_ids: Option<&'a [Uuid]>,
    pub state: Option<CreditRegistrationState>,
    /// Free text matched against the student's name, email or verified student number.
    pub search: Option<&'a str>,
    pub course_instance_id: Option<Uuid>,
}

/// The course's ledger rows as the teacher surfaces show them, newest completion first.
pub async fn get_teacher_facing_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
    filters: &TeacherCreditRegistrationFilters<'_>,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<TeacherCreditRegistration>> {
    let search_pattern = filters.search.map(search_pattern_of);
    let res = sqlx::query_as!(
        TeacherCreditRegistration,
        r#"
SELECT cr.id,
  cr.user_id,
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  cr.course_id,
  cr.course_module_id,
  cm.name AS course_module_name,
  cr.course_instance_id,
  cr.course_module_completion_id,
  cmc.completion_date,
  cr.state AS "state: CreditRegistrationState",
  cr.state_entered_at,
  cr.error_code AS "error_code?: CreditRegistrationErrorCode",
  cr.needs_admin_attention,
  cr.next_attempt_at,
  cr.registered_at,
  cr.sisu_attainment_id,
  cr.grade_id,
  cr.credits,
  cr.attempt_number,
  cr.superseded_by_id,
  vsn.student_number AS "student_number?",
  vsn.verified_at AS "student_number_verified_at?",
  vsn.verified_via AS "student_number_verified_via?: StudentNumberVerificationMethod",
  vsn.sisu_person_id AS "sisu_person_id?",
  r.label AS "enrolment_realisation_name?"
FROM credit_registrations cr
  JOIN course_modules cm ON cm.id = cr.course_module_id
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL
  LEFT JOIN course_module_suotar_realisations r ON r.course_module_id = cr.course_module_id
  AND r.course_unit_realisation_id = cr.selected_enrolment_realisation_id
  AND r.deleted_at IS NULL
WHERE cr.course_id = $1
  AND cr.deleted_at IS NULL
  AND ($2::uuid [] IS NULL OR cr.user_id = ANY($2))
  AND (
    $3::credit_registration_state IS NULL
    OR cr.state = $3
  )
  AND (
    $4::text IS NULL
    OR ud.name_search_helper LIKE '%' || $4 || '%' ESCAPE '\'
    OR ud.email_search_helper LIKE '%' || $4 || '%' ESCAPE '\'
    OR LOWER(vsn.student_number) LIKE '%' || $4 || '%' ESCAPE '\'
  )
  AND ($5::uuid IS NULL OR cr.course_instance_id = $5)
ORDER BY cmc.completion_date DESC,
  cr.attempt_number DESC,
  cr.id
LIMIT $6 OFFSET $7
        "#,
        course_id,
        filters.user_ids,
        filters.state as Option<CreditRegistrationState>,
        search_pattern.as_deref(),
        filters.course_instance_id,
        limit,
        offset,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// How many rows [`get_teacher_facing_by_course_id`] would return without a page limit.
pub async fn count_teacher_facing_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
    filters: &TeacherCreditRegistrationFilters<'_>,
) -> ModelResult<i64> {
    let search_pattern = filters.search.map(search_pattern_of);
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registrations cr
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL
WHERE cr.course_id = $1
  AND cr.deleted_at IS NULL
  AND (
    $2::credit_registration_state IS NULL
    OR cr.state = $2
  )
  AND (
    $3::text IS NULL
    OR ud.name_search_helper LIKE '%' || $3 || '%' ESCAPE '\'
    OR ud.email_search_helper LIKE '%' || $3 || '%' ESCAPE '\'
    OR LOWER(vsn.student_number) LIKE '%' || $3 || '%' ESCAPE '\'
  )
  AND ($4::uuid IS NULL OR cr.course_instance_id = $4)
        "#,
        course_id,
        filters.state as Option<CreditRegistrationState>,
        search_pattern.as_deref(),
        filters.course_instance_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// The `LIKE` pattern the search helper columns are matched against: lowercased, metacharacters
/// escaped, so a search for `%` matches a literal one.
fn search_pattern_of(search: &str) -> String {
    escape_like_pattern(&search.to_lowercase())
}

/// One row for a teacher surface, by id. `None` when no such live row exists.
pub async fn get_teacher_facing_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<Option<TeacherCreditRegistration>> {
    let row = get_by_id(conn, id).await?;
    let rows = get_teacher_facing_by_course_id(
        conn,
        row.course_id,
        &TeacherCreditRegistrationFilters {
            user_ids: Some(&[row.user_id]),
            ..TeacherCreditRegistrationFilters::default()
        },
        i64::MAX,
        0,
    )
    .await?;
    Ok(rows.into_iter().find(|candidate| candidate.id == id))
}

/// Every attempt for the same completion as `row`, that one included, newest attempt first.
pub async fn get_teacher_facing_attempts_for_completion(
    conn: &mut PgConnection,
    row: &TeacherCreditRegistration,
) -> ModelResult<Vec<TeacherCreditRegistration>> {
    let mut rows = get_teacher_facing_by_course_id(
        conn,
        row.course_id,
        &TeacherCreditRegistrationFilters {
            user_ids: Some(&[row.user_id]),
            ..TeacherCreditRegistrationFilters::default()
        },
        i64::MAX,
        0,
    )
    .await?;
    rows.retain(|candidate| {
        candidate.course_module_completion_id == row.course_module_completion_id
    });
    rows.sort_by_key(|row| std::cmp::Reverse(row.attempt_number));
    Ok(rows)
}

/// One ledger row as an admin sees it: every identifier support needs to answer "what happened to
/// this student", across courses.
///
/// The study registry's own error text is not here. It is written for an integrator, may name a
/// person and is not translated; the error code plus the scrubbed call bodies are what an admin
/// reads instead.
#[derive(Debug, Clone, PartialEq)]
pub struct AdminCreditRegistration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    /// In full: the admin view exists to resolve support cases, which starts from the address.
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub course_instance_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub needs_admin_attention: bool,
    pub next_attempt_at: DateTime<Utc>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub registered_at: Option<DateTime<Utc>>,
    pub terminal_at: Option<DateTime<Utc>>,
    /// Frozen on the row when it left `checking_enrolment`, so it is what we actually sent.
    pub student_number: Option<String>,
    pub sisu_person_id: Option<String>,
    pub uh_course_code: Option<String>,
    pub selected_enrolment_id: Option<String>,
    pub grade_scale_id: Option<String>,
    pub grade_id: Option<String>,
    pub credits: Option<f32>,
    pub request_item_id: String,
    pub submitted_attainment_id: Option<String>,
    pub sisu_attainment_id: Option<String>,
    pub submit_retry_count: i32,
    pub verify_attempt_count: i32,
    pub attempt_number: i32,
    pub superseded_by_id: Option<Uuid>,
    /// The account's live link now, which may differ from the number frozen on the row.
    pub verified_student_number: Option<String>,
    pub verified_student_number_at: Option<DateTime<Utc>>,
    pub verified_student_number_via: Option<StudentNumberVerificationMethod>,
}

/// How the explorer orders a page. Descending only: an ops table is read newest-worst first.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AdminCreditRegistrationSort {
    #[default]
    LastActivity,
    Created,
    TimeInState,
    Attempts,
}

impl AdminCreditRegistrationSort {
    /// The value the query's `ORDER BY` branches on.
    fn as_str(self) -> &'static str {
        match self {
            Self::LastActivity => "last_activity",
            Self::Created => "created",
            Self::TimeInState => "time_in_state",
            Self::Attempts => "attempts",
        }
    }
}

/// The narrowings the admin explorer applies, all of them in SQL.
#[derive(Debug, Clone, Default)]
pub struct AdminCreditRegistrationFilters<'a> {
    pub states: Option<&'a [CreditRegistrationState]>,
    pub error_codes: Option<&'a [CreditRegistrationErrorCode]>,
    pub course_id: Option<Uuid>,
    pub course_module_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub student_number: Option<&'a str>,
    pub needs_admin_attention: bool,
    pub submitted_after: Option<DateTime<Utc>>,
    pub submitted_before: Option<DateTime<Utc>>,
    /// Matched against the student's name and email, either student number, the attainment ids and
    /// the stored error text. Searching that text is not rendering it.
    pub search: Option<&'a str>,
    /// A uuid typed into the search box: a registration, a user or a completion id.
    pub search_id: Option<Uuid>,
    /// Off by default, or a course that regrades shows two rows per student.
    pub include_superseded: bool,
}

/// A page of the ledger for the admin explorer, cross-course.
pub async fn get_admin_facing(
    conn: &mut PgConnection,
    filters: &AdminCreditRegistrationFilters<'_>,
    sort: AdminCreditRegistrationSort,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<AdminCreditRegistration>> {
    let search_pattern = filters.search.map(search_pattern_of);
    let res = sqlx::query_as!(
        AdminCreditRegistration,
        r#"
SELECT cr.id,
  cr.created_at,
  cr.user_id,
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  cr.course_id,
  c.name AS course_name,
  cr.course_module_id,
  cm.name AS course_module_name,
  cr.course_instance_id,
  cr.course_module_completion_id,
  cmc.completion_date,
  cr.state AS "state: CreditRegistrationState",
  cr.state_entered_at,
  cr.error_code AS "error_code?: CreditRegistrationErrorCode",
  cr.needs_admin_attention,
  cr.next_attempt_at,
  cr.last_attempt_at,
  cr.submitted_at,
  cr.registered_at,
  cr.terminal_at,
  cr.student_number,
  cr.sisu_person_id,
  cr.uh_course_code,
  cr.selected_enrolment_id,
  cr.grade_scale_id,
  cr.grade_id,
  cr.credits,
  cr.request_item_id,
  cr.submitted_attainment_id,
  cr.sisu_attainment_id,
  cr.submit_retry_count,
  cr.verify_attempt_count,
  cr.attempt_number,
  cr.superseded_by_id,
  vsn.student_number AS "verified_student_number?",
  vsn.verified_at AS "verified_student_number_at?",
  vsn.verified_via AS "verified_student_number_via?: StudentNumberVerificationMethod"
FROM credit_registrations cr
  JOIN courses c ON c.id = cr.course_id
  JOIN course_modules cm ON cm.id = cr.course_module_id
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL
WHERE cr.deleted_at IS NULL
  AND ($1::bool OR cr.superseded_by_id IS NULL)
  AND (
    $2::credit_registration_state [] IS NULL
    OR cr.state = ANY($2)
  )
  AND (
    $3::credit_registration_error_code [] IS NULL
    OR cr.error_code = ANY($3)
  )
  AND ($4::uuid IS NULL OR cr.course_id = $4)
  AND ($5::uuid IS NULL OR cr.course_module_id = $5)
  AND ($6::uuid IS NULL OR cr.user_id = $6)
  AND (
    $7::text IS NULL
    OR cr.student_number = $7
    OR vsn.student_number = $7
  )
  AND (NOT $8::bool OR cr.needs_admin_attention)
  AND ($9::timestamptz IS NULL OR cr.submitted_at >= $9)
  AND ($10::timestamptz IS NULL OR cr.submitted_at <= $10)
  AND (
    $11::text IS NULL
    OR ud.name_search_helper LIKE '%' || $11 || '%' ESCAPE '\'
    OR ud.email_search_helper LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.student_number) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(vsn.student_number) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.submitted_attainment_id) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.sisu_attainment_id) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.error_message) LIKE '%' || $11 || '%' ESCAPE '\'
  )
  AND (
    $12::uuid IS NULL
    OR cr.id = $12
    OR cr.user_id = $12
    OR cr.course_module_completion_id = $12
  )
ORDER BY CASE
    WHEN $13::text = 'attempts' THEN cr.submit_retry_count + cr.verify_attempt_count
  END DESC NULLS LAST,
  CASE $13::text
    WHEN 'created' THEN cr.created_at
    WHEN 'time_in_state' THEN cr.state_entered_at
    ELSE COALESCE(cr.last_attempt_at, cr.state_entered_at)
  END DESC,
  cr.id
LIMIT $14 OFFSET $15
        "#,
        filters.include_superseded,
        filters.states as Option<&[CreditRegistrationState]>,
        filters.error_codes as Option<&[CreditRegistrationErrorCode]>,
        filters.course_id,
        filters.course_module_id,
        filters.user_id,
        filters.student_number,
        filters.needs_admin_attention,
        filters.submitted_after,
        filters.submitted_before,
        search_pattern.as_deref(),
        filters.search_id,
        sort.as_str(),
        limit,
        offset,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// How many rows [`get_admin_facing`] would return without a page limit.
pub async fn count_admin_facing(
    conn: &mut PgConnection,
    filters: &AdminCreditRegistrationFilters<'_>,
) -> ModelResult<i64> {
    let search_pattern = filters.search.map(search_pattern_of);
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registrations cr
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL
WHERE cr.deleted_at IS NULL
  AND ($1::bool OR cr.superseded_by_id IS NULL)
  AND (
    $2::credit_registration_state [] IS NULL
    OR cr.state = ANY($2)
  )
  AND (
    $3::credit_registration_error_code [] IS NULL
    OR cr.error_code = ANY($3)
  )
  AND ($4::uuid IS NULL OR cr.course_id = $4)
  AND ($5::uuid IS NULL OR cr.course_module_id = $5)
  AND ($6::uuid IS NULL OR cr.user_id = $6)
  AND (
    $7::text IS NULL
    OR cr.student_number = $7
    OR vsn.student_number = $7
  )
  AND (NOT $8::bool OR cr.needs_admin_attention)
  AND ($9::timestamptz IS NULL OR cr.submitted_at >= $9)
  AND ($10::timestamptz IS NULL OR cr.submitted_at <= $10)
  AND (
    $11::text IS NULL
    OR ud.name_search_helper LIKE '%' || $11 || '%' ESCAPE '\'
    OR ud.email_search_helper LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.student_number) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(vsn.student_number) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.submitted_attainment_id) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.sisu_attainment_id) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.error_message) LIKE '%' || $11 || '%' ESCAPE '\'
  )
  AND (
    $12::uuid IS NULL
    OR cr.id = $12
    OR cr.user_id = $12
    OR cr.course_module_completion_id = $12
  )
        "#,
        filters.include_superseded,
        filters.states as Option<&[CreditRegistrationState]>,
        filters.error_codes as Option<&[CreditRegistrationErrorCode]>,
        filters.course_id,
        filters.course_module_id,
        filters.user_id,
        filters.student_number,
        filters.needs_admin_attention,
        filters.submitted_after,
        filters.submitted_before,
        search_pattern.as_deref(),
        filters.search_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// Live rows carrying an error code, split by whether the pipeline is still working on them.
#[derive(Debug, Clone, PartialEq)]
pub struct CreditRegistrationErrorCodeCount {
    pub error_code: CreditRegistrationErrorCode,
    pub in_flight_count: i64,
    pub terminal_failure_count: i64,
}

/// The error-code breakdown the Overview shows.
///
/// A row abandoned by a consent withdrawal carries no failure of ours, so it is in neither column.
pub async fn count_by_error_code(
    conn: &mut PgConnection,
) -> ModelResult<Vec<CreditRegistrationErrorCodeCount>> {
    let rows = sqlx::query!(
        r#"
SELECT error_code AS "error_code!: CreditRegistrationErrorCode",
  COUNT(*) FILTER (WHERE terminal_at IS NULL) AS "in_flight_count!",
  COUNT(*) FILTER (
    WHERE state IN ('failed_permanent', 'misregistered')
  ) AS "terminal_failure_count!"
FROM credit_registrations
WHERE error_code IS NOT NULL
  AND state <> 'abandoned_by_consent_withdrawal'
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY error_code
ORDER BY COUNT(*) DESC
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| CreditRegistrationErrorCodeCount {
            error_code: row.error_code,
            in_flight_count: row.in_flight_count,
            terminal_failure_count: row.terminal_failure_count,
        })
        .collect())
}

pub async fn count_needing_admin_attention(conn: &mut PgConnection) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registrations
WHERE needs_admin_attention
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// The row that has been waiting longest for the pipeline to do something with it.
#[derive(Debug, Clone, PartialEq)]
pub struct OldestNonTerminalRegistration {
    pub id: Uuid,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
}

pub async fn get_oldest_non_terminal(
    conn: &mut PgConnection,
) -> ModelResult<Option<OldestNonTerminalRegistration>> {
    let row = sqlx::query_as!(
        OldestNonTerminalRegistration,
        r#"
SELECT id,
  state AS "state: CreditRegistrationState",
  state_entered_at
FROM credit_registrations
WHERE terminal_at IS NULL
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
ORDER BY state_entered_at
LIMIT 1
        "#,
    )
    .fetch_optional(conn)
    .await?;
    Ok(row)
}

/// One day of terminal outcomes, for the throughput series.
#[derive(Debug, Clone, PartialEq)]
pub struct CreditRegistrationThroughputDay {
    pub day: DateTime<Utc>,
    pub registered_count: i64,
    pub other_success_count: i64,
    pub failed_count: i64,
}

/// Daily terminal outcomes over the window. Withdrawn rows are in no column: they are neither a
/// success nor a failure.
pub async fn get_throughput_by_day(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
) -> ModelResult<Vec<CreditRegistrationThroughputDay>> {
    let rows = sqlx::query_as!(
        CreditRegistrationThroughputDay,
        r#"
SELECT DATE_TRUNC('day', terminal_at) AS "day!",
  COUNT(*) FILTER (WHERE state = 'registered') AS "registered_count!",
  COUNT(*) FILTER (
    WHERE state IN ('duplicate', 'not_improved')
  ) AS "other_success_count!",
  COUNT(*) FILTER (WHERE state = 'failed_permanent') AS "failed_count!"
FROM credit_registrations
WHERE terminal_at >= $1
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY 1
ORDER BY 1
        "#,
        since,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}

/// How long a row may sit in one state before it counts as stuck. Seconds, per state.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StuckThresholds {
    pub ready_to_submit_secs: i64,
    pub submitting_secs: i64,
    pub awaiting_verification_secs: i64,
    pub failed_retryable_secs: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct StuckRegistrationCount {
    pub state: CreditRegistrationState,
    pub count: i64,
    /// Over three times the threshold, which is what makes the alert critical.
    pub severely_stuck_count: i64,
    pub oldest_state_entered_at: Option<DateTime<Utc>>,
}

/// Rows the pipeline should have moved by now, per state.
///
/// Only the four states with a threshold are considered: the rest wait on a student or on a human,
/// and alerting on those would fire on the feature working as designed.
pub async fn count_stuck(
    conn: &mut PgConnection,
    thresholds: &StuckThresholds,
) -> ModelResult<Vec<StuckRegistrationCount>> {
    let rows = sqlx::query_as!(
        StuckRegistrationCount,
        r#"
SELECT cr.state AS "state!: CreditRegistrationState",
  COUNT(*) AS "count!",
  COUNT(*) FILTER (
    WHERE now() - cr.state_entered_at > MAKE_INTERVAL(secs => t.threshold_secs * 3)
  ) AS "severely_stuck_count!",
  MIN(cr.state_entered_at) AS "oldest_state_entered_at"
FROM credit_registrations cr
  CROSS JOIN LATERAL (
    SELECT CASE cr.state
        WHEN 'ready_to_submit' THEN $1::double precision
        WHEN 'submitting' THEN $2::double precision
        WHEN 'awaiting_verification' THEN $3::double precision
        WHEN 'failed_retryable' THEN $4::double precision
      END AS threshold_secs
  ) t
WHERE cr.terminal_at IS NULL
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
  AND t.threshold_secs IS NOT NULL
  AND now() - cr.state_entered_at > MAKE_INTERVAL(secs => t.threshold_secs)
GROUP BY cr.state
        "#,
        thresholds.ready_to_submit_secs as f64,
        thresholds.submitting_secs as f64,
        thresholds.awaiting_verification_secs as f64,
        thresholds.failed_retryable_secs as f64,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::course_module_completions::{
        CourseModuleCompletionGranter, NewCourseModuleCompletion,
    };
    use crate::credit_registration_events::CreditRegistrationEventKind;
    use crate::test_helper::*;

    async fn insert_registration(
        conn: &mut PgConnection,
        user: Uuid,
        course: Uuid,
        course_instance: Uuid,
        course_module: Uuid,
    ) -> Uuid {
        let completion = crate::course_module_completions::insert(
            conn,
            PKeyPolicy::Generate,
            &NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module,
                user_id: user,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en".to_string(),
                eligible_for_ects: true,
                email: "student@example.com".to_string(),
                grade: Some(4),
                passed: true,
            },
            CourseModuleCompletionGranter::Automatic,
        )
        .await
        .unwrap();

        insert(
            conn,
            PKeyPolicy::Generate,
            &NewCreditRegistration {
                course_module_completion_id: completion.id,
                user_id: user,
                course_id: course,
                course_module_id: course_module,
                course_instance_id: course_instance,
                attempt_number: 1,
            },
            None,
        )
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn transition_stamps_state_entered_at_and_writes_an_event() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;
        let before = get_by_id(tx.as_mut(), id).await.unwrap();

        let after = transition(
            tx.as_mut(),
            id,
            &Transition::to(CreditRegistrationState::PendingConsent),
        )
        .await
        .unwrap();

        assert_eq!(after.state, CreditRegistrationState::PendingConsent);
        assert!(after.state_entered_at > before.state_entered_at);

        let events = crate::credit_registration_events::get_by_registration_id(tx.as_mut(), id)
            .await
            .unwrap();
        // The `created` event from insert plus this state change, newest first.
        assert_eq!(events.len(), 2);
        assert_eq!(events[1].kind, CreditRegistrationEventKind::Created);
        assert_eq!(events[0].kind, CreditRegistrationEventKind::StateChanged);
        assert_eq!(
            events[0].from_state,
            Some(CreditRegistrationState::PendingPrerequisites)
        );
        assert_eq!(
            events[0].to_state,
            Some(CreditRegistrationState::PendingConsent)
        );
    }

    #[tokio::test]
    async fn consecutive_state_changes_stay_ordered_inside_one_transaction() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

        let first = transition(
            tx.as_mut(),
            id,
            &Transition::to(CreditRegistrationState::PendingConsent),
        )
        .await
        .unwrap();
        let second = transition(
            tx.as_mut(),
            id,
            &Transition::to(CreditRegistrationState::PendingStudentNumber),
        )
        .await
        .unwrap();
        assert!(second.state_entered_at > first.state_entered_at);
    }

    #[tokio::test]
    async fn transition_stamps_lifecycle_timestamps() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

        let checking = transition(
            tx.as_mut(),
            id,
            &Transition::to(CreditRegistrationState::CheckingEnrolment),
        )
        .await
        .unwrap();
        assert!(checking.enrolment_checked_at.is_none());
        assert!(checking.submitted_at.is_none());
        assert!(checking.terminal_at.is_none());

        // Leaving checking_enrolment is what stamps enrolment_checked_at.
        let submitting = transition(
            tx.as_mut(),
            id,
            &Transition::to(CreditRegistrationState::Submitting),
        )
        .await
        .unwrap();
        assert!(submitting.enrolment_checked_at.is_some());
        assert!(submitting.submitted_at.is_some());
        assert!(submitting.registered_at.is_none());
        assert!(submitting.terminal_at.is_none());

        let registered = transition(
            tx.as_mut(),
            id,
            &Transition::to(CreditRegistrationState::Registered),
        )
        .await
        .unwrap();
        assert!(registered.registered_at.is_some());
        assert!(registered.terminal_at.is_some());
        assert_eq!(registered.submitted_at, submitting.submitted_at);
        assert_eq!(
            registered.enrolment_checked_at,
            submitting.enrolment_checked_at
        );
    }

    #[tokio::test]
    async fn terminal_at_holds_between_terminal_states_and_clears_on_a_retry() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

        let first = transition(
            tx.as_mut(),
            id,
            &Transition::to(CreditRegistrationState::Cancelled),
        )
        .await
        .unwrap();
        let terminal_at = first.terminal_at.unwrap();

        let second = transition(
            tx.as_mut(),
            id,
            &Transition::to(CreditRegistrationState::FailedPermanent),
        )
        .await
        .unwrap();
        assert_eq!(second.terminal_at, Some(terminal_at));

        let retried = transition(
            tx.as_mut(),
            id,
            &Transition::to(CreditRegistrationState::ReadyToSubmit),
        )
        .await
        .unwrap();
        assert_eq!(retried.terminal_at, None);
    }

    #[tokio::test]
    async fn entering_no_usable_enrolment_clears_a_dismissed_banner() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

        transition(
            tx.as_mut(),
            id,
            &Transition::to(CreditRegistrationState::NoUsableEnrolment),
        )
        .await
        .unwrap();
        dismiss_enrolment_banner(tx.as_mut(), id, user)
            .await
            .unwrap();
        assert!(
            get_by_id(tx.as_mut(), id)
                .await
                .unwrap()
                .enrolment_banner_dismissed_at
                .is_some()
        );

        transition(
            tx.as_mut(),
            id,
            &Transition::to(CreditRegistrationState::ReadyToSubmit),
        )
        .await
        .unwrap();
        // Still dismissed: only a fresh enrolment problem brings the banner back.
        assert!(
            get_by_id(tx.as_mut(), id)
                .await
                .unwrap()
                .enrolment_banner_dismissed_at
                .is_some()
        );

        let back = transition(
            tx.as_mut(),
            id,
            &Transition::to(CreditRegistrationState::NoUsableEnrolment),
        )
        .await
        .unwrap();
        assert_eq!(back.enrolment_banner_dismissed_at, None);
    }

    #[tokio::test]
    async fn transition_carries_the_error_and_leaves_the_admin_flag_alone_unless_asked() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;
        set_needs_admin_attention(tx.as_mut(), id, true)
            .await
            .unwrap();

        let failed = transition(
            tx.as_mut(),
            id,
            &Transition {
                error_code: Some(CreditRegistrationErrorCode::EnrolmentNotFound),
                error_message: Some("no accepted enrolment".to_string()),
                ..Transition::to(CreditRegistrationState::FailedPermanent)
            },
        )
        .await
        .unwrap();
        assert_eq!(
            failed.error_code,
            Some(CreditRegistrationErrorCode::EnrolmentNotFound)
        );
        assert!(failed.needs_admin_attention);

        let resolved = transition(
            tx.as_mut(),
            id,
            &Transition {
                needs_admin_attention: Some(false),
                ..Transition::to(CreditRegistrationState::ReadyToSubmit)
            },
        )
        .await
        .unwrap();
        assert!(!resolved.needs_admin_attention);
        assert_eq!(resolved.error_code, None);
    }

    #[test]
    fn every_documented_error_code_maps() {
        use CreditRegistrationErrorCode as Code;
        let cases = [
            (
                SuotarEndpoint::ResolvePersons,
                "personNotFound",
                Code::PersonNotFound,
            ),
            (
                SuotarEndpoint::ResolvePersons,
                "sisuTemporarilyUnavailable",
                Code::SisuTemporarilyUnavailable,
            ),
            (
                SuotarEndpoint::ResolveEnrolments,
                "personNotFound",
                Code::PersonNotFound,
            ),
            (
                SuotarEndpoint::ResolveEnrolments,
                "courseCodeNotFound",
                Code::CourseCodeNotFound,
            ),
            (
                SuotarEndpoint::ResolveEnrolments,
                "enrolmentNotFound",
                Code::EnrolmentNotFound,
            ),
            (
                SuotarEndpoint::ResolveEnrolments,
                "enrolmentNotAccepted",
                Code::EnrolmentNotAccepted,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "invalidGradeForGradeScale",
                Code::InvalidGradeForGradeScale,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "courseNotAllowed",
                Code::CourseNotAllowed,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "invalidCredits",
                Code::InvalidCredits,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "studyRightNotValid",
                Code::StudyRightNotValid,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "acceptorNotFound",
                Code::AcceptorNotFound,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "sisuValidationFailed",
                Code::SisuValidationFailed,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "sisuTimeout",
                Code::SisuTimeout,
            ),
            (
                SuotarEndpoint::VerifyAttainments,
                "misregistered",
                Code::Misregistered,
            ),
            (
                SuotarEndpoint::VerifyAttainments,
                "sisuTemporarilyUnavailable",
                Code::SisuTemporarilyUnavailable,
            ),
            (
                SuotarEndpoint::ListByCourse,
                "courseCodeNotFound",
                Code::CourseCodeNotFound,
            ),
            (
                SuotarEndpoint::ResolvePersons,
                "unauthorized",
                Code::Unauthorized,
            ),
            (
                SuotarEndpoint::ResolvePersons,
                "malformedRequest",
                Code::MalformedRequest,
            ),
        ];
        for (endpoint, code, expected) in cases {
            assert_eq!(
                map_code(endpoint, code),
                Some(expected),
                "{code} on {endpoint:?}"
            );
        }
    }

    #[test]
    fn no_code_that_needs_no_recording_becomes_an_error() {
        for (endpoint, code) in [
            (SuotarEndpoint::ResolvePersons, "personFound"),
            (SuotarEndpoint::ResolveEnrolments, "enrolmentFound"),
            (SuotarEndpoint::ImportAttainments, "sent"),
            (SuotarEndpoint::ImportAttainments, "registered"),
            (SuotarEndpoint::ImportAttainments, "duplicateAttainment"),
            (SuotarEndpoint::ImportAttainments, "notImprovedAttainment"),
            (SuotarEndpoint::VerifyAttainments, "registered"),
            (SuotarEndpoint::ProductAccessTokens, "found"),
            (SuotarEndpoint::ListByCourse, "enrolmentsListed"),
            (SuotarEndpoint::VerifyAttainments, "notRegistered"),
        ] {
            assert_eq!(map_code(endpoint, code), None, "{code} on {endpoint:?}");
        }
    }

    #[test]
    fn an_item_level_transient_on_import_is_uncertain_rather_than_retryable() {
        assert_eq!(
            map_code(
                SuotarEndpoint::ImportAttainments,
                "sisuTemporarilyUnavailable"
            ),
            Some(CreditRegistrationErrorCode::SisuTimeout)
        );
    }

    #[test]
    fn a_code_suotar_adds_later_maps_to_unknown_rather_than_failing() {
        assert_eq!(
            map_code(
                SuotarEndpoint::VerifyAttainments,
                "somethingSuotarAddedLater"
            ),
            Some(CreditRegistrationErrorCode::Unknown)
        );
    }
}
