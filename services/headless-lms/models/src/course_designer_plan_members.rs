use crate::course_designer_plans::{
    CourseDesignerPlan, CourseDesignerPlanDetails, CourseDesignerPlanMember,
    CourseDesignerPlanStage, CourseDesignerPlanStageStatus, CourseDesignerPlanStageTask,
    CourseDesignerPlanStatus, CourseDesignerPlanSummary, CourseDesignerScheduleStageInput,
    CourseDesignerStage, PlanMemberWithDetails,
};
use crate::course_designer_plans::{MAX_EXTEND_MONTHS, validate_schedule_input};
use crate::prelude::*;
use chrono::{Duration, NaiveDate};
use serde_json::json;

/// Lists plans visible to a member.
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
  p.status,
  p.active_stage,
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

/// Loads a single plan if user is a member.
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
  p.deleted_at,
  p.created_by_user_id,
  p.name,
  p.status,
  p.active_stage,
  p.last_weekly_stage_email_sent_at,
  p.great_mooc_vision,
  p.created_course_id
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

/// Returns active members of a plan for member user.
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
  members.user_id,
  members.receives_weekly_digest
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

/// Returns stages of a plan for member user.
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
  stages.stage,
  stages.status,
  stages.planned_starts_on,
  stages.planned_ends_on,
  stages.actual_started_at,
  stages.actual_completed_at,
  stages.workspace_data,
  stages.workspace_revision
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

/// Returns tasks of a plan for member user.
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
  t.created_by_user_id,
  t.assignee_user_id
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

/// Creates a task after membership validation.
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
        return Err(model_err!(
            InvalidRequest,
            "Task title cannot be empty.".to_string()
        ));
    }
    let mut tx = conn.begin().await?;
    lock_editable_plan_for_user(&mut tx, plan_id, user_id).await?;
    let stage_ok = sqlx::query_scalar!(
        r#"
SELECT s.id AS "id?"
FROM course_designer_plan_stages s
JOIN course_designer_plan_members m ON m.course_designer_plan_id = s.course_designer_plan_id
  AND m.user_id = $2 AND m.deleted_at IS NULL
WHERE s.id = $3 AND s.course_designer_plan_id = $1 AND s.deleted_at IS NULL
FOR UPDATE
"#,
        plan_id,
        user_id,
        stage_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .flatten();
    if stage_ok.is_none() {
        tx.rollback().await?;
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
    .fetch_one(&mut *tx)
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
  created_by_user_id,
  assignee_user_id
"#,
        stage_id,
        title,
        description,
        order_number,
        user_id
    )
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(task)
}

