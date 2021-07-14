use super::ModelResult;
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
) -> ModelResult<Uuid> {
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

pub async fn get_course_instance(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<CourseInstance> {
    let course_instance = sqlx::query_as!(
        CourseInstance,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  course_id,
  starts_at,
  ends_at,
  name,
  description,
  variant_status AS "variant_status: VariantStatus"
FROM course_instances
WHERE id = $1
  AND deleted_at IS NULL;
    "#,
        course_instance_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(course_instance)
}

pub async fn current_course_instance_of_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Option<CourseInstance>> {
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
  AND e.current = 't'
  AND e.deleted_at IS NULL
  AND i.deleted_at IS NULL;
    "#,
        user_id,
        course_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(course_instance_enrollment)
}

pub async fn get_all_course_instances(conn: &mut PgConnection) -> ModelResult<Vec<CourseInstance>> {
    let course_instances = sqlx::query_as!(
        CourseInstance,
        r#"
SELECT
    id, created_at, updated_at, deleted_at, course_id, starts_at, ends_at, name, description, variant_status as "variant_status: VariantStatus"
FROM course_instances
WHERE deleted_at IS NULL;
"#
    )
    .fetch_all(conn)
    .await?;
    Ok(course_instances)
}

pub async fn get_course_instances_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseInstance>> {
    let course_instances = sqlx::query_as!(
        CourseInstance,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  course_id,
  starts_at,
  ends_at,
  name,
  description,
  variant_status as "variant_status: VariantStatus"
FROM course_instances
WHERE course_id = $1
  AND deleted_at IS NULL;
        "#,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(course_instances)
}

pub async fn update_course_instance_variant_status(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    variant_status: VariantStatus,
) -> ModelResult<()> {
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

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        models::{courses, organizations},
        test_helper::Conn,
    };

    #[tokio::test]
    async fn allows_only_one_instance_per_course_without_name() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let organization_id = organizations::insert(tx.as_mut(), "", "").await.unwrap();
        let course_1_id = courses::insert(tx.as_mut(), "", organization_id, "course-1")
            .await
            .unwrap();
        let course_2_id = courses::insert(tx.as_mut(), "", organization_id, "course-2")
            .await
            .unwrap();

        let _course_1_instance_1 = insert(tx.as_mut(), course_1_id, None).await.unwrap();
        let course_2_instance_1 = insert(tx.as_mut(), course_2_id, None).await;
        assert!(course_2_instance_1.is_ok());

        let course_1_instance_2 = insert(tx.as_mut(), course_1_id, None).await;
        assert!(course_1_instance_2.is_err());
    }
}
