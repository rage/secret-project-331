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

pub async fn get_all_course_instances(conn: &mut PgConnection) -> Result<Vec<CourseInstance>> {
    let course_instances = sqlx::query_as!(
        CourseInstance,
        r#"
SELECT
    id, variant_status as "variant_status: VariantStatus", starts_at, ends_at
FROM course_instances
WHERE deleted_at IS NOT NULL;
"#
    )
    .fetch_all(conn)
    .await?;
    Ok(course_instances)
}

pub async fn update_course_instance_variant_status(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    variant_status: VariantStatus,
) -> Result<()> {
    sqlx::query!(
        r#"
UPDATE course_instances
SET variant_status = $1
WHERE id = $2;
"#,
        variant_status as _,
        course_instance_id
    )
    .execute(conn)
    .await?;
    Ok(())
}
