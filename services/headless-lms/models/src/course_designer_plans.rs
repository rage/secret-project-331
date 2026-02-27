use crate::prelude::*;
use chrono::{Datelike, Duration, NaiveDate};
use serde_json::{Value, json};
use sqlx::Row;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "course_designer_stage", rename_all = "snake_case")]
pub enum CourseDesignerStage {
    Analysis,
    Design,
    Development,
    Implementation,
    Evaluation,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "course_designer_plan_status", rename_all = "snake_case")]
pub enum CourseDesignerPlanStatus {
    Draft,
    Scheduling,
    ReadyToStart,
    InProgress,
    Completed,
    Archived,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(
    type_name = "course_designer_plan_stage_status",
    rename_all = "snake_case"
)]
pub enum CourseDesignerPlanStageStatus {
    NotStarted,
    InProgress,
    Completed,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case")]
pub enum CourseDesignerCourseSize {
    Small,
    Medium,
    Large,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, FromRow)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, FromRow)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, FromRow)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseDesignerPlanMember {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, FromRow)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
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
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, FromRow)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseDesignerPlanStageWithTasks {
    #[serde(flatten)]
    pub stage: CourseDesignerPlanStage,
    pub tasks: Vec<CourseDesignerPlanStageTask>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseDesignerPlanDetails {
    pub plan: CourseDesignerPlan,
    pub members: Vec<CourseDesignerPlanMember>,
    pub stages: Vec<CourseDesignerPlanStageWithTasks>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
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

fn add_months_clamped(date: NaiveDate, months: u32) -> ModelResult<NaiveDate> {
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

async fn insert_plan_event(
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

pub async fn list_plans_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<CourseDesignerPlanSummary>> {
    let plans = sqlx::query_as!(
        CourseDesignerPlanSummary,
        r#"
SELECT
  p.id,
  p.created_at,
  p.updated_at,
  p.created_by_user_id,
  p.name,
  p.status AS "status: CourseDesignerPlanStatus",
  p.active_stage AS "active_stage: CourseDesignerStage",
  p.last_weekly_stage_email_sent_at,
  COUNT(DISTINCT members.user_id)::BIGINT AS "member_count!",
  COUNT(DISTINCT stages.stage)::BIGINT AS "stage_count!"
FROM course_designer_plans p
JOIN course_designer_plan_members self_member
  ON self_member.course_designer_plan_id = p.id
  AND self_member.user_id = $1
  AND self_member.deleted_at IS NULL
LEFT JOIN course_designer_plan_members members
  ON members.course_designer_plan_id = p.id
  AND members.deleted_at IS NULL
LEFT JOIN course_designer_plan_stages stages
  ON stages.course_designer_plan_id = p.id
  AND stages.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id
ORDER BY p.updated_at DESC, p.id DESC
"#,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(plans)
}

pub async fn get_plan_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlan> {
    let plan = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
SELECT
  p.id,
  p.created_at,
  p.updated_at,
  p.created_by_user_id,
  p.name,
  p.status AS "status: CourseDesignerPlanStatus",
  p.active_stage AS "active_stage: CourseDesignerStage",
  p.last_weekly_stage_email_sent_at
FROM course_designer_plans p
JOIN course_designer_plan_members m
  ON m.course_designer_plan_id = p.id
  AND m.user_id = $2
  AND m.deleted_at IS NULL
WHERE p.id = $1
  AND p.deleted_at IS NULL
"#,
        plan_id,
        user_id
    )
    .fetch_one(conn)
    .await?;
    Ok(plan)
}

pub async fn get_plan_members_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<CourseDesignerPlanMember>> {
    let members = sqlx::query_as!(
        CourseDesignerPlanMember,
        r#"
SELECT
  members.id,
  members.created_at,
  members.updated_at,
  members.user_id
FROM course_designer_plan_members members
JOIN course_designer_plan_members self_member
  ON self_member.course_designer_plan_id = members.course_designer_plan_id
  AND self_member.user_id = $2
  AND self_member.deleted_at IS NULL
WHERE members.course_designer_plan_id = $1
  AND members.deleted_at IS NULL
ORDER BY members.created_at ASC, members.id ASC
"#,
        plan_id,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(members)
}

pub async fn get_plan_stages_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<CourseDesignerPlanStage>> {
    let stages = sqlx::query_as!(
        CourseDesignerPlanStage,
        r#"
SELECT
  stages.id,
  stages.created_at,
  stages.updated_at,
  stages.stage AS "stage: CourseDesignerStage",
  stages.status AS "status: CourseDesignerPlanStageStatus",
  stages.planned_starts_on,
  stages.planned_ends_on,
  stages.actual_started_at,
  stages.actual_completed_at
FROM course_designer_plan_stages stages
JOIN course_designer_plan_members self_member
  ON self_member.course_designer_plan_id = stages.course_designer_plan_id
  AND self_member.user_id = $2
  AND self_member.deleted_at IS NULL
WHERE stages.course_designer_plan_id = $1
  AND stages.deleted_at IS NULL
ORDER BY
  CASE stages.stage
    WHEN 'analysis' THEN 1
    WHEN 'design' THEN 2
    WHEN 'development' THEN 3
    WHEN 'implementation' THEN 4
    WHEN 'evaluation' THEN 5
  END,
  stages.id
"#,
        plan_id,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(stages)
}

pub async fn get_plan_tasks_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<CourseDesignerPlanStageTask>> {
    let tasks = sqlx::query_as!(
        CourseDesignerPlanStageTask,
        r#"
SELECT
  t.id,
  t.created_at,
  t.updated_at,
  t.course_designer_plan_stage_id,
  t.title,
  t.description,
  t.order_number,
  t.is_completed,
  t.completed_at,
  t.completed_by_user_id,
  t.is_auto_generated,
  t.created_by_user_id
FROM course_designer_plan_stage_tasks t
JOIN course_designer_plan_stages s ON s.id = t.course_designer_plan_stage_id AND s.deleted_at IS NULL
JOIN course_designer_plan_members m ON m.course_designer_plan_id = s.course_designer_plan_id
  AND m.user_id = $2
  AND m.deleted_at IS NULL
WHERE s.course_designer_plan_id = $1
  AND t.deleted_at IS NULL
ORDER BY s.id, t.order_number, t.id
"#,
        plan_id,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(tasks)
}

pub async fn get_plan_details_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlanDetails> {
    let plan = get_plan_for_user(conn, plan_id, user_id).await?;
    let members = get_plan_members_for_user(conn, plan_id, user_id).await?;
    let stages = get_plan_stages_for_user(conn, plan_id, user_id).await?;
    let tasks = get_plan_tasks_for_user(conn, plan_id, user_id).await?;
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

pub async fn replace_schedule_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
    name: Option<String>,
    stages: &[CourseDesignerScheduleStageInput],
) -> ModelResult<CourseDesignerPlanDetails> {
    let mut tx = conn.begin().await?;

    let locked_plan: CourseDesignerPlan = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
SELECT
  p.id,
  p.created_at,
  p.updated_at,
  p.created_by_user_id,
  p.name,
  p.status AS "status: CourseDesignerPlanStatus",
  p.active_stage AS "active_stage: CourseDesignerStage",
  p.last_weekly_stage_email_sent_at
FROM course_designer_plans p
JOIN course_designer_plan_members m
  ON m.course_designer_plan_id = p.id
  AND m.user_id = $2
  AND m.deleted_at IS NULL
WHERE p.id = $1
  AND p.deleted_at IS NULL
FOR UPDATE
"#,
        plan_id,
        user_id
    )
    .fetch_one(&mut *tx)
    .await?;

    if matches!(
        locked_plan.status,
        CourseDesignerPlanStatus::InProgress
            | CourseDesignerPlanStatus::Completed
            | CourseDesignerPlanStatus::Archived
    ) {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Cannot edit schedule for a plan that has already started or is closed.".to_string(),
            None,
        ));
    }

    let existing_stage_count: i64 = sqlx::query_scalar!(
        r#"
SELECT COUNT(*)::BIGINT AS "count!"
FROM course_designer_plan_stages
WHERE course_designer_plan_id = $1
  AND deleted_at IS NULL
"#,
        plan_id
    )
    .fetch_one(&mut *tx)
    .await?;

    // Keep finalized plans finalized when the schedule is re-saved (including no-op saves).
    let updated_status = if matches!(locked_plan.status, CourseDesignerPlanStatus::ReadyToStart) {
        locked_plan.status
    } else {
        CourseDesignerPlanStatus::Scheduling
    };

    let updated_plan: CourseDesignerPlan = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
UPDATE course_designer_plans
SET
  name = $2,
  status = $3
WHERE id = $1
  AND deleted_at IS NULL
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
        plan_id,
        name,
        updated_status as CourseDesignerPlanStatus
    )
    .fetch_one(&mut *tx)
    .await?;

    for stage in stages {
        sqlx::query!(
            r#"
INSERT INTO course_designer_plan_stages (
  course_designer_plan_id,
  stage,
  planned_starts_on,
  planned_ends_on
)
VALUES ($1, $2, $3, $4)
ON CONFLICT ON CONSTRAINT course_designer_plan_stages_plan_stage_unique DO UPDATE
SET
  planned_starts_on = EXCLUDED.planned_starts_on,
  planned_ends_on = EXCLUDED.planned_ends_on
"#,
            plan_id,
            stage.stage as CourseDesignerStage,
            stage.planned_starts_on,
            stage.planned_ends_on
        )
        .execute(&mut *tx)
        .await?;
    }

    let event_type = if existing_stage_count == 0 {
        "schedule_created"
    } else {
        "schedule_updated"
    };
    insert_plan_event(
        &mut tx,
        plan_id,
        Some(user_id),
        event_type,
        None,
        json!({
            "name": updated_plan.name,
            "stages": stages,
        }),
    )
    .await?;

    tx.commit().await?;

    get_plan_details_for_user(conn, plan_id, user_id).await
}

pub async fn create_stage_task_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    stage_id: Uuid,
    user_id: Uuid,
    title: String,
    description: Option<String>,
) -> ModelResult<CourseDesignerPlanStageTask> {
    let title = title.trim();
    if title.is_empty() {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "Task title cannot be empty.".to_string(),
            None,
        ));
    }
    let stage_ok = sqlx::query_scalar!(
        r#"
SELECT s.id AS "id?"
FROM course_designer_plan_stages s
JOIN course_designer_plan_members m ON m.course_designer_plan_id = s.course_designer_plan_id
  AND m.user_id = $2 AND m.deleted_at IS NULL
WHERE s.id = $3 AND s.course_designer_plan_id = $1 AND s.deleted_at IS NULL
"#,
        plan_id,
        user_id,
        stage_id
    )
    .fetch_optional(&mut *conn)
    .await?
    .flatten();
    if stage_ok.is_none() {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Stage not found or user is not a plan member.".to_string(),
            None,
        ));
    }
    let max_order: Option<i32> = sqlx::query_scalar!(
        r#"
SELECT MAX(order_number)::INTEGER
FROM course_designer_plan_stage_tasks
WHERE course_designer_plan_stage_id = $1 AND deleted_at IS NULL
"#,
        stage_id
    )
    .fetch_one(&mut *conn)
    .await?;
    let order_number = max_order.unwrap_or(0) + 1;
    let task: CourseDesignerPlanStageTask = sqlx::query_as!(
        CourseDesignerPlanStageTask,
        r#"
INSERT INTO course_designer_plan_stage_tasks (
  course_designer_plan_stage_id,
  title,
  description,
  order_number,
  is_auto_generated,
  created_by_user_id
)
VALUES ($1, $2, $3, $4, FALSE, $5)
RETURNING
  id,
  created_at,
  updated_at,
  course_designer_plan_stage_id,
  title,
  description,
  order_number,
  is_completed,
  completed_at,
  completed_by_user_id,
  is_auto_generated,
  created_by_user_id
"#,
        stage_id,
        title,
        description,
        order_number,
        user_id
    )
    .fetch_one(&mut *conn)
    .await?;
    Ok(task)
}

