use super::ModelResult;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgConnection, Type};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, TS)]
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
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
    pub contact_email: Option<String>,
    pub supervisor_name: Option<String>,
    pub supervisor_email: Option<String>,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct NewCourseInstance<'a> {
    pub id: Uuid,
    pub course_id: Uuid,
    pub name: Option<&'a str>,
    pub variant_status: Option<VariantStatus>,
    pub contact_email: Option<&'a str>,
    pub supervisor_name: Option<&'a str>,
    pub supervisor_email: Option<&'a str>,
}

pub async fn insert(
    conn: &mut PgConnection,
    new_course_instance: NewCourseInstance<'_>,
) -> ModelResult<CourseInstance> {
    let course_instance = sqlx::query_as!(
        CourseInstance,
        r#"
INSERT INTO course_instances (id, course_id, name, variant_status, contact_email, supervisor_name, supervisor_email)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  course_id,
  starts_at,
  ends_at,
  name,
  description,
  variant_status AS "variant_status: VariantStatus",
  contact_email,
  supervisor_name,
  supervisor_email
"#,
        new_course_instance.id,
        new_course_instance.course_id,
        new_course_instance.name,
        new_course_instance.variant_status.unwrap_or_default() as VariantStatus,
        new_course_instance.contact_email,
        new_course_instance.supervisor_name,
        new_course_instance.supervisor_email,
    )
    .fetch_one(conn)
    .await?;
    Ok(course_instance)
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
  variant_status AS "variant_status: VariantStatus",
  contact_email,
  supervisor_name,
  supervisor_email
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
  i.variant_status AS "variant_status: VariantStatus",
  i.contact_email,
  i.supervisor_name,
  i.supervisor_email
FROM user_course_settings ucs
  JOIN course_instances i ON (ucs.current_course_instance_id = i.id)
WHERE ucs.user_id = $1
  AND ucs.current_course_id = $2
  AND ucs.deleted_at IS NULL;
    "#,
        user_id,
        course_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(course_instance_enrollment)
}

pub async fn course_instance_by_users_latest_enrollment(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Option<CourseInstance>> {
    let course_instance = sqlx::query_as!(
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
  i.variant_status AS "variant_status: VariantStatus",
  i.contact_email,
  i.supervisor_name,
  i.supervisor_email
FROM course_instances i
  JOIN course_instance_enrollments ie ON (i.id = ie.course_id)
WHERE i.course_id = $1
  AND i.deleted_at IS NULL
  AND ie.user_id = $2
  AND ie.deleted_at IS NULL
ORDER BY ie.created_at DESC;
    "#,
        course_id,
        user_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(course_instance)
}

pub async fn get_all_course_instances(conn: &mut PgConnection) -> ModelResult<Vec<CourseInstance>> {
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
  variant_status as "variant_status: VariantStatus",
  contact_email,
  supervisor_name,
  supervisor_email
FROM course_instances
WHERE deleted_at IS NULL
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
  variant_status as "variant_status: VariantStatus",
  contact_email,
  supervisor_name,
  supervisor_email
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

pub async fn edit_contact_info(
    conn: &mut PgConnection,
    instance_id: Uuid,
    contact_email: Option<&str>,
    supervisor_name: Option<&str>,
    supervisor_email: Option<&str>,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_instances
SET contact_email = $1, supervisor_email = $2, supervisor_name = $3
WHERE id = $4
",
        contact_email,
        supervisor_email,
        supervisor_name,
        instance_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn edit_schedule(
    conn: &mut PgConnection,
    instance_id: Uuid,
    opening_time: Option<&DateTime<Utc>>,
    closing_time: Option<&DateTime<Utc>>,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_instances
SET starts_at = $1, ends_at = $2
WHERE id = $3
",
        opening_time,
        closing_time,
        instance_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_instances
SET deleted_at = now()
WHERE id = $1
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        models::{course_language_groups, courses, organizations, users},
        test_helper::Conn,
    };

    #[tokio::test]
    async fn allows_only_one_instance_per_course_without_name() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let organization_id = organizations::insert(
            tx.as_mut(),
            "",
            "",
            "",
            Uuid::parse_str("8c34e601-b5db-4b33-a588-57cb6a5b1669").unwrap(),
        )
        .await
        .unwrap();
        let course_language_group_id = course_language_groups::insert_with_id(
            tx.as_mut(),
            Uuid::parse_str("281384b3-bbc9-4da5-b93e-4c122784a724").unwrap(),
        )
        .await
        .unwrap();
        let course_1_id = courses::insert(
            tx.as_mut(),
            "",
            organization_id,
            course_language_group_id,
            "course-1",
            "en-US",
        )
        .await
        .unwrap();
        let course_2_id = courses::insert(
            tx.as_mut(),
            "",
            organization_id,
            course_language_group_id,
            "course-2",
            "en-US",
        )
        .await
        .unwrap();
        users::insert(tx.as_mut(), "user@example.com")
            .await
            .unwrap();

        let _course_1_instance_1 = insert(
            tx.as_mut(),
            NewCourseInstance {
                id: Uuid::new_v4(),
                course_id: course_1_id,
                ..Default::default()
            },
        )
        .await
        .unwrap();
        let course_2_instance_1 = insert(
            tx.as_mut(),
            NewCourseInstance {
                id: Uuid::new_v4(),
                course_id: course_2_id,
                ..Default::default()
            },
        )
        .await;
        assert!(course_2_instance_1.is_ok());

        let course_1_instance_2 = insert(
            tx.as_mut(),
            NewCourseInstance {
                id: Uuid::new_v4(),
                course_id: course_1_id,
                ..Default::default()
            },
        )
        .await;
        assert!(course_1_instance_2.is_err());
    }
}