/// Updates a task after membership validation. `None` leaves a field unchanged; a blank
/// `description` clears it.
pub async fn update_stage_task_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    task_id: Uuid,
    user_id: Uuid,
    title: Option<String>,
    description: Option<String>,
    is_completed: Option<bool>,
) -> ModelResult<CourseDesignerPlanStageTask> {
    let mut tx = conn.begin().await?;
    lock_editable_plan_for_user(&mut tx, plan_id, user_id).await?;
    let row = sqlx::query!(
        r#"
SELECT
  t.title,
  t.description,
  t.is_completed,
  t.completed_at,
  t.completed_by_user_id,
  s.stage AS "stage: CourseDesignerStage"
FROM course_designer_plan_stage_tasks t
JOIN course_designer_plan_stages s ON s.id = t.course_designer_plan_stage_id AND s.deleted_at IS NULL
JOIN course_designer_plan_members m ON m.course_designer_plan_id = s.course_designer_plan_id
  AND m.user_id = $2 AND m.deleted_at IS NULL
WHERE t.id = $3 AND s.course_designer_plan_id = $1 AND t.deleted_at IS NULL
FOR UPDATE OF t
"#,
        plan_id,
        user_id,
        task_id
    )
    .fetch_optional(&mut *tx)
    .await?;
    let (
        current_title,
        current_description,
        current_completed,
        current_completed_at,
        current_completed_by_user_id,
        stage,
    ) = match row {
        Some(r) => (
            r.title,
            r.description,
            r.is_completed,
            r.completed_at,
            r.completed_by_user_id,
            r.stage,
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
    let new_description = match description {
        Some(d) if d.trim().is_empty() => None,
        Some(d) => Some(d),
        None => current_description,
    };
    let new_completed = is_completed.unwrap_or(current_completed);
    let (completed_at, completed_by) = match is_completed {
        Some(_) if !current_completed && new_completed => {
            let now = Utc::now();
            (Some(now), Some(user_id))
        }
        Some(_) if current_completed && !new_completed => (None, None),
        _ => (current_completed_at, current_completed_by_user_id),
    };
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
  t.created_by_user_id,
  t.assignee_user_id
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
    .fetch_one(&mut *tx)
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
    if new_completed != current_completed {
        crate::course_designer_plans::insert_plan_event(
            &mut tx,
            plan_id,
            Some(user_id),
            if new_completed {
                "task_completed"
            } else {
                "task_reopened"
            },
            Some(stage),
            json!({ "task_id": task.id, "title": task.title }),
        )
        .await?;
    }
    tx.commit().await?;
    Ok(task)
}

/// Assigns a task to a plan member, or unassigns it with `None`.
pub async fn set_task_assignee_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    task_id: Uuid,
    user_id: Uuid,
    assignee_user_id: Option<Uuid>,
) -> ModelResult<CourseDesignerPlanStageTask> {
    let mut tx = conn.begin().await?;
    lock_editable_plan_for_user(&mut tx, plan_id, user_id).await?;
    if let Some(assignee_user_id) = assignee_user_id {
        let is_member = sqlx::query_scalar!(
            r#"
SELECT EXISTS (
  SELECT 1
  FROM course_designer_plan_members
  WHERE course_designer_plan_id = $1
    AND user_id = $2
    AND deleted_at IS NULL
) AS "is_member!"
"#,
            plan_id,
            assignee_user_id
        )
        .fetch_one(&mut *tx)
        .await?;
        if !is_member {
            return Err(ModelError::new(
                ModelErrorType::InvalidRequest,
                "Tasks can only be assigned to plan members.".to_string(),
                None,
            ));
        }
    }
    let task = sqlx::query_as!(
        CourseDesignerPlanStageTask,
        r#"
UPDATE course_designer_plan_stage_tasks t
SET assignee_user_id = $4
FROM course_designer_plan_stages s
JOIN course_designer_plan_members m ON m.course_designer_plan_id = s.course_designer_plan_id
  AND m.user_id = $2 AND m.deleted_at IS NULL
WHERE t.course_designer_plan_stage_id = s.id AND s.course_designer_plan_id = $1
  AND s.deleted_at IS NULL
  AND t.id = $3 AND t.deleted_at IS NULL
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
  t.created_by_user_id,
  t.assignee_user_id
"#,
        plan_id,
        user_id,
        task_id,
        assignee_user_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Task not found or user is not a plan member.".to_string(),
            None,
        )
    })?;
    tx.commit().await?;
    Ok(task)
}

/// Soft-deletes a task after membership validation.
pub async fn delete_stage_task_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    task_id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    lock_editable_plan_for_user(&mut tx, plan_id, user_id).await?;
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
    .execute(&mut *tx)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Task not found or user is not a plan member.".to_string(),
            None,
        ));
    }
    tx.commit().await?;
    Ok(())
}

/// Locks and returns plan for extending stage.
pub async fn get_plan_for_stage_extend(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
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
  p.deleted_at,
  p.created_by_user_id,
  p.name,
  p.status,
  p.active_stage,
  p.last_weekly_stage_email_sent_at,
  p.great_mooc_vision,
  p.created_course_id
FROM course_designer_plans p
JOIN course_designer_plan_members m ON m.course_designer_plan_id = p.id
  AND m.user_id = $2 AND m.deleted_at IS NULL
WHERE p.id = $1 AND p.deleted_at IS NULL
FOR UPDATE
"#,
        plan_id,
        user_id
    )
    .fetch_one(&mut **tx)
    .await?;
    Ok(plan)
}

