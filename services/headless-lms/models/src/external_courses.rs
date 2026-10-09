use crate::prelude::*;
use headless_lms_utils::azure_embedding::create_embeddings;
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
    pub on_old_platform: bool,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct NewExternalCourse {
    name: String,
    description: Option<String>,
    url: String,
    pub on_old_platform: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ExternalCourseOutput {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub url: String,
    pub on_old_platform: bool,
}
pub async fn create_external_course(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    new: NewExternalCourse,
) -> ModelResult<ExternalCourseOutput> {
    let name_embedding = create_embeddings(app_config, vec![new.name.clone()])
        .await?
        .into_iter()
        .next()
        .ok_or_else(|| model_err!(Generic, "The embedding API returned no title embedding."))
        .map(Vector::from)?;

    let description_embedding = if let Some(description) = &new.description {
        Some(
            create_embeddings(app_config, vec![description.to_owned()])
                .await?
                .into_iter()
                .next()
                .ok_or_else(|| {
                    model_err!(
                        Generic,
                        "The embedding API returned no description embedding."
                    )
                })
                .map(Vector::from)?,
        )
    } else {
        None
    };

    let res = sqlx::query_as!(
        ExternalCourseOutput,
        "
INSERT INTO external_courses(
    name,
    description,
    url,
    name_embedding,
    description_embedding,
    on_old_platform
    )
VALUES(
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
    )
RETURNING
    id,
    name,
    description,
    url,
    on_old_platform
        ",
        new.name,
        new.description,
        new.url,
        name_embedding,
        description_embedding,
        new.on_old_platform
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(res)
}

/**
Gets all the external courses added to the database
*/
pub async fn get_all_external_courses(
    conn: &mut PgConnection,
) -> ModelResult<Vec<ExternalCourseOutput>> {
    let res = sqlx::query_as!(
        ExternalCourseOutput,
        r#"
SELECT
    id,
    name,
    description,
    url,
    on_old_platform
FROM external_courses
WHERE deleted_at IS NULL
        "#
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_external_course_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ExternalCourseOutput> {
    let res = sqlx::query_as!(
        ExternalCourseOutput,
        r#"
SELECT
    id,
    name,
    description,
    url,
    on_old_platform
FROM external_courses
WHERE id = $1
AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/**
Searches for external courses with a list of given keywords, with both matching its embedding vector to embeddings of external course name and description,
and doing a keyword search to concatenated name and description tsvector.
*/
pub async fn get_external_courses_by_embeddings(
    conn: &mut PgConnection,
    keywords: Vec<String>,
    embeddings: Vec<Vec<f32>>,
) -> ModelResult<Vec<ExternalCourseOutput>> {
    let embed_vecs: Vec<Vector> = embeddings.into_iter().map(Vector::from).collect();
    let res = sqlx::query_as!(
        ExternalCourseOutput,
        r#"
SELECT  t.id AS "id!",
    t.name AS "name!",
    t.description,
    t.url AS "url!",
    t.on_old_platform AS "on_old_platform!"
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
SELECT ec.id,
       ec.name,
       ec.description,
       ec.url,
       ec.on_old_platform
FROM external_courses ec
CROSS JOIN unnest($2::text[]) AS k(keyword)
WHERE deleted_at IS NULL
AND to_tsvector(
    'english',
    ec.name || ' ' || coalesce(ec.description, '')
) @@ websearch_to_tsquery('english', k.keyword)

      "#,
        &embed_vecs as _,
        &keywords,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/**
Delete external course based on id
*/
pub async fn delete_by_id(
    conn: &mut PgConnection,
    external_course_id: Uuid,
) -> ModelResult<ExternalCourseOutput> {
    let res = sqlx::query_as!(
        ExternalCourseOutput,
        r#"
UPDATE external_courses
SET deleted_at = now()
WHERE id = $1
AND deleted_at IS NULL
RETURNING
    id,
    name,
    description,
    url,
    on_old_platform
        "#,
        external_course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/**
Edit external course information
*/
pub async fn update_by_id(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    update: ExternalCourseOutput,
) -> ModelResult<ExternalCourseOutput> {
    let old = get_external_course_by_id(conn, update.id).await?;
    let name_embedding = if old.name != update.name {
        Some(
            create_embeddings(app_config, vec![update.name.clone()])
                .await?
                .into_iter()
                .next()
                .ok_or_else(|| {
                    model_err!(
                        Generic,
                        "The embedding API returned no description embedding."
                    )
                })
                .map(Vector::from)?,
        )
    } else {
        None
    };
    let description_embedding = if old.description != update.description {
        if let Some(description) = &update.description {
            Some(
                create_embeddings(app_config, vec![description.clone()])
                    .await?
                    .into_iter()
                    .next()
                    .ok_or_else(|| {
                        model_err!(
                            Generic,
                            "The embedding API returned no description embedding."
                        )
                    })
                    .map(Vector::from)?,
            )
        } else {
            None
        }
    } else {
        None
    };

    let res = sqlx::query_as!(
        ExternalCourseOutput,
        r#"
UPDATE external_courses
SET name = $1,
    description = $2,
    url = $3,
    name_embedding = COALESCE($4, name_embedding),
    description_embedding = CASE WHEN $2::text IS NULL THEN NULL ELSE COALESCE($5, description_embedding) END,
    on_old_platform = $6
WHERE id = $7 AND deleted_at IS NULL
RETURNING
        id,
        name,
        description,
        url,
        on_old_platform
        "#,
        update.name,
        update.description,
        update.url,
        name_embedding,
        description_embedding,
        update.on_old_platform,
        update.id
    )
    .fetch_one(conn)
    .await?;

    Ok(res)
}