pub async fn update_stage_task_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    task_id: Uuid,
    user_id: Uuid,
    title: Option<String>,
    description: Option<String>,
    is_completed: Option<bool>,
) -> ModelResult<CourseDesignerPlanStageTask> {
    let row = sqlx::query(
        r#"
SELECT t.title, t.description, t.is_completed
FROM course_designer_plan_stage_tasks t
JOIN course_designer_plan_stages s ON s.id = t.course_designer_plan_stage_id AND s.deleted_at IS NULL
JOIN course_designer_plan_members m ON m.course_designer_plan_id = s.course_designer_plan_id
  AND m.user_id = $2 AND m.deleted_at IS NULL
WHERE t.id = $3 AND s.course_designer_plan_id = $1 AND t.deleted_at IS NULL
"#,
    )
    .bind(plan_id)
    .bind(user_id)
    .bind(task_id)
    .fetch_optional(&mut *conn)
    .await?;
    let (current_title, current_description, current_completed) = match row {
        Some(r) => (
            r.get::<String, _>("title"),
            r.get::<Option<String>, _>("description"),
            r.get::<bool, _>("is_completed"),
        ),
        None => {
            return Err(ModelError::new(
                ModelErrorType::PreconditionFailed,
                "Task not found or user is not a plan member.".to_string(),
                None,
            ));
        }
    };
    let new_title = title.map(|t| t.trim().to_string()).unwrap_or(current_title);
    if new_title.is_empty() {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "Task title cannot be empty.".to_string(),
            None,
        ));
    }
    let new_description = description.or(current_description);
    let new_completed = is_completed.unwrap_or(current_completed);
    let now = Utc::now();
    let completed_at = if new_completed { Some(now) } else { None };
    let completed_by = if new_completed { Some(user_id) } else { None };
    let task: CourseDesignerPlanStageTask = sqlx::query_as!(
        CourseDesignerPlanStageTask,
        r#"
UPDATE course_designer_plan_stage_tasks t
SET
  title = $2,
  description = $3,
  is_completed = $4,
  completed_at = $5,
  completed_by_user_id = $6
FROM course_designer_plan_stages s
JOIN course_designer_plan_members m ON m.course_designer_plan_id = s.course_designer_plan_id
  AND m.user_id = $7 AND m.deleted_at IS NULL
WHERE t.course_designer_plan_stage_id = s.id AND s.course_designer_plan_id = $1
  AND t.id = $8 AND t.deleted_at IS NULL
RETURNING
  t.id,
  t.created_at,
  t.updated_at,
  t.course_designer_plan_stage_id,
  t.title,
  t.description,
  t.order_number,
  t.is_completed,
  t.completed_at,
  t.completed_by_user_id,
  t.is_auto_generated,
  t.created_by_user_id
"#,
        plan_id,
        new_title,
        new_description,
        new_completed,
        completed_at,
        completed_by,
        user_id,
        task_id
    )
    .fetch_one(&mut *conn)
    .await
    .map_err(|e| {
        if let sqlx::Error::RowNotFound = e {
            ModelError::new(
                ModelErrorType::PreconditionFailed,
                "Task not found or user is not a plan member.".to_string(),
                None,
            )
        } else {
            e.into()
        }
    })?;
    Ok(task)
}

