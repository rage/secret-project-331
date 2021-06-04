use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgPool};
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

pub async fn all_organizations(pool: &PgPool) -> Result<Vec<Organization>> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let courses = sqlx::query_as!(
        Organization,
        "SELECT * FROM organizations WHERE deleted_at IS NULL;"
    )
    .fetch_all(connection)
    .await?;
    Ok(courses)
}