/// Locks and returns plan for stage advance.
pub async fn get_plan_for_stage_advance(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlan> {
    get_plan_for_stage_extend(tx, plan_id, user_id).await
}

/// Locks and returns plan for finalize.
pub async fn get_plan_for_schedule_finalize(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlan> {
    get_plan_for_stage_extend(tx, plan_id, user_id).await
}

/// Locks a plan the user is a member of before changing its content, refusing archived plans.
///
/// The lock is held until `tx` ends, so a concurrent archive or member removal waits for it.
pub async fn lock_editable_plan_for_user(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlan> {
    let plan = get_plan_for_stage_extend(tx, plan_id, user_id).await?;
    if plan.status == CourseDesignerPlanStatus::Archived {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "The plan is archived. Restore it before making changes.".to_string(),
            None,
        ));
    }
    Ok(plan)
}

/// Returns all members with user details.
pub async fn get_plan_members_with_details(
    conn: &mut PgConnection,
    plan_id: Uuid,
    requesting_user_id: Uuid,
) -> ModelResult<Vec<PlanMemberWithDetails>> {
    get_plan_for_user(conn, plan_id, requesting_user_id).await?;

    let members = sqlx::query_as!(
        PlanMemberWithDetails,
        r#"
SELECT
  m.id,
  m.user_id,
  ud.first_name,
  ud.last_name,
  ud.email,
  m.created_at,
  m.receives_weekly_digest
FROM course_designer_plan_members m
JOIN user_details ud ON ud.user_id = m.user_id
WHERE m.course_designer_plan_id = $1
  AND m.deleted_at IS NULL
ORDER BY m.created_at ASC, m.id ASC
"#,
        plan_id
    )
    .fetch_all(conn)
    .await?;
    Ok(members)
}

/// Adds a member to a plan by email.
pub async fn add_plan_member_by_email(
    conn: &mut PgConnection,
    plan_id: Uuid,
    requesting_user_id: Uuid,
    email: &str,
) -> ModelResult<PlanMemberWithDetails> {
    let target_user_id: Uuid = sqlx::query_scalar!(
        r#"
SELECT users.id
FROM user_details ud
JOIN users ON users.id = ud.user_id
WHERE lower(ud.email) = lower($1)
  AND users.deleted_at IS NULL
"#,
        email
    )
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| {
        ModelError::new(
            ModelErrorType::InvalidRequest,
            "No user found with that email address.".to_string(),
            None,
        )
    })?;

    let restored = sqlx::query_scalar!(
        r#"
UPDATE course_designer_plan_members
SET deleted_at = NULL, updated_at = NOW()
WHERE id = (
  SELECT id
  FROM course_designer_plan_members
  WHERE course_designer_plan_id = $1
    AND user_id = $2
    AND deleted_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM course_designer_plan_members requester
      WHERE requester.course_designer_plan_id = $1
        AND requester.user_id = $3
        AND requester.deleted_at IS NULL
    )
  ORDER BY deleted_at DESC
  LIMIT 1
)
RETURNING id
"#,
        plan_id,
        target_user_id,
        requesting_user_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    if restored.is_none() {
        let inserted = sqlx::query!(
            r#"
INSERT INTO course_designer_plan_members (course_designer_plan_id, user_id)
SELECT $1, $2
WHERE EXISTS (
  SELECT 1
  FROM course_designer_plan_members requester
  WHERE requester.course_designer_plan_id = $1
    AND requester.user_id = $3
    AND requester.deleted_at IS NULL
)
ON CONFLICT DO NOTHING
"#,
            plan_id,
            target_user_id,
            requesting_user_id
        )
        .execute(&mut *conn)
        .await?;
        if inserted.rows_affected() == 0 {
            return Err(ModelError::new(
                ModelErrorType::PreconditionFailed,
                "Plan not found, requester is not a plan member, or member already exists."
                    .to_string(),
                None,
            ));
        }
    }

    let member = sqlx::query_as!(
        PlanMemberWithDetails,
        r#"
SELECT
  m.id,
  m.user_id,
  ud.first_name,
  ud.last_name,
  ud.email,
  m.created_at,
  m.receives_weekly_digest
FROM course_designer_plan_members m
JOIN user_details ud ON ud.user_id = m.user_id
WHERE m.course_designer_plan_id = $1
  AND m.user_id = $2
  AND m.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM course_designer_plan_members requester
    WHERE requester.course_designer_plan_id = $1
      AND requester.user_id = $3
      AND requester.deleted_at IS NULL
  )
"#,
        plan_id,
        target_user_id,
        requesting_user_id
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(member)
}

