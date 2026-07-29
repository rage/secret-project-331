use crate::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, ToSchema, Hash)]
pub struct CoursePrerequisite {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub prerequisite: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, ToSchema, Hash)]
pub struct NewCoursePrerequisite {
    pub prerequisite: String,
}

pub async fn insert_course_prerequisites(
    conn: &mut PgConnection,
    course_id: Uuid,
    new_prerequisites: Vec<String>,
) -> ModelResult<Vec<CoursePrerequisite>> {
    let res = sqlx::query_as!(
        CoursePrerequisite,
        "
INSERT INTO course_prerequisites (
    course_id,
    prerequisite
  )
  SELECT $1,
  UNNEST ($2::TEXT []) prerequisite
RETURNING *
",
        course_id,
        &new_prerequisites
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CoursePrerequisite>> {
    let res = sqlx::query_as!(
        CoursePrerequisite,
        "
SELECT *
FROM course_prerequisites
WHERE course_id = $1
AND deleted_at IS NULL
",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn delete_batch(
    conn: &mut PgConnection,
    ids_to_delete: Vec<Uuid>,
) -> ModelResult<Vec<CoursePrerequisite>> {
    let res = sqlx::query_as!(
        CoursePrerequisite,
        "
UPDATE course_prerequisites
SET deleted_at = now()
WHERE id = ANY($1::UUID [])
AND deleted_at IS NULL
RETURNING *
",
        &ids_to_delete
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
