use crate::course_designer_plan_members;
use crate::prelude::*;
use chrono::{Datelike, Duration, NaiveDate};
use serde_json::{Value, json};
use utoipa::ToSchema;

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
    pub created_by_user_id: Uuid,
    pub name: Option<String>,
    pub status: CourseDesignerPlanStatus,
    pub active_stage: Option<CourseDesignerStage>,
    pub last_weekly_stage_email_sent_at: Option<DateTime<Utc>>,
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
RETURNING
  id,
  created_at,
  updated_at,
  created_by_user_id,
  name,
  status AS "status: CourseDesignerPlanStatus",
  active_stage AS "active_stage: CourseDesignerStage",
  last_weekly_stage_email_sent_at
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
    })
}

pub async fn update_stage_workspace_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
    stage: CourseDesignerStage,
    workspace: crate::course_designer_analysis_workspace::CourseDesignerStageWorkspace,
) -> ModelResult<CourseDesignerPlanDetails> {
    if stage != CourseDesignerStage::Analysis {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "Workspace payload is only supported for the analysis stage.".to_string(),
            None,
        ));
    }
    let workspace_json = crate::course_designer_analysis_workspace::workspace_to_json(Some(
        workspace,
    ))?
    .ok_or_else(|| {
        ModelError::new(
            ModelErrorType::InvalidRequest,
            "Workspace serialization produced no data.".to_string(),
            None,
        )
    })?;
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
    .fetch_optional(&mut *conn)
    .await?;
    if updated.is_none() {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Stage not found or user is not a plan member.".to_string(),
            None,
        ));
    }
    get_plan_details_for_user(conn, plan_id, user_id).await
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
    pub email: String,
    pub created_at: DateTime<Utc>,
}