/// Removes a member from a plan and unassigns their tasks.
///
/// Refuses to remove the last member, and only the creator may remove the creator.
pub async fn remove_plan_member(
    conn: &mut PgConnection,
    plan_id: Uuid,
    requesting_user_id: Uuid,
    target_user_id: Uuid,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    let plan = get_plan_for_stage_extend(&mut tx, plan_id, requesting_user_id).await?;
    if plan.created_by_user_id == target_user_id && requesting_user_id != target_user_id {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Only the plan creator can remove themselves from the plan.".to_string(),
            None,
        ));
    }
    let member_count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*)::BIGINT AS "count!"
FROM course_designer_plan_members
WHERE course_designer_plan_id = $1
  AND deleted_at IS NULL
"#,
        plan_id
    )
    .fetch_one(&mut *tx)
    .await?;
    if member_count <= 1 {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "A plan must keep at least one member.".to_string(),
            None,
        ));
    }
    let updated = sqlx::query!(
        r#"
UPDATE course_designer_plan_members
SET deleted_at = NOW()
WHERE course_designer_plan_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
"#,
        plan_id,
        target_user_id
    )
    .execute(&mut *tx)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Member not found or user is not a plan member.".to_string(),
            None,
        ));
    }
    sqlx::query!(
        r#"
UPDATE course_designer_plan_stage_tasks t
SET assignee_user_id = NULL
FROM course_designer_plan_stages s
WHERE t.course_designer_plan_stage_id = s.id
  AND s.course_designer_plan_id = $1
  AND t.assignee_user_id = $2
"#,
        plan_id,
        target_user_id
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Turns the weekly progress email of a plan on or off for the requesting member only.
pub async fn set_receives_weekly_digest_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
    receives_weekly_digest: bool,
) -> ModelResult<CourseDesignerPlanMember> {
    let member = sqlx::query_as!(
        CourseDesignerPlanMember,
        r#"
UPDATE course_designer_plan_members
SET receives_weekly_digest = $3
WHERE course_designer_plan_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING id,
  created_at,
  updated_at,
  user_id,
  receives_weekly_digest
"#,
        plan_id,
        user_id,
        receives_weekly_digest
    )
    .fetch_optional(conn)
    .await?
    .ok_or_else(|| {
        ModelError::new(
            ModelErrorType::PreconditionFailed,
            "User is not a plan member.".to_string(),
            None,
        )
    })?;
    Ok(member)
}

