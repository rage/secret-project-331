use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgConnection, Type};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct CourseInstance {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub variant_status: VariantStatus,
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

pub async fn current_course_instance_of_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> Result<Option<CourseInstance>> {
    let course_instance_enrollment = sqlx::query_as!(
        CourseInstance,
        r#"
SELECT i.id,
  i.created_at,
  i.updated_at,
  i.deleted_at,
  i.course_id,
  i.starts_at,
  i.ends_at,
  i.name,
  i.description,
  i.variant_status AS "variant_status: VariantStatus"
FROM course_instances i
  JOIN course_instance_enrollments e ON i.id = e.course_instance_id
WHERE e.user_id = $1
  AND e.course_id = $2
  AND e.current = true;
    "#,
        user_id,
        course_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(course_instance_enrollment)
}
