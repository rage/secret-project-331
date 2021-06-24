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

pub async fn insert(conn: &mut PgConnection, name: &str, slug: &str) -> Result<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO organizations (name, slug)
VALUES ($1, $2)
RETURNING id
",
        name,
        slug,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
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
