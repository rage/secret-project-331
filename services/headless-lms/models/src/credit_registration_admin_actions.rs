//! Audit of manual actions on the credit registration pipeline.
//!
//! Separate from `credit_registration_events` because the targets are often not registrations at
//! all: a phase, a course module, a student-number link. Item-targeted actions write both tables.
use utoipa::ToSchema;

use crate::credit_registrations::CreditRegistrationState;
use crate::prelude::*;

pub const GLOBAL_ADMIN_ROLE: &str = "global_admin";
pub const COURSE_TEACHER_ROLE: &str = "course_teacher";

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, Type, ToSchema)]
#[sqlx(
    type_name = "credit_registration_admin_action",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationAdminAction {
    RetryItem,
    RetryFailedForCourse,
    ForceRecheck,
    MarkResolved,
    RequeueBatch,
    TransitionItem,
    CancelRegistration,
    PauseCourseModule,
    ResumeCourseModule,
    PausePhase,
    ResumePhase,
    RunPhaseNow,
    ResendLinkEmail,
    UnlinkStudentNumber,
    ManualLinkStudentNumber,
    OverrideRateCap,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, Type, ToSchema)]
#[sqlx(
    type_name = "credit_registration_admin_action_target",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationAdminActionTarget {
    CreditRegistration,
    CourseModule,
    Course,
    Phase,
    VerifiedStudentNumber,
    StudentNumberVerificationToken,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAdminActionRecord {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub action: CreditRegistrationAdminAction,
    pub target_kind: CreditRegistrationAdminActionTarget,
    pub target_id: Option<Uuid>,
    pub target_phase: Option<String>,
    pub actor_user_id: Uuid,
    pub actor_role: String,
    pub actor_course_id: Option<Uuid>,
    pub reason: Option<String>,
    pub before_state: Option<CreditRegistrationState>,
    pub after_state: Option<CreditRegistrationState>,
    pub details: Option<serde_json::Value>,
    pub affected_row_count: Option<i32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewCreditRegistrationAdminAction {
    pub action: CreditRegistrationAdminAction,
    pub target_kind: CreditRegistrationAdminActionTarget,
    /// `None` only for phase targets, which are keyed by `target_phase`.
    pub target_id: Option<Uuid>,
    pub target_phase: Option<String>,
    pub actor_user_id: Uuid,
    /// `global_admin` or `course_teacher`.
    pub actor_role: String,
    /// The course whose edit permission authorised a teacher action.
    pub actor_course_id: Option<Uuid>,
    pub reason: Option<String>,
    pub before_state: Option<CreditRegistrationState>,
    pub after_state: Option<CreditRegistrationState>,
    /// Scrub before passing if this ever carries a Suotar payload.
    pub details: Option<serde_json::Value>,
    pub affected_row_count: Option<i32>,
}

impl NewCreditRegistrationAdminAction {
    /// The fields every call site names; everything else defaults to `None` and is overridden with
    /// struct-update syntax where it varies, the same way [`crate::credit_registrations::Transition`]
    /// is built from [`crate::credit_registrations::Transition::to`].
    pub fn new(
        action: CreditRegistrationAdminAction,
        target_kind: CreditRegistrationAdminActionTarget,
        actor_user_id: Uuid,
        actor_role: &str,
    ) -> Self {
        Self {
            action,
            target_kind,
            target_id: None,
            target_phase: None,
            actor_user_id,
            actor_role: actor_role.to_string(),
            actor_course_id: None,
            reason: None,
            before_state: None,
            after_state: None,
            details: None,
            affected_row_count: None,
        }
    }
}

/// Call in the same transaction as the effect it audits.
pub async fn record(
    conn: &mut PgConnection,
    new: &NewCreditRegistrationAdminAction,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
INSERT INTO credit_registration_admin_actions (
    action,
    target_kind,
    target_id,
    target_phase,
    actor_user_id,
    actor_role,
    actor_course_id,
    reason,
    before_state,
    after_state,
    details,
    affected_row_count
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING id
        "#,
        new.action as CreditRegistrationAdminAction,
        new.target_kind as CreditRegistrationAdminActionTarget,
        new.target_id,
        new.target_phase,
        new.actor_user_id,
        new.actor_role,
        new.actor_course_id,
        new.reason,
        new.before_state as Option<CreditRegistrationState>,
        new.after_state as Option<CreditRegistrationState>,
        new.details,
        new.affected_row_count,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

/// Backs the per-actor guard on the resend endpoints: one person's actions of one kind in a window.
pub async fn count_by_actor_since(
    conn: &mut PgConnection,
    actor_user_id: Uuid,
    action: CreditRegistrationAdminAction,
    since: DateTime<Utc>,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registration_admin_actions
WHERE actor_user_id = $1
  AND action = $2
  AND created_at >= $3
  AND deleted_at IS NULL
        "#,
        actor_user_id,
        action as CreditRegistrationAdminAction,
        since,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// Backs the admin resend endpoint's own quiet period. Unlike `count_by_actor_since`, a refused
/// attempt (no mail sent) doesn't count: otherwise a refusal would block the immediate
/// override-and-retry the rate cap's own "send anyway" option exists to offer.
pub async fn count_queued_resends_by_actor_since(
    conn: &mut PgConnection,
    actor_user_id: Uuid,
    since: DateTime<Utc>,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registration_admin_actions
WHERE actor_user_id = $1
  AND action = $2
  AND details ->> 'outcome' = 'queued'
  AND created_at >= $3
  AND deleted_at IS NULL
        "#,
        actor_user_id,
        CreditRegistrationAdminAction::ResendLinkEmail as CreditRegistrationAdminAction,
        since,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

pub async fn get_recent(
    conn: &mut PgConnection,
    limit: i64,
) -> ModelResult<Vec<CreditRegistrationAdminActionRecord>> {
    let res = sqlx::query_as!(
        CreditRegistrationAdminActionRecord,
        r#"
SELECT *
FROM credit_registration_admin_actions
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $1
        "#,
        limit
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_target(
    conn: &mut PgConnection,
    target_kind: CreditRegistrationAdminActionTarget,
    target_id: Uuid,
) -> ModelResult<Vec<CreditRegistrationAdminActionRecord>> {
    let res = sqlx::query_as!(
        CreditRegistrationAdminActionRecord,
        r#"
SELECT *
FROM credit_registration_admin_actions
WHERE target_kind = $1
  AND target_id = $2
  AND deleted_at IS NULL
ORDER BY created_at DESC
        "#,
        target_kind as CreditRegistrationAdminActionTarget,
        target_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_actor(
    conn: &mut PgConnection,
    actor_user_id: Uuid,
    limit: i64,
) -> ModelResult<Vec<CreditRegistrationAdminActionRecord>> {
    let res = sqlx::query_as!(
        CreditRegistrationAdminActionRecord,
        r#"
SELECT *
FROM credit_registration_admin_actions
WHERE actor_user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2
        "#,
        actor_user_id,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Actions authorised by a course's teacher permission, not actions targeting the course.
pub async fn get_by_actor_course(
    conn: &mut PgConnection,
    actor_course_id: Uuid,
    limit: i64,
) -> ModelResult<Vec<CreditRegistrationAdminActionRecord>> {
    let res = sqlx::query_as!(
        CreditRegistrationAdminActionRecord,
        r#"
SELECT *
FROM credit_registration_admin_actions
WHERE actor_course_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2
        "#,
        actor_course_id,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_phase(
    conn: &mut PgConnection,
    target_phase: &str,
    limit: i64,
) -> ModelResult<Vec<CreditRegistrationAdminActionRecord>> {
    let res = sqlx::query_as!(
        CreditRegistrationAdminActionRecord,
        r#"
SELECT *
FROM credit_registration_admin_actions
WHERE target_phase = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2
        "#,
        target_phase,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
