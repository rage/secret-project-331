//! The credit registration ledger.
//!
//! [`transition`] is the only writer of `state`, stamping `state_entered_at`, the lifecycle
//! timestamps and the audit event in one transaction. Policy — which transition to make, how to
//! back off, grade mapping, enrolment choice — lives in the state machine, not here.
use chrono::NaiveDate;
use utoipa::ToSchema;

use crate::credit_registration_events::{CreditRegistrationEventKind, NewCreditRegistrationEvent};
use crate::prelude::*;

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
    /// States the pipeline never leaves on its own. `terminal_at` is stamped on entry to these.
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
/// `terminal_at` (first terminal state only, never cleared), `registered_at`, `submitted_at`,
/// `enrolment_checked_at` (on leaving `checking_enrolment`), and clears
/// `enrolment_banner_dismissed_at` on entry to `no_usable_enrolment` so a fresh enrolment problem
/// shows the banner again.
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
  terminal_at = CASE
    WHEN $6 THEN COALESCE(terminal_at, now())
    ELSE terminal_at
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

/// Claims up to `limit` due rows in the given states for this worker.
///
/// The `SKIP LOCKED` row locks live until the caller's transaction ends, so callers must pass a
/// transaction. Rows on a paused course module are never claimed, enforced here so no phase can
/// forget it.
pub async fn claim_due(
    conn: &mut PgConnection,
    states: &[CreditRegistrationState],
    limit: i64,
) -> ModelResult<Vec<CreditRegistration>> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
WITH due AS (
  SELECT cr.id
  FROM credit_registrations cr
    JOIN course_modules cm ON cm.id = cr.course_module_id
  WHERE cr.deleted_at IS NULL
    AND cr.superseded_by_id IS NULL
    AND cr.state = ANY($1::credit_registration_state [])
    AND cr.next_attempt_at <= now()
    AND cm.credit_registration_paused_at IS NULL
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

/// Schedules the next pipeline attempt; the backoff delay is the caller's policy.
pub async fn schedule_next_attempt(
    conn: &mut PgConnection,
    id: Uuid,
    next_attempt_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET next_attempt_at = $2,
  first_failed_at = COALESCE(first_failed_at, now())
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
pub async fn count_by_state(
    conn: &mut PgConnection,
) -> ModelResult<Vec<(CreditRegistrationState, i64)>> {
    let rows = sqlx::query!(
        r#"
SELECT state AS "state: CreditRegistrationState",
  COUNT(*) AS "count!"
FROM credit_registrations
WHERE deleted_at IS NULL
GROUP BY state
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows.into_iter().map(|r| (r.state, r.count)).collect())
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
    async fn terminal_at_is_stamped_once_and_never_moved() {
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
}
