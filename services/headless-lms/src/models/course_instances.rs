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

#[derive(Debug)]
pub struct CourseInstance {
    pub id: Uuid,
    pub variant_status: VariantStatus,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
}

pub async fn insert(conn: &mut PgConnection, course_id: Uuid) -> Result<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO course_instances (course_id)
VALUES ($1)
RETURNING id
",
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}