/// Replaces plan schedule for a member-owned plan.
pub async fn replace_schedule_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
    name: Option<String>,
    stages: &[CourseDesignerScheduleStageInput],
) -> ModelResult<CourseDesignerPlanDetails> {
    let mut tx = conn.begin().await?;
    let locked_plan = get_plan_for_stage_extend(&mut tx, plan_id, user_id).await?;
    if matches!(
        locked_plan.status,
        CourseDesignerPlanStatus::InProgress
            | CourseDesignerPlanStatus::Completed
            | CourseDesignerPlanStatus::Archived
    ) {
        tx.rollback().await?;
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
    let updated_status = CourseDesignerPlanStatus::Scheduling;
    let updated_plan: CourseDesignerPlan = sqlx::query_as!(
        CourseDesignerPlan,
        r#"
UPDATE course_designer_plans
SET
  name = $2,
  status = $3
WHERE id = $1
  AND deleted_at IS NULL
RETURNING *
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
    crate::course_designer_plans::insert_plan_event(
        &mut tx,
        plan_id,
        Some(user_id),
        event_type,
        None,
        json!({ "name": updated_plan.name, "stages": stages }),
    )
    .await?;
    tx.commit().await?;
    crate::course_designer_plans::get_plan_details_for_user(conn, plan_id, user_id).await
}

/// Loads a plan's stage rows in workflow order.
async fn get_stage_rows(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    plan_id: Uuid,
) -> ModelResult<Vec<CourseDesignerPlanStage>> {
    let rows = sqlx::query_as!(
        CourseDesignerPlanStage,
        r#"
SELECT id, created_at, updated_at,
  stage,
  status,
  planned_starts_on,
  planned_ends_on,
  actual_started_at,
  actual_completed_at,
  workspace_data,
  workspace_revision
FROM course_designer_plan_stages
WHERE course_designer_plan_id = $1 AND deleted_at IS NULL
ORDER BY CASE stage WHEN 'analysis' THEN 1 WHEN 'design' THEN 2 WHEN 'development' THEN 3 WHEN 'implementation' THEN 4 WHEN 'evaluation' THEN 5 END
"#,
        plan_id
    )
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows)
}

/// Moves `stage`'s planned end to `new_ends_on` and shifts every later stage so the schedule stays
/// contiguous, keeping each later stage's length.
async fn move_stage_end_and_shift_later(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    plan_id: Uuid,
    stage: CourseDesignerStage,
    new_ends_on: NaiveDate,
) -> ModelResult<()> {
    let stage_rows = get_stage_rows(tx, plan_id).await?;
    let current_idx = stage_rows
        .iter()
        .position(|s| s.stage == stage)
        .ok_or_else(|| {
            ModelError::new(
                ModelErrorType::PreconditionFailed,
                "Stage not found.".to_string(),
                None,
            )
        })?;
    if new_ends_on < stage_rows[current_idx].planned_starts_on {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "A stage cannot end before it starts.".to_string(),
            None,
        ));
    }
    sqlx::query!(
        r#"
UPDATE course_designer_plan_stages
SET planned_ends_on = $2
WHERE id = $1 AND deleted_at IS NULL
"#,
        stage_rows[current_idx].id,
        new_ends_on
    )
    .execute(&mut **tx)
    .await?;
    let mut prev_end = new_ends_on;
    for later in &stage_rows[current_idx + 1..] {
        let new_start = prev_end + Duration::days(1);
        let new_end = new_start + (later.planned_ends_on - later.planned_starts_on);
        sqlx::query!(
            r#"
UPDATE course_designer_plan_stages
SET planned_starts_on = $2, planned_ends_on = $3
WHERE id = $1 AND deleted_at IS NULL
"#,
            later.id,
            new_start,
            new_end
        )
        .execute(&mut **tx)
        .await?;
        prev_end = new_end;
    }
    Ok(())
}

/// Extends the active stage by `months` (1–[`MAX_EXTEND_MONTHS`]) and pushes later stages back.
pub async fn extend_stage_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    stage: CourseDesignerStage,
    months: u32,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlanDetails> {
    if months == 0 || months > MAX_EXTEND_MONTHS {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            format!("Months must be between 1 and {MAX_EXTEND_MONTHS}."),
            None,
        ));
    }
    let mut tx = conn.begin().await?;
    let plan = get_plan_for_stage_extend(&mut tx, plan_id, user_id).await?;
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
    let stage_row = get_stage_rows(&mut tx, plan_id)
        .await?
        .into_iter()
        .find(|s| s.stage == stage)
        .ok_or_else(|| {
            ModelError::new(
                ModelErrorType::PreconditionFailed,
                "Stage not found.".to_string(),
                None,
            )
        })?;
    let new_ends_on =
        crate::course_designer_plans::add_months_clamped(stage_row.planned_ends_on, months)?;
    move_stage_end_and_shift_later(&mut tx, plan_id, stage, new_ends_on).await?;
    crate::course_designer_plans::insert_plan_event(
        &mut tx,
        plan_id,
        Some(user_id),
        "stage_extended",
        Some(stage),
        json!({ "stage_id": stage_row.id, "months": months, "new_ends_on": new_ends_on }),
    )
    .await?;
    tx.commit().await?;
    crate::course_designer_plans::get_plan_details_for_user(conn, plan_id, user_id).await
}

