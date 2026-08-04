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
pub struct EditCourseAudience {
    pub id: Uuid,
    pub course_id: Uuid,
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

pub async fn get_all_audiences(conn: &mut PgConnection) -> ModelResult<Vec<EditCourseAudience>> {
    let res = sqlx::query_as!(
        EditCourseAudience,
        "
SELECT id,
audience,
course_id
FROM course_audiences
WHERE deleted_at IS NULL
",
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_audiences_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<EditCourseAudience>> {
    let res = sqlx::query_as!(
        EditCourseAudience,
        "
SELECT id,
audience,
course_id
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

pub async fn upsert_course_audiences(
    conn: &mut PgConnection,
    course_id: Uuid,
    course_audiences: &[EditCourseAudience],
) -> ModelResult<Vec<CourseAudience>> {
    let audience_ids: Vec<Uuid> = course_audiences.iter().map(|a| a.id).collect();

    //TODO: verify ids

    let updated_audiences: Vec<String> = course_audiences
        .iter()
        .map(|a| a.audience.to_owned())
        .collect();

    let res = sqlx::query_as!(
        CourseAudience,
        "
INSERT INTO course_audiences (course_id, id, audience)
SELECT $1,
  course_audience.id,
  course_audience.audience
FROM UNNEST ($2::UUID [], $3::TEXT []) AS course_audience(id, audience) ON CONFLICT (id) DO
UPDATE
SET audience = EXCLUDED.audience
WHERE EXCLUDED.deleted_at IS NULL
RETURNING *
",
        &course_id,
        &audience_ids,
        &updated_audiences
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

pub async fn delete_batch(
    conn: &mut PgConnection,
    course_id: Uuid,
    course_audiences: &[EditCourseAudience],
) -> ModelResult<Vec<CourseAudience>> {
    let audience_ids: Vec<Uuid> = course_audiences.iter().map(|a| a.id).collect();

    let old_audiences: Vec<CourseAudience> = get_by_course_id(conn, course_id).await?;

    let audiences_to_delete: Vec<Uuid> = old_audiences
        .iter()
        .filter(|a| !audience_ids.contains(&a.id))
        .map(|a| a.id.to_owned())
        .collect();

    let res = sqlx::query_as!(
        CourseAudience,
        "
UPDATE course_audiences
SET deleted_at = now()
WHERE id = ANY($1::UUID [])
AND deleted_at IS NULL
RETURNING *
",
        &audiences_to_delete
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
