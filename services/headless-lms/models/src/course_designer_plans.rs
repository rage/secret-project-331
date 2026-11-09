use crate::course_designer_plan_members;
use crate::course_designer_section_statuses::CourseDesignerPlanSectionStatus;
use crate::course_designer_stage_workspace::{self, CourseDesignerStageWorkspace};
use crate::prelude::*;
use chrono::{Datelike, Duration, NaiveDate};
use serde_json::{Value, json};
use utoipa::ToSchema;

const MAX_GREAT_MOOC_VISION_CHARS: usize = 10_000;

/// Upper bound for one extension of the active stage.
pub const MAX_EXTEND_MONTHS: u32 = 24;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "course_designer_stage", rename_all = "snake_case")]
pub enum CourseDesignerStage {
    Analysis,
    Design,
    Development,
    Implementation,
    Evaluation,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "course_designer_plan_status", rename_all = "snake_case")]
pub enum CourseDesignerPlanStatus {
    Draft,
    Scheduling,
    InProgress,
    Completed,
    Archived,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(
    type_name = "course_designer_plan_stage_status",
    rename_all = "snake_case"
)]
pub enum CourseDesignerPlanStageStatus {
    NotStarted,
    InProgress,
    Completed,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CourseDesignerCourseSize {
    Small,
    Medium,
    Large,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, FromRow, ToSchema)]
pub struct CourseDesignerPlan {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_by_user_id: Uuid,
    pub name: Option<String>,
    pub status: CourseDesignerPlanStatus,
    pub active_stage: Option<CourseDesignerStage>,
    pub last_weekly_stage_email_sent_at: Option<DateTime<Utc>>,
    pub great_mooc_vision: Option<String>,
    /// Set once a course has been created from the plan; see [`crate::library::course_designer::create_course_from_plan`].
    pub created_course_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, FromRow, ToSchema)]
pub struct CourseDesignerPlanSummary {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by_user_id: Uuid,
    pub name: Option<String>,
    pub status: CourseDesignerPlanStatus,
    pub active_stage: Option<CourseDesignerStage>,
    pub last_weekly_stage_email_sent_at: Option<DateTime<Utc>>,
    pub member_count: i64,
    pub stage_count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, FromRow, ToSchema)]
pub struct CourseDesignerPlanMember {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub user_id: Uuid,
    pub receives_weekly_digest: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, FromRow, ToSchema)]
pub struct CourseDesignerPlanStage {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub stage: CourseDesignerStage,
    pub status: CourseDesignerPlanStageStatus,
    pub planned_starts_on: NaiveDate,
    pub planned_ends_on: NaiveDate,
    pub actual_started_at: Option<DateTime<Utc>>,
    pub actual_completed_at: Option<DateTime<Utc>>,
    pub workspace_data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, FromRow, ToSchema)]
pub struct CourseDesignerPlanStageTask {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub course_designer_plan_stage_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub order_number: i32,
    pub is_completed: bool,
    pub completed_at: Option<DateTime<Utc>>,
    pub completed_by_user_id: Option<Uuid>,
    pub is_auto_generated: bool,
    pub created_by_user_id: Option<Uuid>,
    /// Always a current plan member; cleared when that member leaves.
    pub assignee_user_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseDesignerPlanStageWithTasks {
    #[serde(flatten)]
    pub stage: CourseDesignerPlanStage,
    pub tasks: Vec<CourseDesignerPlanStageTask>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseDesignerPlanDetails {
    pub plan: CourseDesignerPlan,
    pub members: Vec<CourseDesignerPlanMember>,
    pub stages: Vec<CourseDesignerPlanStageWithTasks>,
    pub section_statuses: Vec<CourseDesignerPlanSectionStatus>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, ToSchema)]
pub struct CourseDesignerScheduleStageInput {
    pub stage: CourseDesignerStage,
    pub planned_starts_on: NaiveDate,
    pub planned_ends_on: NaiveDate,
}

pub fn fixed_stage_order() -> [CourseDesignerStage; 5] {
    [
        CourseDesignerStage::Analysis,
        CourseDesignerStage::Design,
        CourseDesignerStage::Development,
        CourseDesignerStage::Implementation,
        CourseDesignerStage::Evaluation,
    ]
}

pub fn validate_schedule_input(stages: &[CourseDesignerScheduleStageInput]) -> ModelResult<()> {
    let expected_order = fixed_stage_order();
    if stages.len() != expected_order.len() {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "Schedule must contain exactly 5 stages.".to_string(),
            None,
        ));
    }

    for (idx, stage) in stages.iter().enumerate() {
        if stage.stage != expected_order[idx] {
            return Err(ModelError::new(
                ModelErrorType::InvalidRequest,
                "Schedule stages must be in the fixed order: analysis, design, development, implementation, evaluation."
                    .to_string(),
                None,
            ));
        }
        if stage.planned_starts_on > stage.planned_ends_on {
            return Err(ModelError::new(
                ModelErrorType::InvalidRequest,
                format!("Stage {:?} starts after it ends.", stage.stage),
                None,
            ));
        }
        if idx > 0 {
            let prev = &stages[idx - 1];
            if !no_gap_between(prev.planned_ends_on, stage.planned_starts_on) {
                return Err(ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "Schedule must have no gaps or overlaps between consecutive stages."
                        .to_string(),
                    None,
                ));
            }
        }
    }

    Ok(())
}