/// Changes the planned dates of an in-progress plan's stages that are not completed yet.
///
/// `stages` is the whole schedule and must pass [`validate_schedule_input`]; completed stages must
/// keep their dates. The caller is expected to shift later stages itself so the schedule stays
/// contiguous.
pub async fn adjust_schedule_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
    stages: &[CourseDesignerScheduleStageInput],
) -> ModelResult<CourseDesignerPlanDetails> {
    validate_schedule_input(stages)?;
    let mut tx = conn.begin().await?;
    let plan = get_plan_for_stage_extend(&mut tx, plan_id, user_id).await?;
    if plan.status != CourseDesignerPlanStatus::InProgress {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "The schedule can only be adjusted while the plan is in progress.".to_string(),
            None,
        ));
    }
    let stage_rows = get_stage_rows(&mut tx, plan_id).await?;
    for input in stages {
        let row = stage_rows
            .iter()
            .find(|r| r.stage == input.stage)
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::PreconditionFailed,
                    "Stage not found.".to_string(),
                    None,
                )
            })?;
        if row.planned_starts_on == input.planned_starts_on
            && row.planned_ends_on == input.planned_ends_on
        {
            continue;
        }
        if row.status == CourseDesignerPlanStageStatus::Completed {
            return Err(ModelError::new(
                ModelErrorType::InvalidRequest,
                format!(
                    "The {:?} stage is completed, so its dates cannot change.",
                    input.stage
                ),
                None,
            ));
        }
        sqlx::query!(
            r#"
UPDATE course_designer_plan_stages
SET planned_starts_on = $2, planned_ends_on = $3
WHERE id = $1 AND deleted_at IS NULL
"#,
            row.id,
            input.planned_starts_on,
            input.planned_ends_on
        )
        .execute(&mut *tx)
        .await?;
    }
    crate::course_designer_plans::insert_plan_event(
        &mut tx,
        plan_id,
        Some(user_id),
        "schedule_adjusted",
        None,
        json!({ "stages": stages }),
    )
    .await?;
    tx.commit().await?;
    crate::course_designer_plans::get_plan_details_for_user(conn, plan_id, user_id).await
}

