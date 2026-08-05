use crate::prelude::*;
use pgvector::Vector;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, FromRow, ToSchema)]
pub struct CoursePrerequisite {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub prerequisite: String,
    #[schema(value_type = Option<Vec<f32>>)]
    pub embedding: Option<Vector>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, ToSchema)]
pub struct NewCoursePrerequisite {
    pub prerequisite: String,
}

pub async fn insert_course_prerequisites(
    conn: &mut PgConnection,
    course_id: Uuid,
    new_prerequisites: Vec<String>,
    embeddings: Vec<Vec<f32>>,
) -> ModelResult<Vec<CoursePrerequisite>> {
    let embed_vecs: Vec<Vector> = embeddings.into_iter().map(Vector::from).collect();

    let res = sqlx::query_as!(
        CoursePrerequisite,
        r#"
INSERT INTO course_prerequisites (
    course_id,
    prerequisite,
    embedding
  )
SELECT $1,
       t.prerequisite,
       t.embedding
FROM UNNEST(
    $2::text[],
    $3::vector[]
) AS t(prerequisite, embedding)
RETURNING
        id,
        created_at,
        updated_at,
        deleted_at,
        course_id,
        prerequisite,
        embedding as "embedding: Vector"
    "#,
        course_id,
        &new_prerequisites,
        &embed_vecs as _
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
        r#"
SELECT
        id,
        created_at,
        updated_at,
        deleted_at,
        course_id,
        prerequisite,
        embedding as "embedding: Vector"
FROM course_prerequisites
WHERE course_id = $1
AND deleted_at IS NULL
"#,
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
        r#"
UPDATE course_prerequisites
SET deleted_at = now()
WHERE id = ANY($1::UUID [])
AND deleted_at IS NULL
RETURNING
        id,
        created_at,
        updated_at,
        deleted_at,
        course_id,
        prerequisite,
        embedding as "embedding: Vector"
"#,
        &ids_to_delete
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_course_ids_by_prerequisite_vector(
    conn: &mut PgConnection,
    prerequisite_vec: Vec<f32>,
    prerequisite_keyword: String,
) -> ModelResult<Vec<Uuid>> {
    let vector = Vector::from(prerequisite_vec);
    let res = sqlx::query_scalar!(
        r#"
SELECT course_id
FROM (
    SELECT
        course_id,
        MIN(embedding <#> $1) AS distance
    FROM course_prerequisites
    GROUP BY course_id
    ORDER BY distance ASC
    LIMIT 5
) t
UNION ALL
SELECT course_id
FROM course_prerequisites
WHERE to_tsvector('english', prerequisite)
@@ websearch_to_tsquery('english', $2)
        "#,
        vector,
        prerequisite_keyword
    )
    .fetch_all(conn)
    .await?;
    Ok(res.into_iter().flatten().collect())
}