pub async fn delete_stage_task_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    task_id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    let updated = sqlx::query!(
        r#"
UPDATE course_designer_plan_stage_tasks t
SET deleted_at = $4
FROM course_designer_plan_stages s
JOIN course_designer_plan_members m ON m.course_designer_plan_id = s.course_designer_plan_id
  AND m.user_id = $2 AND m.deleted_at IS NULL
WHERE t.course_designer_plan_stage_id = s.id AND s.course_designer_plan_id = $1
  AND t.id = $3 AND t.deleted_at IS NULL
"#,
        plan_id,
        user_id,
        task_id,
        Utc::now()
    )
    .execute(conn)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Task not found or user is not a plan member.".to_string(),
            None,
        ));
    }
    Ok(())
}

pub async fn start_plan_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlan> {
    let mut tx = conn.begin().await?;
    let plan: CourseDesignerPlan = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
SELECT
  p.id,
  p.created_at,
  p.updated_at,
  p.created_by_user_id,
  p.name,
  p.status AS "status: CourseDesignerPlanStatus",
  p.active_stage AS "active_stage: CourseDesignerStage",
  p.last_weekly_stage_email_sent_at
FROM course_designer_plans p
JOIN course_designer_plan_members m ON m.course_designer_plan_id = p.id
  AND m.user_id = $2 AND m.deleted_at IS NULL
WHERE p.id = $1 AND p.deleted_at IS NULL
FOR UPDATE
"#,
        plan_id,
        user_id
    )
    .fetch_one(&mut *tx)
    .await?;
    if plan.status != CourseDesignerPlanStatus::ReadyToStart {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Plan can only be started when status is ready_to_start.".to_string(),
            None,
        ));
    }
    let first_stage = CourseDesignerStage::Analysis;
    let now = Utc::now();
    sqlx::query!(
        r#"
UPDATE course_designer_plans
SET status = $2, active_stage = $3
WHERE id = $1 AND deleted_at IS NULL
"#,
        plan_id,
        CourseDesignerPlanStatus::InProgress as CourseDesignerPlanStatus,
        first_stage as CourseDesignerStage
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        r#"
UPDATE course_designer_plan_stages
SET status = $2, actual_started_at = $3
WHERE course_designer_plan_id = $1 AND stage = $4 AND deleted_at IS NULL
"#,
        plan_id,
        CourseDesignerPlanStageStatus::InProgress as CourseDesignerPlanStageStatus,
        now,
        first_stage as CourseDesignerStage
    )
    .execute(&mut *tx)
    .await?;
    insert_plan_event(
        &mut tx,
        plan_id,
        Some(user_id),
        "plan_started",
        Some(first_stage),
        json!({}),
    )
    .await?;
    tx.commit().await?;
    get_plan_for_user(conn, plan_id, user_id).await
}

