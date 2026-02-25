use crate::prelude::*;
use chrono::{Datelike, Duration, NaiveDate};
use serde_json::{Value, json};

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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseDesignerPlanDetails {
    pub plan: CourseDesignerPlan,
    pub members: Vec<CourseDesignerPlanMember>,
    pub stages: Vec<CourseDesignerPlanStage>,
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

pub async fn get_plan_details_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlanDetails> {
    let plan = get_plan_for_user(conn, plan_id, user_id).await?;
    let members = get_plan_members_for_user(conn, plan_id, user_id).await?;
    let stages = get_plan_stages_for_user(conn, plan_id, user_id).await?;
    Ok(CourseDesignerPlanDetails {
        plan,
        members,
        stages,
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

    let members = sqlx::query_as!(
        CourseDesignerPlanMember,
        r#"
SELECT id, created_at, updated_at, user_id
FROM course_designer_plan_members
WHERE course_designer_plan_id = $1
  AND deleted_at IS NULL
ORDER BY created_at ASC, id ASC
"#,
        plan_id
    )
    .fetch_all(&mut *tx)
    .await?;

    let saved_stages = sqlx::query_as!(
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

    tx.commit().await?;

    Ok(CourseDesignerPlanDetails {
        plan: updated_plan,
        members,
        stages: saved_stages,
    })
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
