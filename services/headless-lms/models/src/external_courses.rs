use crate::prelude::*;
use pgvector::Vector;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct ExternalCourse {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub name: String,
    pub description: Option<String>,
    pub url: String,
    #[schema(value_type = Option<Vec<f32>>)]
    pub name_embedding: Option<Vector>,
    #[schema(value_type = Option<Vec<f32>>)]
    pub description_embedding: Option<Vector>,
}

pub async fn get_external_courses_by_embeddings(
    conn: &mut PgConnection,
    keywords: Vec<String>,
    embeddings: Vec<Vec<f32>>,
) -> ModelResult<Vec<ExternalCourse>> {
    let embed_vecs: Vec<Vector> = embeddings.into_iter().map(Vector::from).collect();
    let res = sqlx::query_as!(
        ExternalCourse,
        r#"
SELECT  t.id AS "id!",
    t.created_at AS "created_at!",
    t.updated_at AS "updated_at!",
    t.deleted_at,
    t.name AS "name!",
    t.name_embedding,
    t.description,
    t.description_embedding,
    t.url AS "url!"
FROM (
    SELECT
        ec.*,
        LEAST(MIN(name_embedding <#> v.embedding),
              MIN(description_embedding <#> v.embedding)) AS distance
    FROM external_courses ec
    CROSS JOIN unnest($1::vector[]) AS v(embedding)
    WHERE deleted_at IS NULL
    GROUP BY id
    ORDER BY distance ASC
    LIMIT 5
) t
UNION
SELECT ec.*
FROM external_courses ec
CROSS JOIN unnest($2::text[]) AS k(keyword)
WHERE deleted_at IS NULL
AND to_tsvector('english', description)
@@ websearch_to_tsquery('english', k.keyword)
      "#,
        &embed_vecs as _,
        &keywords,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