pub async fn extend_stage_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    stage: CourseDesignerStage,
    months: u32,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlanDetails> {
    if months == 0 {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "Months must be at least 1.".to_string(),
            None,
        ));
    }
    let mut tx = conn.begin().await?;
    let plan: CourseDesignerPlan = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
SELECT
  p.id,
  p.created_at,
  p.updated_at,
  p.created_by_user_id,
  p.name,
  p.status AS "status: CourseDesignerPlanStatus",
  p.active_stage AS "active_stage: CourseDesignerStage",
  p.last_weekly_stage_email_sent_at
FROM course_designer_plans p
JOIN course_designer_plan_members m ON m.course_designer_plan_id = p.id
  AND m.user_id = $2 AND m.deleted_at IS NULL
WHERE p.id = $1 AND p.deleted_at IS NULL
FOR UPDATE
"#,
        plan_id,
        user_id
    )
    .fetch_one(&mut *tx)
    .await?;
    if plan.status != CourseDesignerPlanStatus::InProgress {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Can only extend a stage when plan is in progress.".to_string(),
            None,
        ));
    }
    if plan.active_stage != Some(stage) {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Can only extend the current active stage.".to_string(),
            None,
        ));
    }
    let stage_row: CourseDesignerPlanStage = sqlx::query_as!(
        CourseDesignerPlanStage,
        r#"
SELECT id, created_at, updated_at,
  stage AS "stage: CourseDesignerStage",
  status AS "status: CourseDesignerPlanStageStatus",
  planned_starts_on,
  planned_ends_on,
  actual_started_at,
  actual_completed_at
FROM course_designer_plan_stages
WHERE course_designer_plan_id = $1 AND stage = $2 AND deleted_at IS NULL
"#,
        plan_id,
        stage as CourseDesignerStage
    )
    .fetch_one(&mut *tx)
    .await?;
    let new_ends_on = add_months_clamped(stage_row.planned_ends_on, months)?;
    sqlx::query!(
        r#"
UPDATE course_designer_plan_stages
SET planned_ends_on = $2
WHERE id = $1 AND deleted_at IS NULL
"#,
        stage_row.id,
        new_ends_on
    )
    .execute(&mut *tx)
    .await?;
    let stage_order = fixed_stage_order();
    let current_idx = stage_order
        .iter()
        .position(|s| *s == stage)
        .ok_or_else(|| {
            ModelError::new(ModelErrorType::Generic, "Invalid stage.".to_string(), None)
        })?;
    let all_stages: Vec<CourseDesignerPlanStage> = sqlx::query_as!(
        CourseDesignerPlanStage,
        r#"
SELECT id, created_at, updated_at,
  stage AS "stage: CourseDesignerStage",
  status AS "status: CourseDesignerPlanStageStatus",
  planned_starts_on,
  planned_ends_on,
  actual_started_at,
  actual_completed_at
FROM course_designer_plan_stages
WHERE course_designer_plan_id = $1 AND deleted_at IS NULL
ORDER BY CASE stage WHEN 'analysis' THEN 1 WHEN 'design' THEN 2 WHEN 'development' THEN 3 WHEN 'implementation' THEN 4 WHEN 'evaluation' THEN 5 END
"#,
        plan_id
    )
    .fetch_all(&mut *tx)
    .await?;
    let later_stage_rows: Vec<_> = all_stages
        .into_iter()
        .enumerate()
        .filter(|(i, _)| *i > current_idx)
        .map(|(_, s)| (s.id, s.planned_starts_on, s.planned_ends_on))
        .collect();
    let mut prev_end = new_ends_on;
    for (st_id, old_start, old_end) in later_stage_rows {
        let new_start = prev_end + Duration::days(1);
        let duration_days = (old_end - old_start).num_days();
        let new_ends = new_start + Duration::days(duration_days);
        sqlx::query!(
            r#"
UPDATE course_designer_plan_stages
SET planned_starts_on = $2, planned_ends_on = $3
WHERE id = $1 AND deleted_at IS NULL
"#,
            st_id,
            new_start,
            new_ends
        )
        .execute(&mut *tx)
        .await?;
        prev_end = new_ends;
    }
    insert_plan_event(
        &mut tx,
        plan_id,
        Some(user_id),
        "stage_extended",
        Some(stage),
        json!({ "stage_id": stage_row.id, "months": months, "new_ends_on": new_ends_on }),
    )
    .await?;
    tx.commit().await?;
    get_plan_details_for_user(conn, plan_id, user_id).await
}

