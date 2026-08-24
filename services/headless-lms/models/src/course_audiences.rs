use crate::prelude::*;
use pgvector::Vector;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct CourseAudience {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub audience: String,
    #[schema(value_type = Option<Vec<f32>>)]
    pub embedding: Option<Vector>,
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
    embeddings: Vec<Vec<f32>>,
) -> ModelResult<Vec<CourseAudience>> {
    let embed_vecs: Vec<Vector> = embeddings.into_iter().map(Vector::from).collect();
    let res = sqlx::query_as!(
        CourseAudience,
        r#"
INSERT INTO course_audiences (
    course_id,
    audience,
    embedding
  )
SELECT $1,
       t.audience,
       t.embedding
FROM UNNEST(
    $2::text[],
    $3::vector[]
) AS t(audience, embedding)
RETURNING *
    "#,
        course_id,
        &audiences,
        &embed_vecs as _
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
        r#"
SELECT *
FROM course_audiences
WHERE course_id = $1
AND deleted_at IS NULL
"#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn upsert_course_audiences(
    conn: &mut PgConnection,
    course_id: Uuid,
    audience_ids: Vec<Uuid>,
    updated_audiences: Vec<String>,
    embeddings: Vec<Vec<f32>>,
) -> ModelResult<Vec<CourseAudience>> {
    let embed_vecs: Vec<Vector> = embeddings.into_iter().map(Vector::from).collect();

    let id_count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM course_audiences
WHERE id = ANY($2)
  AND course_id != $1
"#,
        course_id,
        &audience_ids,
    )
    .fetch_one(&mut *conn)
    .await?;

    if id_count != 0 {
        return Err(model_err!(
            InvalidRequest,
            "Ids of some given audience entries already exists on other courses.".to_string()
        ));
    }

    let res = sqlx::query_as!(
        CourseAudience,
        "
INSERT INTO course_audiences (course_id, id, audience, embedding)
SELECT $1,
  course_audience.id,
  course_audience.audience,
  course_audience.embedding
FROM UNNEST ($2::UUID [], $3::TEXT [], $4::VECTOR []) AS course_audience(id, audience, embedding) ON CONFLICT (id) DO
UPDATE
SET audience = EXCLUDED.audience,
  embedding = EXCLUDED.embedding
WHERE course_audiences.deleted_at IS NULL
RETURNING *
",
        course_id,
        &audience_ids,
        &updated_audiences,
        &embed_vecs as _
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(res)
}

pub async fn delete_batch(
    conn: &mut PgConnection,
    ids_to_delete: Vec<Uuid>,
) -> ModelResult<Vec<CourseAudience>> {
    let res = sqlx::query_as!(
        CourseAudience,
        r#"
UPDATE course_audiences
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

pub async fn get_course_ids_by_audience_vectors(
    conn: &mut PgConnection,
    audience_vecs: Vec<Vec<f32>>,
    audience_keywords: Vec<String>,
) -> ModelResult<Vec<Uuid>> {
    let vectors: Vec<Vector> = audience_vecs.into_iter().map(Vector::from).collect();
    let res = sqlx::query_scalar!(
        r#"
SELECT course_id
FROM (
    SELECT
        a.course_id,
        MIN(a.embedding <#> v.embedding) AS distance
    FROM course_audiences a
    CROSS JOIN unnest($1::vector[]) AS v(embedding)
    WHERE deleted_at IS NULL
    GROUP BY a.course_id
    ORDER BY distance ASC
    LIMIT 5
) t
UNION ALL
SELECT DISTINCT a.course_id
FROM course_audiences a
CROSS JOIN unnest($2::text[]) AS k(keyword)
WHERE deleted_at IS NULL
AND a.audience % k.keyword
        "#,
        &vectors as _,
        &audience_keywords
    )
    .fetch_all(conn)
    .await?;
    Ok(res.into_iter().flatten().collect())
}
