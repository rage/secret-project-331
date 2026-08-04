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
pub struct EditCoursePrerequisite {
    pub id: Uuid,
    pub course_id: Uuid,
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

pub async fn get_all_course_prerequisites(
    conn: &mut PgConnection,
) -> ModelResult<Vec<EditCoursePrerequisite>> {
    let res = sqlx::query_as!(
        EditCoursePrerequisite,
        "
SELECT id,
prerequisite,
course_id
FROM course_prerequisites
WHERE deleted_at IS NULL
",
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_prerequisites_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<EditCoursePrerequisite>> {
    let res = sqlx::query_as!(
        EditCoursePrerequisite,
        "
SELECT id,
prerequisite,
course_id
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

pub async fn upsert_course_prerequisites(
    conn: &mut PgConnection,
    course_id: Uuid,
    course_prerequisites: &[EditCoursePrerequisite],
) -> ModelResult<Vec<CoursePrerequisite>> {
    let prerequisite_ids: Vec<Uuid> = course_prerequisites.iter().map(|p| p.id).collect();

    //TODO: verify ids

    let updated_prerequisites: Vec<String> = course_prerequisites
        .iter()
        .map(|p| p.prerequisite.to_owned())
        .collect();

    let res = sqlx::query_as!(
        CoursePrerequisite,
        "
INSERT INTO course_prerequisites (course_id, id, prerequisite)
SELECT $1,
  course_prerequisite.id,
  course_prerequisite.prerequisite
FROM UNNEST ($2::UUID [], $3::TEXT []) AS course_prerequisite(id, prerequisite) ON CONFLICT (id) DO
UPDATE
SET prerequisite = EXCLUDED.prerequisite
WHERE EXCLUDED.deleted_at IS NULL
RETURNING *
",
        &course_id,
        &prerequisite_ids,
        &updated_prerequisites
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

pub async fn delete_batch(
    conn: &mut PgConnection,
    course_id: Uuid,
    course_prerequisites: &[EditCoursePrerequisite],
) -> ModelResult<Vec<CoursePrerequisite>> {
    let prerequisite_ids: Vec<Uuid> = course_prerequisites.iter().map(|p| p.id).collect();

    let old_prerequisites: Vec<CoursePrerequisite> = get_by_course_id(conn, course_id).await?;

    let prerequisites_to_delete: Vec<Uuid> = old_prerequisites
        .iter()
        .filter(|p| !prerequisite_ids.contains(&p.id))
        .map(|p| p.id.to_owned())
        .collect();

    let res = sqlx::query_as!(
        CoursePrerequisite,
        "
UPDATE course_prerequisites
SET deleted_at = now()
WHERE id = ANY($1::UUID [])
AND deleted_at IS NULL
RETURNING *
",
        &prerequisites_to_delete
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