pub async fn advance_to_next_stage_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlanDetails> {
    let mut tx = conn.begin().await?;
    let plan: CourseDesignerPlan = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
SELECT
  p.id,
  p.created_at,
  p.updated_at,
  p.created_by_user_id,
  p.name,
  p.status AS "status: CourseDesignerPlanStatus",
  p.active_stage AS "active_stage: CourseDesignerStage",
  p.last_weekly_stage_email_sent_at
FROM course_designer_plans p
JOIN course_designer_plan_members m ON m.course_designer_plan_id = p.id
  AND m.user_id = $2 AND m.deleted_at IS NULL
WHERE p.id = $1 AND p.deleted_at IS NULL
FOR UPDATE
"#,
        plan_id,
        user_id
    )
    .fetch_one(&mut *tx)
    .await?;
    if plan.status != CourseDesignerPlanStatus::InProgress {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Plan must be in progress to advance.".to_string(),
            None,
        ));
    }
    let current_stage = plan.active_stage.ok_or_else(|| {
        ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Plan has no active stage.".to_string(),
            None,
        )
    })?;
    let now = Utc::now();
    sqlx::query!(
        r#"
UPDATE course_designer_plan_stages
SET status = $2, actual_completed_at = $3
WHERE course_designer_plan_id = $1 AND stage = $4 AND deleted_at IS NULL
"#,
        plan_id,
        CourseDesignerPlanStageStatus::Completed as CourseDesignerPlanStageStatus,
        now,
        current_stage as CourseDesignerStage
    )
    .execute(&mut *tx)
    .await?;
    insert_plan_event(
        &mut tx,
        plan_id,
        Some(user_id),
        "stage_completed",
        Some(current_stage),
        json!({}),
    )
    .await?;
    let stage_order = fixed_stage_order();
    let current_idx = stage_order
        .iter()
        .position(|s| *s == current_stage)
        .ok_or_else(|| {
            ModelError::new(ModelErrorType::Generic, "Invalid stage.".to_string(), None)
        })?;
    let next_stage = if current_idx + 1 < stage_order.len() {
        Some(stage_order[current_idx + 1])
    } else {
        None
    };
    match next_stage {
        Some(next) => {
            sqlx::query!(
                r#"
UPDATE course_designer_plans
SET active_stage = $2
WHERE id = $1 AND deleted_at IS NULL
"#,
                plan_id,
                next as CourseDesignerStage
            )
            .execute(&mut *tx)
            .await?;
            sqlx::query!(
                r#"
UPDATE course_designer_plan_stages
SET status = $2, actual_started_at = $3
WHERE course_designer_plan_id = $1 AND stage = $4 AND deleted_at IS NULL
"#,
                plan_id,
                CourseDesignerPlanStageStatus::InProgress as CourseDesignerPlanStageStatus,
                now,
                next as CourseDesignerStage
            )
            .execute(&mut *tx)
            .await?;
            insert_plan_event(
                &mut tx,
                plan_id,
                Some(user_id),
                "stage_started",
                Some(next),
                json!({}),
            )
            .await?;
        }
        None => {
            sqlx::query!(
                r#"
UPDATE course_designer_plans
SET status = $2, active_stage = NULL
WHERE id = $1 AND deleted_at IS NULL
"#,
                plan_id,
                CourseDesignerPlanStatus::Completed as CourseDesignerPlanStatus
            )
            .execute(&mut *tx)
            .await?;
            insert_plan_event(
                &mut tx,
                plan_id,
                Some(user_id),
                "plan_completed",
                None,
                json!({}),
            )
            .await?;
        }
    }
    tx.commit().await?;
    get_plan_details_for_user(conn, plan_id, user_id).await
}