fn first_day_of_month(date: NaiveDate) -> ModelResult<NaiveDate> {
    NaiveDate::from_ymd_opt(date.year(), date.month(), 1).ok_or_else(|| {
        ModelError::new(
            ModelErrorType::InvalidRequest,
            "Invalid date while generating schedule suggestion.".to_string(),
            None,
        )
    })
}

fn last_day_of_month(year: i32, month: u32) -> ModelResult<u32> {
    for day in (28..=31).rev() {
        if NaiveDate::from_ymd_opt(year, month, day).is_some() {
            return Ok(day);
        }
    }

    Err(ModelError::new(
        ModelErrorType::InvalidRequest,
        "Invalid month while generating schedule suggestion.".to_string(),
        None,
    ))
}

pub(crate) fn add_months_clamped(date: NaiveDate, months: u32) -> ModelResult<NaiveDate> {
    let total_months = date.year() * 12 + date.month0() as i32 + months as i32;
    let target_year = total_months.div_euclid(12);
    let target_month0 = total_months.rem_euclid(12) as u32;
    let target_month = target_month0 + 1;
    let target_day = date
        .day()
        .min(last_day_of_month(target_year, target_month)?);

    NaiveDate::from_ymd_opt(target_year, target_month, target_day).ok_or_else(|| {
        ModelError::new(
            ModelErrorType::InvalidRequest,
            "Failed to generate schedule suggestion date.".to_string(),
            None,
        )
    })
}

fn suggestion_months(size: CourseDesignerCourseSize) -> [u32; 5] {
    match size {
        CourseDesignerCourseSize::Small => [1, 1, 2, 1, 1],
        CourseDesignerCourseSize::Medium => [1, 2, 3, 2, 1],
        CourseDesignerCourseSize::Large => [2, 2, 4, 3, 1],
    }
}

pub fn build_schedule_suggestion(
    size: CourseDesignerCourseSize,
    starts_on: NaiveDate,
) -> ModelResult<Vec<CourseDesignerScheduleStageInput>> {
    let mut current_start = first_day_of_month(starts_on)?;
    let stage_order = fixed_stage_order();
    let month_durations = suggestion_months(size);
    let mut out = Vec::with_capacity(stage_order.len());

    for (stage, months) in stage_order.into_iter().zip(month_durations) {
        let next_stage_start = add_months_clamped(current_start, months)?;
        let planned_ends_on = next_stage_start - Duration::days(1);
        out.push(CourseDesignerScheduleStageInput {
            stage,
            planned_starts_on: current_start,
            planned_ends_on,
        });
        current_start = planned_ends_on + Duration::days(1);
    }

    Ok(out)
}

