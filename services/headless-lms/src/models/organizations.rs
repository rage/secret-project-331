use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Organization {
    id: Uuid,
    slug: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    name: String,
    deleted_at: Option<DateTime<Utc>>,
}

pub async fn all_organizations(conn: &mut PgConnection) -> Result<Vec<Organization>> {
    let courses = sqlx::query_as!(
        Organization,
        "SELECT * FROM organizations WHERE deleted_at IS NULL;"
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

pub async fn insert(slug: &str, name: &str, conn: &mut PgConnection) -> Result<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO organizations (slug, name)
VALUES ($1, $2)
RETURNING id
",
        slug,
        name
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::Conn;

    #[tokio::test]
    #[ignore = "db not set up in CI, still useful as an example test"]
    async fn gets_organizations() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        insert("slug", "org", tx.as_mut()).await.unwrap();
        let orgs = all_organizations(tx.as_mut()).await.unwrap();
        assert_eq!(orgs.len(), 1);
    }
}
