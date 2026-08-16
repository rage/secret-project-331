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

/// The narrowings the Audit tab applies, all of them in SQL.
#[derive(Debug, Clone, Default)]
pub struct CreditRegistrationAdminActionFilters<'a> {
    pub actions: Option<&'a [CreditRegistrationAdminAction]>,
    pub actor_user_id: Option<Uuid>,
    /// `global_admin` or `course_teacher`. The filter decision 19 exists for: an admin and a
    /// teacher acting on the same course are otherwise indistinguishable.
    pub actor_role: Option<&'a str>,
    pub target_kind: Option<CreditRegistrationAdminActionTarget>,
    pub target_id: Option<Uuid>,
    pub target_phase: Option<&'a str>,
    /// Matches the course a teacher's permission authorised and a course-targeted action alike, the
    /// same widening [`get_for_course`] uses.
    pub course_id: Option<Uuid>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

/// One action with its actor named and the page's total attached.
#[derive(Debug, Clone, PartialEq)]
pub struct CreditRegistrationAdminActionListRow {
    pub action: CreditRegistrationAdminActionRecord,
    pub actor_first_name: Option<String>,
    pub actor_last_name: Option<String>,
    pub actor_email: Option<String>,
    /// Named for the course-targeted and teacher-authorised rows; `None` where neither applies.
    pub course_name: Option<String>,
    pub total_count: i64,
}

/// A page of the global action log, newest first, covering both actor kinds.
///
/// The global slice. [`get_for_course`] is the teacher's per-course one and stays narrower.
pub async fn get_page(
    conn: &mut PgConnection,
    filters: &CreditRegistrationAdminActionFilters<'_>,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<CreditRegistrationAdminActionListRow>> {
    let rows = sqlx::query!(
        r#"
SELECT a.id,
  a.created_at,
  a.updated_at,
  a.deleted_at,
  a.action AS "action!: CreditRegistrationAdminAction",
  a.target_kind AS "target_kind!: CreditRegistrationAdminActionTarget",
  a.target_id,
  a.target_phase,
  a.actor_user_id,
  a.actor_role,
  a.actor_course_id,
  a.reason,
  a.before_state AS "before_state?: CreditRegistrationState",
  a.after_state AS "after_state?: CreditRegistrationState",
  a.details,
  a.affected_row_count,
  ud.first_name AS "actor_first_name?",
  ud.last_name AS "actor_last_name?",
  ud.email AS "actor_email?",
  c.name AS "course_name?",
  COUNT(*) OVER () AS "total_count!"
FROM credit_registration_admin_actions a
  LEFT JOIN user_details ud ON ud.user_id = a.actor_user_id
  LEFT JOIN courses c ON c.id = COALESCE(
    a.actor_course_id,
    CASE
      WHEN a.target_kind = 'course' THEN a.target_id
    END
  )
WHERE a.deleted_at IS NULL
  AND (
    $1::credit_registration_admin_action [] IS NULL
    OR a.action = ANY($1)
  )
  AND ($2::uuid IS NULL OR a.actor_user_id = $2)
  AND ($3::text IS NULL OR a.actor_role = $3)
  AND (
    $4::credit_registration_admin_action_target IS NULL
    OR a.target_kind = $4
  )
  AND ($5::uuid IS NULL OR a.target_id = $5)
  AND ($6::text IS NULL OR a.target_phase = $6)
  AND (
    $7::uuid IS NULL
    OR a.actor_course_id = $7
    OR (
      a.target_kind = 'course'
      AND a.target_id = $7
    )
  )
  AND ($8::timestamptz IS NULL OR a.created_at >= $8)
  AND ($9::timestamptz IS NULL OR a.created_at <= $9)
ORDER BY a.created_at DESC,
  a.id
LIMIT $10 OFFSET $11
        "#,
        filters.actions as Option<&[CreditRegistrationAdminAction]>,
        filters.actor_user_id,
        filters.actor_role,
        filters.target_kind as Option<CreditRegistrationAdminActionTarget>,
        filters.target_id,
        filters.target_phase,
        filters.course_id,
        filters.from,
        filters.to,
        limit,
        offset,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| CreditRegistrationAdminActionListRow {
            actor_first_name: row.actor_first_name,
            actor_last_name: row.actor_last_name,
            actor_email: row.actor_email,
            course_name: row.course_name,
            total_count: row.total_count,
            action: CreditRegistrationAdminActionRecord {
                id: row.id,
                created_at: row.created_at,
                updated_at: row.updated_at,
                deleted_at: row.deleted_at,
                action: row.action,
                target_kind: row.target_kind,
                target_id: row.target_id,
                target_phase: row.target_phase,
                actor_user_id: row.actor_user_id,
                actor_role: row.actor_role,
                actor_course_id: row.actor_course_id,
                reason: row.reason,
                before_state: row.before_state,
                after_state: row.after_state,
                details: row.details,
                affected_row_count: row.affected_row_count,
            },
        })
        .collect())
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

/// Everything a course's own action history should show: actions a teacher of the course took, and
/// actions aimed at the course itself whoever took them.
///
/// Wider than [`get_by_actor_course`], which answers only "what have this course's teachers done".
pub async fn get_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    limit: i64,
) -> ModelResult<Vec<CreditRegistrationAdminActionRecord>> {
    let res = sqlx::query_as!(
        CreditRegistrationAdminActionRecord,
        r#"
SELECT *
FROM credit_registration_admin_actions
WHERE (
    actor_course_id = $1
    OR (
      target_kind = 'course'
      AND target_id = $1
    )
  )
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2
        "#,
        course_id,
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