pub(crate) async fn insert_plan_event(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    plan_id: Uuid,
    actor_user_id: Option<Uuid>,
    event_type: &str,
    stage: Option<CourseDesignerStage>,
    payload: Value,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO course_designer_plan_events (
  course_designer_plan_id,
  actor_user_id,
  event_type,
  stage,
  payload
)
VALUES ($1, $2, $3, $4, $5)
"#,
        plan_id,
        actor_user_id,
        event_type,
        stage as Option<CourseDesignerStage>,
        payload
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn create_plan(
    conn: &mut PgConnection,
    user_id: Uuid,
    name: Option<String>,
) -> ModelResult<CourseDesignerPlan> {
    let mut tx = conn.begin().await?;

    let plan: CourseDesignerPlan = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
INSERT INTO course_designer_plans (created_by_user_id, name)
VALUES ($1, $2)
RETURNING *
"#,
        user_id,
        name
    )
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query!(
        r#"
INSERT INTO course_designer_plan_members (course_designer_plan_id, user_id)
VALUES ($1, $2)
"#,
        plan.id,
        user_id
    )
    .execute(&mut *tx)
    .await?;

    insert_plan_event(
        &mut tx,
        plan.id,
        Some(user_id),
        "plan_created",
        None,
        json!({ "name": plan.name }),
    )
    .await?;

    tx.commit().await?;
    Ok(plan)
}

pub async fn get_plan_details_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlanDetails> {
    let plan = course_designer_plan_members::get_plan_for_user(conn, plan_id, user_id).await?;
    let members =
        course_designer_plan_members::get_plan_members_for_user(conn, plan_id, user_id).await?;
    let stages =
        course_designer_plan_members::get_plan_stages_for_user(conn, plan_id, user_id).await?;
    let tasks =
        course_designer_plan_members::get_plan_tasks_for_user(conn, plan_id, user_id).await?;
    let section_statuses =
        crate::course_designer_section_statuses::get_for_plan(conn, plan_id).await?;
    let mut tasks_by_stage: std::collections::HashMap<Uuid, Vec<CourseDesignerPlanStageTask>> =
        tasks
            .into_iter()
            .fold(std::collections::HashMap::new(), |mut acc, t| {
                acc.entry(t.course_designer_plan_stage_id)
                    .or_default()
                    .push(t);
                acc
            });
    let stages_with_tasks: Vec<CourseDesignerPlanStageWithTasks> = stages
        .into_iter()
        .map(|stage| {
            let stage_id = stage.id;
            let stage_tasks = tasks_by_stage.remove(&stage_id).unwrap_or_default();
            CourseDesignerPlanStageWithTasks {
                stage,
                tasks: stage_tasks,
            }
        })
        .collect();
    Ok(CourseDesignerPlanDetails {
        plan,
        members,
        stages: stages_with_tasks,
        section_statuses,
    })
}

/// Saves a stage's workspace form. The workspace schema must belong to `stage`.
pub async fn update_stage_workspace_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
    stage: CourseDesignerStage,
    workspace: CourseDesignerStageWorkspace,
) -> ModelResult<CourseDesignerPlanDetails> {
    if workspace.stage() != stage {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            format!("This workspace schema does not belong to the {stage:?} stage."),
            None,
        ));
    }
    let workspace_json = course_designer_stage_workspace::workspace_to_json(&workspace)?;
    let mut tx = conn.begin().await?;
    let updated: Option<Uuid> = sqlx::query_scalar!(
        r#"
UPDATE course_designer_plan_stages s
SET workspace_data = $3
FROM course_designer_plan_members m
WHERE s.course_designer_plan_id = $1
  AND s.stage = $2
  AND s.deleted_at IS NULL
  AND m.course_designer_plan_id = s.course_designer_plan_id
  AND m.user_id = $4
  AND m.deleted_at IS NULL
RETURNING s.id
"#,
        plan_id,
        stage as CourseDesignerStage,
        workspace_json,
        user_id
    )
    .fetch_optional(&mut *tx)
    .await?;
    if updated.is_none() {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Stage not found or user is not a plan member.".to_string(),
            None,
        ));
    }
    // Autosave fires on every edit; one event per member and stage an hour keeps the timeline readable.
    sqlx::query!(
        r#"
INSERT INTO course_designer_plan_events (
  course_designer_plan_id,
  actor_user_id,
  event_type,
  stage
)
SELECT $1, $2, 'workspace_saved', $3
WHERE NOT EXISTS (
  SELECT 1
  FROM course_designer_plan_events
  WHERE course_designer_plan_id = $1
    AND actor_user_id = $2
    AND event_type = 'workspace_saved'
    AND stage = $3
    AND occurred_at > NOW() - INTERVAL '1 hour'
    AND deleted_at IS NULL
)
"#,
        plan_id,
        user_id,
        stage as CourseDesignerStage
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    get_plan_details_for_user(conn, plan_id, user_id).await
}

