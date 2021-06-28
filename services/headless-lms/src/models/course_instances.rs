use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgConnection;
use uuid::Uuid;

#[derive(Debug, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "variant_status", rename_all = "snake_case")]
pub enum VariantStatus {
    Draft,
    Upcoming,
    Active,
    Ended,
}

impl Default for VariantStatus {
    fn default() -> Self {
        Self::Draft
    }
}

#[derive(Debug)]
pub struct CourseInstance {
    pub id: Uuid,
    pub variant_status: VariantStatus,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
}

pub async fn insert(
    conn: &mut PgConnection,
    course_id: Uuid,
    variant_status: Option<VariantStatus>,
) -> Result<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO course_instances (course_id, variant_status)
VALUES ($1, $2)
RETURNING id
",
        course_id,
        variant_status.unwrap_or_default() as VariantStatus,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}
