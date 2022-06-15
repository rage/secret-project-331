use crate::prelude::*;

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct StudyRegistryRegistrar {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub name: String,
    pub secret_key: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    name: &str,
    secret_key: &str,
    test_only_fixed_id: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO study_registry_registrars (id, name, secret_key)
VALUES (COALESCE($1, uuid_generate_v4()), $2, $3)
RETURNING id
    ",
        test_only_fixed_id,
        name,
        secret_key
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<StudyRegistryRegistrar> {
    let res = sqlx::query_as!(
        StudyRegistryRegistrar,
        "
SELECT *
FROM study_registry_registrars
WHERE id = $1
  AND deleted_at IS NULL
        ",
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_secret_key(
    conn: &mut PgConnection,
    secret_key: &str,
) -> ModelResult<StudyRegistryRegistrar> {
    let res = sqlx::query_as!(
        StudyRegistryRegistrar,
        "
SELECT *
FROM study_registry_registrars
WHERE secret_key = $1
  AND deleted_at IS NULL
    ",
        secret_key
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE study_registry_registrars
SET deleted_at = now()
WHERE id = $1
        ",
        id,
    )
    .execute(conn)
    .await?;
    Ok(())
}