/// Saves the plan's "what makes this MOOC great" text; blank text clears it.
pub async fn set_great_mooc_vision_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
    great_mooc_vision: Option<String>,
) -> ModelResult<CourseDesignerPlan> {
    let great_mooc_vision = great_mooc_vision.filter(|v| !v.trim().is_empty());
    if great_mooc_vision
        .as_ref()
        .is_some_and(|v| v.chars().count() > MAX_GREAT_MOOC_VISION_CHARS)
    {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            format!("The vision can be at most {MAX_GREAT_MOOC_VISION_CHARS} characters long."),
            None,
        ));
    }
    let plan = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
UPDATE course_designer_plans p
SET great_mooc_vision = $3
FROM course_designer_plan_members m
WHERE p.id = $1
  AND p.deleted_at IS NULL
  AND m.course_designer_plan_id = p.id
  AND m.user_id = $2
  AND m.deleted_at IS NULL
RETURNING
  p.id,
  p.created_at,
  p.updated_at,
  p.deleted_at,
  p.created_by_user_id,
  p.name,
  p.status,
  p.active_stage,
  p.last_weekly_stage_email_sent_at,
  p.great_mooc_vision,
  p.created_course_id
"#,
        plan_id,
        user_id,
        great_mooc_vision
    )
    .fetch_optional(conn)
    .await?
    .ok_or_else(|| {
        ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Plan not found or user is not a plan member.".to_string(),
            None,
        )
    })?;
    Ok(plan)
}

/// Archives a plan, or restores an archived one, keeping its stages and active stage as they were.
///
/// Restoring derives the status from the schedule: in progress with an active stage, completed
/// when every stage is completed, scheduling when stages exist, draft otherwise.
pub async fn set_archived_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
    archived: bool,
) -> ModelResult<CourseDesignerPlan> {
    let mut tx = conn.begin().await?;
    let plan =
        course_designer_plan_members::get_plan_for_stage_extend(&mut tx, plan_id, user_id).await?;
    let is_archived = plan.status == CourseDesignerPlanStatus::Archived;
    if is_archived == archived {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            if archived {
                "The plan is already archived."
            } else {
                "The plan is not archived."
            }
            .to_string(),
            None,
        ));
    }
    let new_status = if archived {
        CourseDesignerPlanStatus::Archived
    } else if plan.active_stage.is_some() {
        CourseDesignerPlanStatus::InProgress
    } else {
        let counts = sqlx::query!(
            r#"
SELECT
  COUNT(*)::BIGINT AS "stage_count!",
  COUNT(*) FILTER (WHERE status = 'completed')::BIGINT AS "completed_stage_count!"
FROM course_designer_plan_stages
WHERE course_designer_plan_id = $1
  AND deleted_at IS NULL
"#,
            plan_id
        )
        .fetch_one(&mut *tx)
        .await?;
        if counts.stage_count == 0 {
            CourseDesignerPlanStatus::Draft
        } else if counts.completed_stage_count == counts.stage_count {
            CourseDesignerPlanStatus::Completed
        } else {
            CourseDesignerPlanStatus::Scheduling
        }
    };
    let updated = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
UPDATE course_designer_plans
SET status = $2
WHERE id = $1
  AND deleted_at IS NULL
RETURNING *
"#,
        plan_id,
        new_status as CourseDesignerPlanStatus
    )
    .fetch_one(&mut *tx)
    .await?;
    insert_plan_event(
        &mut tx,
        plan_id,
        Some(user_id),
        if archived {
            "plan_archived"
        } else {
            "plan_unarchived"
        },
        None,
        json!({ "status": new_status }),
    )
    .await?;
    tx.commit().await?;
    Ok(updated)
}

pub fn no_gap_between(previous_end: NaiveDate, next_start: NaiveDate) -> bool {
    previous_end + Duration::days(1) == next_start
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, FromRow, ToSchema)]
pub struct PlanMemberWithDetails {
    pub id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    #[schema(value_type = String, format = Email)]
    pub email: String,
    pub created_at: DateTime<Utc>,
    pub receives_weekly_digest: bool,
}

/// One plan as global admins see it in the MOOC support listing.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseDesignerSupportPlan {
    pub plan: CourseDesignerPlan,
    pub members: Vec<PlanMemberWithDetails>,
    pub stages: Vec<CourseDesignerSupportStage>,
    pub section_statuses: Vec<CourseDesignerPlanSectionStatus>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, ToSchema)]
