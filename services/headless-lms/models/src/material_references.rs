use crate::prelude::*;
use chrono::{DateTime, Utc};
use sqlx::PgConnection;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone, ToSchema)]

pub struct MaterialReference {
    pub id: Uuid,
    pub course_id: Uuid,
    pub citation_key: String,
    pub reference: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone, ToSchema)]

pub struct NewMaterialReference {
    pub citation_key: String,
    pub reference: String,
}

pub async fn insert_reference(
    conn: &mut PgConnection,
    course_id: Uuid,
    new_ref: Vec<NewMaterialReference>,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    let new_ref_iter = new_ref.iter();

    for new_ref in new_ref_iter {
        sqlx::query!(
            "
    INSERT INTO material_references(course_id, citation_key, reference)
    VALUES ($1, $2, $3)
    ",
            course_id,
            new_ref.citation_key,
            new_ref.reference
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    Ok(())
}

pub async fn get_reference_by_id(
    conn: &mut PgConnection,
    reference_id: Uuid,
) -> ModelResult<MaterialReference> {
    let res = sqlx::query_as!(
        MaterialReference,
        "
SELECT *
FROM material_references
WHERE id = $1;
    ",
        reference_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_non_deleted_by_id(
    conn: &mut PgConnection,
    reference_id: Uuid,
) -> ModelResult<MaterialReference> {
    let res = sqlx::query_as!(
        MaterialReference,
        "
SELECT *
FROM material_references
WHERE id = $1
  AND deleted_at IS NULL;
    ",
        reference_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_references_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<MaterialReference>> {
    let res = sqlx::query_as!(
        MaterialReference,
        "
SELECT *
FROM material_references
WHERE course_id = $1
  AND deleted_at IS NULL;
    ",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn update_material_reference_by_id(
    conn: &mut PgConnection,
    material_reference_id: Uuid,
    material_reference: NewMaterialReference,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE material_references
SET reference = $1, citation_key = $2
WHERE id = $3;
",
        material_reference.reference,
        material_reference.citation_key,
        material_reference_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update_by_id_and_course_id(
    conn: &mut PgConnection,
    material_reference_id: Uuid,
    course_id: Uuid,
    material_reference: NewMaterialReference,
) -> ModelResult<MaterialReference> {
    let res = sqlx::query_as!(
        MaterialReference,
        "
UPDATE material_references
SET reference = $1,
  citation_key = $2
WHERE id = $3
  AND course_id = $4
  AND deleted_at IS NULL
RETURNING *
        ",
        material_reference.reference,
        material_reference.citation_key,
        material_reference_id,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete_reference(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE material_references
SET deleted_at = now()
WHERE material_references.id = $1
AND deleted_at IS NULL;
        ",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete_by_id_and_course_id(
    conn: &mut PgConnection,
    id: Uuid,
    course_id: Uuid,
) -> ModelResult<MaterialReference> {
    let res = sqlx::query_as!(
        MaterialReference,
        "
UPDATE material_references
SET deleted_at = now()
WHERE id = $1
  AND course_id = $2
  AND deleted_at IS NULL
RETURNING *
        ",
        id,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
