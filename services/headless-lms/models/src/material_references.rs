use crate::prelude::*;
use chrono::{DateTime, Utc};
use sqlx::PgConnection;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct MaterialReference {
    pub id: Uuid,
    pub course_id: Uuid,
    pub citation_key: String,
    pub reference: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewMaterialReference {
    pub citation_key: String,
    pub reference: String,
}

pub async fn insert_reference(
    conn: &mut PgConnection,
    course_id: Uuid,
    new_ref: NewMaterialReference,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO material_references(course_id, citation_key, reference)
VALUES ($1, $2, $3)
",
        course_id,
        new_ref.citation_key,
        new_ref.reference
    )
    .fetch_one(conn)
    .await?;
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

pub async fn get_references_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<MaterialReference>> {
    let res = sqlx::query_as!(
        MaterialReference,
        "
SELECT *
FROM material_references
WHERE course_id = $1;
    ",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn delete_reference(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
        DELETE FROM material_references WHERE id = $1;
        ",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}