pub struct CourseDesignerSupportStage {
    pub stage: CourseDesignerStage,
    pub status: CourseDesignerPlanStageStatus,
    pub planned_starts_on: NaiveDate,
    pub planned_ends_on: NaiveDate,
    pub task_count: i64,
    pub completed_task_count: i64,
}

/// Every non-deleted plan with its members, stage progress and section marks, newest activity
/// first. Not scoped to a user: the caller must have checked global admin access.
pub async fn list_plans_for_support(
    conn: &mut PgConnection,
) -> ModelResult<Vec<CourseDesignerSupportPlan>> {
    let plans = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
SELECT *
FROM course_designer_plans
WHERE deleted_at IS NULL
ORDER BY updated_at DESC, id DESC
"#
    )
    .fetch_all(&mut *conn)
    .await?;
    let plan_ids: Vec<Uuid> = plans.iter().map(|p| p.id).collect();
    let member_rows = sqlx::query!(
        r#"
SELECT
  m.course_designer_plan_id,
  m.id,
  m.user_id,
  ud.first_name,
  ud.last_name,
  ud.email,
  m.created_at,
  m.receives_weekly_digest
FROM course_designer_plan_members m
JOIN user_details ud ON ud.user_id = m.user_id
WHERE m.course_designer_plan_id = ANY($1)
  AND m.deleted_at IS NULL
ORDER BY m.created_at ASC, m.id ASC
"#,
        &plan_ids
    )
    .fetch_all(&mut *conn)
    .await?;
    let stage_rows = sqlx::query!(
        r#"
SELECT
  s.course_designer_plan_id,
  s.stage AS "stage: CourseDesignerStage",
  s.status AS "status: CourseDesignerPlanStageStatus",
  s.planned_starts_on,
  s.planned_ends_on,
  COUNT(t.id)::BIGINT AS "task_count!",
  COUNT(t.id) FILTER (WHERE t.is_completed)::BIGINT AS "completed_task_count!"
FROM course_designer_plan_stages s
LEFT JOIN course_designer_plan_stage_tasks t
  ON t.course_designer_plan_stage_id = s.id
  AND t.deleted_at IS NULL
WHERE s.course_designer_plan_id = ANY($1)
  AND s.deleted_at IS NULL
GROUP BY s.id
ORDER BY
  CASE s.stage
    WHEN 'analysis' THEN 1
    WHEN 'design' THEN 2
    WHEN 'development' THEN 3
    WHEN 'implementation' THEN 4
    WHEN 'evaluation' THEN 5
  END
"#,
        &plan_ids
    )
    .fetch_all(&mut *conn)
    .await?;
    let section_statuses =
        crate::course_designer_section_statuses::get_for_plans(conn, &plan_ids).await?;

    let mut support_plans: Vec<CourseDesignerSupportPlan> = plans
        .into_iter()
        .map(|plan| CourseDesignerSupportPlan {
            plan,
            members: vec![],
            stages: vec![],
            section_statuses: vec![],
        })
        .collect();
    let index_by_plan: std::collections::HashMap<Uuid, usize> = support_plans
        .iter()
        .enumerate()
        .map(|(index, p)| (p.plan.id, index))
        .collect();
    for row in member_rows {
        if let Some(&index) = index_by_plan.get(&row.course_designer_plan_id) {
            support_plans[index].members.push(PlanMemberWithDetails {
                id: row.id,
                user_id: row.user_id,
                first_name: row.first_name,
                last_name: row.last_name,
                email: row.email,
                created_at: row.created_at,
                receives_weekly_digest: row.receives_weekly_digest,
            });
        }
    }
    for row in stage_rows {
        if let Some(&index) = index_by_plan.get(&row.course_designer_plan_id) {
            support_plans[index]
                .stages
                .push(CourseDesignerSupportStage {
                    stage: row.stage,
                    status: row.status,
                    planned_starts_on: row.planned_starts_on,
                    planned_ends_on: row.planned_ends_on,
                    task_count: row.task_count,
                    completed_task_count: row.completed_task_count,
                });
        }
    }
    for status in section_statuses {
        if let Some(&index) = index_by_plan.get(&status.course_designer_plan_id) {
            support_plans[index].section_statuses.push(status);
        }
    }
    Ok(support_plans)
}