pub async fn finalize_schedule_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlan> {
    let mut tx = conn.begin().await?;

    let plan: CourseDesignerPlan = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
SELECT
  p.id,
  p.created_at,
  p.updated_at,
  p.created_by_user_id,
  p.name,
  p.status AS "status: CourseDesignerPlanStatus",
  p.active_stage AS "active_stage: CourseDesignerStage",
  p.last_weekly_stage_email_sent_at
FROM course_designer_plans p
JOIN course_designer_plan_members m
  ON m.course_designer_plan_id = p.id
  AND m.user_id = $2
  AND m.deleted_at IS NULL
WHERE p.id = $1
  AND p.deleted_at IS NULL
FOR UPDATE
"#,
        plan_id,
        user_id
    )
    .fetch_one(&mut *tx)
    .await?;

    if matches!(
        plan.status,
        CourseDesignerPlanStatus::InProgress
            | CourseDesignerPlanStatus::Completed
            | CourseDesignerPlanStatus::Archived
    ) {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Cannot finalize schedule for a plan that has already started or is closed."
                .to_string(),
            None,
        ));
    }

    let active_stage_count: i64 = sqlx::query_scalar!(
        r#"
SELECT COUNT(*)::BIGINT AS "count!"
FROM course_designer_plan_stages
WHERE course_designer_plan_id = $1
  AND deleted_at IS NULL
"#,
        plan_id
    )
    .fetch_one(&mut *tx)
    .await?;
    if active_stage_count != 5 {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Schedule must contain all 5 stages before finalizing.".to_string(),
            None,
        ));
    }

    let finalized_plan: CourseDesignerPlan = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
