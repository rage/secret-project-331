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

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, ToSchema)]
pub struct NewCourseAudience {
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
    GROUP BY a.course_id
    ORDER BY distance ASC
    LIMIT 5
)
UNION ALL
SELECT DISTINCT a.course_id
FROM course_audiences a
CROSS JOIN unnest($2::text[]) AS k(keyword)
WHERE to_tsvector('english', a.audience)
    @@ websearch_to_tsquery('english', k.keyword)
        "#,
        &vectors as _,
        &audience_keywords
    )
    .fetch_all(conn)
    .await?;
    Ok(res.into_iter().flatten().collect())
}
