//! The ledger row itself: creating it and reading it back whole.

use super::state::{CreditRegistrationErrorCode, CreditRegistrationState, ResubmissionFacts};
use crate::credit_registration_events::{CreditRegistrationEventKind, NewCreditRegistrationEvent};
use crate::library::credit_registration::enrolment_check_schedule::{
    EnrolmentCheckGroup, EnrolmentCheckSource,
};
use crate::library::credit_registration::grade_mapping::MappedGrade;
use crate::prelude::*;

#[derive(Debug, Deserialize, Clone)]
pub struct CreditRegistration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    /// Set on a course module row; see `subject_id`.
    pub course_module_completion_id: Option<Uuid>,
    pub user_id: Uuid,
    /// Set on a course module row only, as are `course_module_id` and `course_instance_id`.
    pub course_id: Option<Uuid>,
    pub course_module_id: Option<Uuid>,
    pub course_instance_id: Option<Uuid>,
    /// Set on a mooc.fi row; see `subject_id`.
    pub external_completion_id: Option<Uuid>,
    /// Set on a mooc.fi row only, in place of `course_module_id`.
    pub external_credit_target_id: Option<Uuid>,
    /// The completion being registered, whichever kind of row this is.
    pub subject_id: Uuid,
    /// The module or mooc.fi target the row registers for, whichever kind of row this is.
    pub credit_unit_id: Uuid,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub error_message: Option<String>,
    pub needs_admin_attention: bool,
    pub enrolment_banner_dismissed_at: Option<DateTime<Utc>>,
    pub student_number: Option<DbSecret>,
    pub sisu_person_id: Option<DbSecret>,
    pub uh_course_code: Option<String>,
    pub selected_enrolment_id: Option<String>,
    pub selected_enrolment_kind: Option<String>,
    pub selected_enrolment_realisation_id: Option<String>,
    pub attained_at: Option<DateTime<Utc>>,
    pub attainment_language: Option<String>,
    pub grade_scale_id: Option<String>,
    pub grade_id: Option<String>,
    pub credits: Option<f32>,
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
    /// Set once the student mail for that outcome is queued, and never cleared: these two are the
    /// idempotency guard for the `student-notifications` phase.
    pub action_needed_email_delivery_id: Option<Uuid>,
    pub registered_email_delivery_id: Option<Uuid>,
    /// The completion revision the grade-improvement scan last found no improvement against. See
    /// [`mark_improvement_checked`](super::mark_improvement_checked).
    pub improvement_checked_completion_updated_at: Option<DateTime<Utc>>,
    /// Set while verify sees only an assessment item attainment for the submission.
    pub partially_registered_at: Option<DateTime<Utc>>,
    pub not_registered_reimport_count: i32,
    /// Localized `{fi, sv, en}` name of the chosen enrolment's realisation, as Suotar reported it.
    pub selected_enrolment_realisation_name: Option<serde_json::Value>,
    /// Suotar's `retryAfter` for a pending submission; resubmitting earlier may duplicate it.
    pub resubmit_not_before: Option<DateTime<Utc>>,
    /// A later attempt on its way to replace this registered row; see
    /// [`mark_pending_superseded`](super::mark_pending_superseded). Until it lands this row is
    /// still the credit Sisu holds.
    pub pending_superseded_by_id: Option<Uuid>,
    /// When the row started waiting for an enrolment, held across the rechecks that keep finding
    /// none.
    pub no_usable_enrolment_since: Option<DateTime<Utc>>,
    /// Kept for the row's whole life; see [`EnrolmentCheckGroup`].
    pub enrolment_check_group: EnrolmentCheckGroup,
    /// What the ladder is counted from. `None` outside the wait for an enrolment, which is how the
    /// phases tell a scheduled check from any other resolve.
    pub enrolment_check_anchor_at: Option<DateTime<Utc>>,
    pub enrolment_check_step: Option<i32>,
    /// The ladder time of `enrolment_check_step`, which `next_attempt_at` does not keep.
    pub enrolment_check_due_at: Option<DateTime<Utc>>,
    pub is_enrolment_check_batched: bool,
    pub enrolment_check_source: EnrolmentCheckSource,
    pub enrolment_checks_stopped_at: Option<DateTime<Utc>>,
    pub enrolment_check_requested_at: Option<DateTime<Utc>>,
    pub enrolment_check_restart_window_started_at: Option<DateTime<Utc>>,
    pub enrolment_check_restart_count: i32,
    /// `None` until the first check, which is what lets any roster listing wake a row never
    /// checked.
    pub seen_enrolment_ids: Option<Vec<String>>,
    /// Set while a lookup is out for a row parked in `no_usable_enrolment`; see
    /// [`claim_enrolment_checks`](super::claim_enrolment_checks).
    pub enrolment_check_claimed_until: Option<DateTime<Utc>>,
    /// When the row last entered a different state. Not `state_entered_at`, which every write that
    /// keeps the state (each verify poll, each enrolment check) moves too.
    pub state_changed_at: DateTime<Utc>,
    /// When a state change last moved the row into another timeline phase; see
    /// [`TimelinePhase::entered_with`](crate::library::credit_registration::timeline::TimelinePhase::entered_with).
    pub phase_started_at: DateTime<Utc>,
}

