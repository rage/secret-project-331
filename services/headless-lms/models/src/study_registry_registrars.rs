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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;

    #[tokio::test]
    async fn secret_key_needs_to_be_long_enough() {
        insert_data!(:tx);
        let id_1 = Uuid::parse_str("88eff75b-4c8f-46f7-a857-9d804b5ec054").unwrap();
        let res = insert(tx.as_mut(), "test registrar", "12345", Some(id_1)).await;
        assert!(res.is_err(), "Expected too short key to produce error.");
    }

    #[tokio::test]
    async fn secret_key_needs_to_be_unique() {
        insert_data!(:tx);
        let id_1 = Uuid::parse_str("88eff75b-4c8f-46f7-a857-9d804b5ec054").unwrap();
        let res = insert(
            tx.as_mut(),
            "test registrar",
            "123456789-123456",
            Some(id_1),
        )
        .await;
        assert!(res.is_ok(), "Expected insertion to succeed.");

        let id_2 = Uuid::parse_str("d06abb84-0cad-4372-ad2a-7f87d3c1e420").unwrap();
        let res = insert(
            tx.as_mut(),
            "test registrar 2",
            "123456789-123456",
            Some(id_2),
        )
        .await;
        assert!(
            res.is_err(),
            "Expected insertion to fail with duplicate secret key."
        );
    }
}
