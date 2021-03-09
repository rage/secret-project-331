use anyhow::Result;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgPool};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Organization {
    id: Uuid,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    name: String,
    deleted: bool,
}

pub async fn all_organizations(pool: &PgPool) -> Result<Vec<Organization>> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let courses = sqlx::query_as!(
        Organization,
        "SELECT * FROM organizations WHERE deleted = false;"
    )
    .fetch_all(connection)
    .await?;
    return Ok(courses);
}
