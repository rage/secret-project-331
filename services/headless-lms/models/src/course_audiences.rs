use crate::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, ToSchema, Hash)]
pub struct CourseAudience {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub audience: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, ToSchema, Hash)]
pub struct NewCourseAudience {
    pub audience: String,
}

pub async fn insert_course_audiences(
    conn: &mut PgConnection,
    course_id: Uuid,
    audiences: Vec<String>,
) -> ModelResult<Vec<CourseAudience>> {
    let res = sqlx::query_as!(
        CourseAudience,
        "
INSERT INTO course_audiences (
    course_id,
    audience
  )
  SELECT $1,
  UNNEST ($2::TEXT []) audience
RETURNING *
",
        course_id,
        &audiences
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseAudience>> {
    let res = sqlx::query_as!(
        CourseAudience,
        "
SELECT *
FROM course_audiences
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
) -> ModelResult<Vec<CourseAudience>> {
    let res = sqlx::query_as!(
        CourseAudience,
        "
UPDATE course_audiences
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
