use crate::prelude::*;
use pgvector::Vector;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
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
RETURNING *
    "#,
        course_id,
        &new_prerequisites,
        &embed_vecs as _
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
        r#"
SELECT *
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

pub async fn upsert_course_prerequisites(
    conn: &mut PgConnection,
    course_id: Uuid,
    prerequisite_ids: Vec<Uuid>,
    updated_prerequisites: Vec<String>,
    embeddings: Vec<Vec<f32>>,
) -> ModelResult<Vec<CoursePrerequisite>> {
    let embed_vecs: Vec<Vector> = embeddings.into_iter().map(Vector::from).collect();

    let id_count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM course_prerequisites
WHERE id = ANY($2)
  AND course_id != $1
"#,
        course_id,
        &prerequisite_ids,
    )
    .fetch_one(&mut *conn)
    .await?;

    if id_count != 0 {
        return Err(model_err!(
            InvalidRequest,
            "Ids of some given prerequisite entries already exists on other courses.".to_string()
        ));
    }

    let res = sqlx::query_as!(
        CoursePrerequisite,
        r#"
INSERT INTO course_prerequisites (course_id, id, prerequisite, embedding)
SELECT $1,
  course_prerequisite.id,
  course_prerequisite.prerequisite,
  course_prerequisite.embedding
FROM UNNEST ($2::UUID [], $3::TEXT [], $4::VECTOR []) AS course_prerequisite(id, prerequisite, embedding) ON CONFLICT (id) DO
UPDATE
SET prerequisite = EXCLUDED.prerequisite,
  embedding = EXCLUDED.embedding
WHERE course_prerequisites.deleted_at IS NULL
RETURNING *
"#,
        course_id,
        &prerequisite_ids,
        &updated_prerequisites,
        &embed_vecs as _
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
RETURNING *
"#,
        &ids_to_delete
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_course_ids_by_prerequisite_vectors(
    conn: &mut PgConnection,
    prerequisite_vecs: Vec<Vec<f32>>,
    prerequisite_keywords: Vec<String>,
) -> ModelResult<Vec<Uuid>> {
    let vectors: Vec<Vector> = prerequisite_vecs.into_iter().map(Vector::from).collect();
    let res = sqlx::query_scalar!(
        r#"
SELECT course_id
FROM (
    SELECT
        p.course_id,
        MIN(p.embedding <#> v.embedding) AS distance
    FROM course_prerequisites p
    CROSS JOIN unnest($1::vector[]) AS v(embedding)
    WHERE deleted_at IS NULL
    GROUP BY p.course_id
    ORDER BY distance ASC
    LIMIT 5
) t
UNION ALL
SELECT DISTINCT p.course_id
FROM course_prerequisites p
CROSS JOIN unnest($2::text[]) AS k(keyword)
WHERE deleted_at IS NULL
AND p.prerequisite % k.keyword
        "#,
        &vectors as _,
        &prerequisite_keywords
    )
    .fetch_all(conn)
    .await?;
    Ok(res.into_iter().flatten().collect())
}
