use super::ModelResult;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct Organization {
    id: Uuid,
    slug: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    name: String,
    deleted_at: Option<DateTime<Utc>>,
}

pub async fn insert(
    conn: &mut PgConnection,
    name: &str,
    slug: &str,
    id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO organizations (id, name, slug)
VALUES ($1, $2, $3)
RETURNING id
",
        id,
        name,
        slug,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn all_organizations(conn: &mut PgConnection) -> ModelResult<Vec<Organization>> {
    let courses = sqlx::query_as!(
        Organization,
        "SELECT * FROM organizations WHERE deleted_at IS NULL;"
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::Conn;

    #[tokio::test]
    async fn gets_organizations() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let orgs_before = all_organizations(tx.as_mut()).await.unwrap();
        insert(
            tx.as_mut(),
            "org",
            "slug",
            Uuid::parse_str("8c34e601-b5db-4b33-a588-57cb6a5b1669").unwrap(),
        )
        .await
        .unwrap();
        let orgs_after = all_organizations(tx.as_mut()).await.unwrap();
        assert_eq!(orgs_before.len() + 1, orgs_after.len());
    }
}