/// Completes the active stage and starts the next one, or completes the plan after the last stage.
///
/// Completing a stage before its planned end moves its end to yesterday in Finnish time (or to its
/// start) and pulls later stages forward by the same amount.
pub async fn advance_to_next_stage_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlanDetails> {
    let mut tx = conn.begin().await?;
    let plan = get_plan_for_stage_advance(&mut tx, plan_id, user_id).await?;
    if plan.status != CourseDesignerPlanStatus::InProgress {
        tx.rollback().await?;
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Plan must be in progress to advance.".to_string(),
            None,
        ));
    }
    let current_stage = match plan.active_stage {
        Some(stage) => stage,
        None => {
            tx.rollback().await?;
            return Err(ModelError::new(
                ModelErrorType::PreconditionFailed,
                "Plan has no active stage.".to_string(),
                None,
            ));
        }
    };
    let now = Utc::now();
    let current_row = get_stage_rows(&mut tx, plan_id)
        .await?
        .into_iter()
        .find(|s| s.stage == current_stage)
        .ok_or_else(|| {
            ModelError::new(
                ModelErrorType::PreconditionFailed,
                "Active stage not found.".to_string(),
                None,
            )
        })?;
    // Finishing early pulls the rest of the schedule forward so the next stage starts today, or
    // tomorrow when this stage started today, since a stage lasts at least a day. Plan dates are
    // Finnish calendar days.
    let today =
        sqlx::query_scalar!(r#"SELECT (NOW() AT TIME ZONE 'Europe/Helsinki')::DATE AS "today!""#)
            .fetch_one(&mut *tx)
            .await?;
    if today <= current_row.planned_ends_on {
        let new_ends_on = (today - Duration::days(1)).max(current_row.planned_starts_on);
        if new_ends_on < current_row.planned_ends_on {
            move_stage_end_and_shift_later(&mut tx, plan_id, current_stage, new_ends_on).await?;
        }
    }
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
    crate::course_designer_plans::insert_plan_event(
        &mut tx,
        plan_id,
        Some(user_id),
        "stage_completed",
        Some(current_stage),
        json!({}),
    )
    .await?;
    let stage_order = crate::course_designer_plans::fixed_stage_order();
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
            crate::course_designer_plans::insert_plan_event(
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
            crate::course_designer_plans::insert_plan_event(
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
    crate::course_designer_plans::get_plan_details_for_user(conn, plan_id, user_id).await
}

/// Finalizes schedule for a member-owned plan.
pub async fn finalize_schedule_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseDesignerPlan> {
    let mut tx = conn.begin().await?;
    let plan = get_plan_for_schedule_finalize(&mut tx, plan_id, user_id).await?;
    if matches!(
        plan.status,
        CourseDesignerPlanStatus::InProgress
            | CourseDesignerPlanStatus::Completed
            | CourseDesignerPlanStatus::Archived
    ) {
        tx.rollback().await?;
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
        tx.rollback().await?;
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Schedule must contain all 5 stages before finalizing.".to_string(),
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
    insert_default_stage_tasks(&mut tx, plan_id).await?;
    let schedule_snapshot = sqlx::query_as!(
        CourseDesignerPlanStage,
        r#"
SELECT
  id,
  created_at,
  updated_at,
  stage,
  status,
  planned_starts_on,
  planned_ends_on,
  actual_started_at,
  actual_completed_at,
  workspace_data,
  workspace_revision
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
    crate::course_designer_plans::insert_plan_event(
        &mut tx,
        plan_id,
        Some(user_id),
        "schedule_finalized",
        Some(first_stage),
        json!({ "stages": schedule_snapshot, "active_stage": first_stage, "activated_at": now }),
    )
    .await?;
    tx.commit().await?;
    get_plan_for_user(conn, plan_id, user_id).await
}

/// Checklist added to each stage when the schedule is finalized. Stored as task titles, so these
/// are data rather than UI copy and are not translated.
fn default_stage_task_titles(stage: CourseDesignerStage) -> &'static [&'static str] {
    match stage {
        CourseDesignerStage::Analysis => &[
            "Fill in the course details",
            "Find out what students and other stakeholders need",
            "List the available resources and budget",
            "Agree on who contributes to the course and in which role",
        ],
        CourseDesignerStage::Design => &[
            "Write the learning goals",
            "Decide what is must-know, should-know and nice-to-know content",
            "Plan the chapters, topics and learning objectives",
            "Choose the content formats",
            "Agree on the style guide",
            "Plan the exercises and check the student workload",
        ],
        CourseDesignerStage::Development => &[
            "Produce the course content following the style guide",
            "Create the exercises",
            "Review the content for accuracy and accessibility",
        ],
        CourseDesignerStage::Implementation => &[
            "Upload the course materials to the platform",
            "Set up the activities and assessments",
            "Check that all links and media work",
            "Check that the content follows the style guide",
            "Test the course as a learner",
            "Make sure the course works as intended",
        ],
        CourseDesignerStage::Evaluation => &[
            "Select the test group",
            "Send the test group an invitation with a registration form, the testing period and what is expected of them",
            "Prepare a short feedback form",
            "Ask testers to report content issues with the feedback button on the platform",
            "Improve the course based on the feedback",
        ],
    }
}

/// Adds the default checklist to every stage of the plan that has no generated tasks yet.
async fn insert_default_stage_tasks(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    plan_id: Uuid,
) -> ModelResult<()> {
    for stage in crate::course_designer_plans::fixed_stage_order() {
        let titles: Vec<String> = default_stage_task_titles(stage)
            .iter()
            .map(|t| t.to_string())
            .collect();
        sqlx::query!(
            r#"
INSERT INTO course_designer_plan_stage_tasks (
  course_designer_plan_stage_id,
  title,
  order_number,
  is_auto_generated
)
SELECT s.id,
  titles.title,
  COALESCE(existing.max_order, 0) + titles.ordinal::INTEGER,
  TRUE
FROM course_designer_plan_stages s
CROSS JOIN UNNEST($3::TEXT []) WITH ORDINALITY AS titles(title, ordinal)
LEFT JOIN LATERAL (
  SELECT MAX(order_number) AS max_order
  FROM course_designer_plan_stage_tasks
  WHERE course_designer_plan_stage_id = s.id
    AND deleted_at IS NULL
) existing ON TRUE
WHERE s.course_designer_plan_id = $1
  AND s.stage = $2
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM course_designer_plan_stage_tasks t
    WHERE t.course_designer_plan_stage_id = s.id
      AND t.is_auto_generated
      AND t.deleted_at IS NULL
  )
"#,
            plan_id,
            stage as CourseDesignerStage,
            &titles
        )
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}