UPDATE course_designer_plans
SET status = $2
WHERE id = $1
  AND deleted_at IS NULL
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
        plan_id,
        CourseDesignerPlanStatus::ReadyToStart as CourseDesignerPlanStatus
    )
    .fetch_one(&mut *tx)
    .await?;

    let schedule_snapshot = sqlx::query_as!(
        CourseDesignerPlanStage,
        r#"
SELECT
  id,
  created_at,
  updated_at,
  stage AS "stage: CourseDesignerStage",
  status AS "status: CourseDesignerPlanStageStatus",
  planned_starts_on,
  planned_ends_on,
  actual_started_at,
  actual_completed_at
FROM course_designer_plan_stages
WHERE course_designer_plan_id = $1
  AND deleted_at IS NULL
ORDER BY
  CASE stage
    WHEN 'analysis' THEN 1
    WHEN 'design' THEN 2
    WHEN 'development' THEN 3
    WHEN 'implementation' THEN 4
    WHEN 'evaluation' THEN 5
  END,
  id
"#,
        plan_id
    )
    .fetch_all(&mut *tx)
    .await?;

    insert_plan_event(
        &mut tx,
        plan_id,
        Some(user_id),
        "schedule_finalized",
        None,
        json!({ "stages": schedule_snapshot }),
    )
    .await?;

    tx.commit().await?;
    Ok(finalized_plan)
}

pub fn no_gap_between(previous_end: NaiveDate, next_start: NaiveDate) -> bool {
    previous_end + Duration::days(1) == next_start
}