impl CreditRegistration {
    /// What decides whether a human may move this row; see [`ResubmissionFacts`].
    pub fn resubmission_facts(&self) -> ResubmissionFacts {
        ResubmissionFacts {
            state: self.state,
            is_superseded: self.superseded_by_id.is_some(),
            error_code: self.error_code,
            resubmit_not_before: self.resubmit_not_before,
            submitted_at: self.submitted_at,
        }
    }

    /// The grade the frozen payload carries; `None` before one is frozen.
    pub fn frozen_grade(&self) -> Option<MappedGrade> {
        MappedGrade::from_columns(self.grade_scale_id.as_deref(), self.grade_id.as_deref())
    }

    /// See [`is_waiting_for_enrolment`].
    pub fn is_waiting_for_enrolment(&self) -> bool {
        is_waiting_for_enrolment(
            self.state,
            self.enrolment_check_anchor_at,
            self.no_usable_enrolment_since,
        )
    }
}

/// Whether a row is waiting for an enrolment: parked without a usable one, check schedule started
/// or not, or on its first check or a retry on its way there. Only such a row is moved by a visit
/// or a check request, and kept waiting through a lookup that fails in transit.
pub fn is_waiting_for_enrolment(
    state: CreditRegistrationState,
    enrolment_check_anchor_at: Option<DateTime<Utc>>,
    no_usable_enrolment_since: Option<DateTime<Utc>>,
) -> bool {
    state.keeps_enrolment_check_schedule()
        && (enrolment_check_anchor_at.is_some() || no_usable_enrolment_since.is_some())
}

/// A completion a ledger row can register, named by its own id and kind: what the per-completion
/// side tables (enrolment check signals, enrolment routes) are keyed by. Its [`id`](Self::id) is the
/// ledger's `subject_id`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SubjectId {
    CourseModuleCompletion(Uuid),
    ExternalCompletion(Uuid),
}

impl SubjectId {
    /// The completion's id in its own table, which is also the ledger's `subject_id`.
    pub fn id(self) -> Uuid {
        match self {
            Self::CourseModuleCompletion(id) | Self::ExternalCompletion(id) => id,
        }
    }

    /// The id for a `course_module_completion_id` column, `None` for a mooc.fi completion.
    pub fn course_module_completion_id(self) -> Option<Uuid> {
        match self {
            Self::CourseModuleCompletion(id) => Some(id),
            Self::ExternalCompletion(_) => None,
        }
    }

    /// The id for an `external_completion_id` column, `None` for a course module completion.
    pub fn external_completion_id(self) -> Option<Uuid> {
        match self {
            Self::CourseModuleCompletion(_) => None,
            Self::ExternalCompletion(id) => Some(id),
        }
    }

    /// The completion `registration` registers.
    pub fn of(registration: &CreditRegistration) -> Self {
        match registration.external_completion_id {
            Some(id) => Self::ExternalCompletion(id),
            None => Self::CourseModuleCompletion(registration.subject_id),
        }
    }
}

