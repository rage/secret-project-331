//! Ready/unfinished marks that plan members set on the sections of a course design plan.

use crate::course_designer_plans::CourseDesignerStage;
use crate::prelude::*;
use utoipa::ToSchema;

const MAX_SECTION_KEY_CHARS: usize = 255;
const MAX_COMMENT_CHARS: usize = 5000;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(
    type_name = "course_designer_section_status",
    rename_all = "snake_case"
)]
pub enum CourseDesignerSectionStatus {
    Ready,
    Unfinished,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, ToSchema)]
pub struct CourseDesignerPlanSectionStatus {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub course_designer_plan_id: Uuid,
    pub stage: CourseDesignerStage,
    /// Defined by the frontend forms, e.g. `design.learning_goals`.
    pub section_key: String,
    pub status: CourseDesignerSectionStatus,
    pub comment: Option<String>,
    pub updated_by_user_id: Uuid,
}

/// Every section mark of a plan. Callers check access to the plan themselves.
pub async fn get_for_plan(
    conn: &mut PgConnection,
    plan_id: Uuid,
) -> ModelResult<Vec<CourseDesignerPlanSectionStatus>> {
    get_for_plans(conn, &[plan_id]).await
}

/// Every section mark of the given plans, for listings across plans. Callers check access.
pub async fn get_for_plans(
    conn: &mut PgConnection,
    plan_ids: &[Uuid],
) -> ModelResult<Vec<CourseDesignerPlanSectionStatus>> {
    let rows = sqlx::query_as!(
        CourseDesignerPlanSectionStatus,
        r#"
SELECT
  id,
  created_at,
  updated_at,
  course_designer_plan_id,
  stage AS "stage: CourseDesignerStage",
  section_key,
  status AS "status: CourseDesignerSectionStatus",
  comment,
  updated_by_user_id
FROM course_designer_plan_section_statuses
WHERE course_designer_plan_id = ANY($1)
  AND deleted_at IS NULL
ORDER BY course_designer_plan_id, stage, section_key
"#,
        plan_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}

/// Sets a section's mark and comment for a plan member, replacing any earlier mark. A blank
/// comment is stored as none.
pub async fn upsert_for_user(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
    stage: CourseDesignerStage,
    section_key: &str,
    status: CourseDesignerSectionStatus,
    comment: Option<String>,
) -> ModelResult<CourseDesignerPlanSectionStatus> {
    let section_key = section_key.trim();
    if section_key.is_empty() || section_key.chars().count() > MAX_SECTION_KEY_CHARS {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            format!("Section key must be 1–{MAX_SECTION_KEY_CHARS} characters long."),
            None,
        ));
    }
    let comment = comment.filter(|c| !c.trim().is_empty());
    if comment
        .as_ref()
        .is_some_and(|c| c.chars().count() > MAX_COMMENT_CHARS)
    {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            format!("The comment can be at most {MAX_COMMENT_CHARS} characters long."),
            None,
        ));
    }
    let mut tx = conn.begin().await?;
    crate::course_designer_plan_members::lock_editable_plan_for_user(&mut tx, plan_id, user_id)
        .await?;
    let row = sqlx::query_as!(
        CourseDesignerPlanSectionStatus,
        r#"
INSERT INTO course_designer_plan_section_statuses (
  course_designer_plan_id,
  stage,
  section_key,
  status,
  comment,
  updated_by_user_id
)
SELECT $1, $3, $4, $5, $6, $2
WHERE EXISTS (
  SELECT 1
  FROM course_designer_plan_members m
  JOIN course_designer_plans p ON p.id = m.course_designer_plan_id
  WHERE m.course_designer_plan_id = $1
    AND m.user_id = $2
    AND m.deleted_at IS NULL
    AND p.deleted_at IS NULL
)
ON CONFLICT ON CONSTRAINT course_designer_plan_section_statuses_section_unique DO UPDATE
SET status = EXCLUDED.status,
  comment = EXCLUDED.comment,
  updated_by_user_id = EXCLUDED.updated_by_user_id
RETURNING
  id,
  created_at,
  updated_at,
  course_designer_plan_id,
  stage AS "stage: CourseDesignerStage",
  section_key,
  status AS "status: CourseDesignerSectionStatus",
  comment,
  updated_by_user_id
"#,
        plan_id,
        user_id,
        stage as CourseDesignerStage,
        section_key,
        status as CourseDesignerSectionStatus,
        comment
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Plan not found or user is not a plan member.".to_string(),
            None,
        )
    })?;
    tx.commit().await?;
    Ok(row)
}