/// The completion a new ledger row registers, with the ids its kind of row carries.
#[derive(Debug, Clone, PartialEq)]
pub enum NewRegistrationSubject {
    CourseModule {
        course_module_completion_id: Uuid,
        course_id: Uuid,
        course_module_id: Uuid,
        course_instance_id: Uuid,
    },
    Moocfi {
        external_completion_id: Uuid,
        external_credit_target_id: Uuid,
    },
}

impl NewRegistrationSubject {
    /// The subject a ledger row's id columns name, as read back from the row; `None` for a mix
    /// `credit_registrations_one_subject` refuses.
    pub fn from_columns(
        course_module_completion_id: Option<Uuid>,
        course_id: Option<Uuid>,
        course_module_id: Option<Uuid>,
        course_instance_id: Option<Uuid>,
        external_completion_id: Option<Uuid>,
        external_credit_target_id: Option<Uuid>,
    ) -> Option<Self> {
        match (
            course_module_completion_id,
            course_id,
            course_module_id,
            course_instance_id,
            external_completion_id,
            external_credit_target_id,
        ) {
            (
                Some(course_module_completion_id),
                Some(course_id),
                Some(course_module_id),
                Some(course_instance_id),
                None,
                None,
            ) => Some(Self::CourseModule {
                course_module_completion_id,
                course_id,
                course_module_id,
                course_instance_id,
            }),
            (
                None,
                None,
                None,
                None,
                Some(external_completion_id),
                Some(external_credit_target_id),
            ) => Some(Self::Moocfi {
                external_completion_id,
                external_credit_target_id,
            }),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewCreditRegistration {
    pub subject: NewRegistrationSubject,
    pub user_id: Uuid,
    pub attempt_number: i32,
}

/// Creates a ledger row at `pending` with a `created` event.
pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new: &NewCreditRegistration,
    event_message: Option<&str>,
) -> ModelResult<Uuid> {
    let id = pkey_policy.into_uuid();
    let (course_module_completion_id, course_id, course_module_id, course_instance_id) =
        match new.subject {
            NewRegistrationSubject::CourseModule {
                course_module_completion_id,
                course_id,
                course_module_id,
                course_instance_id,
            } => (
                Some(course_module_completion_id),
                Some(course_id),
                Some(course_module_id),
                Some(course_instance_id),
            ),
            NewRegistrationSubject::Moocfi { .. } => (None, None, None, None),
        };
    let (external_completion_id, external_credit_target_id) = match new.subject {
        NewRegistrationSubject::Moocfi {
            external_completion_id,
            external_credit_target_id,
        } => (
            Some(external_completion_id),
            Some(external_credit_target_id),
        ),
        NewRegistrationSubject::CourseModule { .. } => (None, None),
    };
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
    external_completion_id,
    external_credit_target_id,
    attempt_number
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
        id,
        course_module_completion_id,
        new.user_id,
        course_id,
        course_module_id,
        course_instance_id,
        external_completion_id,
        external_credit_target_id,
        new.attempt_number,
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

/// The named rows, locked until the caller's transaction ends. Must be called inside one.
///
/// For a caller that judges each row and then transitions it: holding the lock is what keeps the
/// judgement true, so [`transition`](super::transition::transition)'s `expected_from_state` cannot fail halfway
/// and roll the whole batch back. Locks in id order, which every batch caller shares, so two of
/// them cannot deadlock.
pub async fn get_by_ids_for_update(
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
ORDER BY id FOR UPDATE
        "#,
        ids
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

/// Whether this account has any attempt, live or replaced, on this course.
///
/// For course-scoped handlers that take a user id from a request body: without it, holding one
/// course lets a teacher ask questions about accounts that have nothing to do with it.
pub async fn exists_for_user_and_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<bool> {
    let exists = sqlx::query_scalar!(
        r#"
SELECT EXISTS (
    SELECT 1
    FROM credit_registrations
    WHERE user_id = $1
      AND course_id = $2
      AND deleted_at IS NULL
  ) AS "exists!"
        "#,
        user_id,
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(exists)
}
