use crate::prelude::*;

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct CourseModuleCompletionStudyRegistryRegistration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub course_module_id: Uuid,
    pub study_registry_registrar_id: Uuid,
    pub user_id: Uuid,
    pub real_student_number: String,
}

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct NewCourseModuleCompletionStudyRegistryRegistration {
    pub course_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub course_module_id: Uuid,
    pub study_registry_registrar_id: Uuid,
    pub user_id: Uuid,
    pub real_student_number: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    new_completion_registration: &NewCourseModuleCompletionStudyRegistryRegistration,
    test_only_fixed_id: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO course_module_completion_study_registry_registrations (
    id,
    course_id,
    course_module_completion_id,
    course_module_id,
    study_registry_registrar_id,
    user_id,
    real_student_number
  )
VALUES (
    COALESCE($1, uuid_generate_v4()),
    $2,
    $3,
    $4,
    $5,
    $6,
    $7
  )
RETURNING id
        ",
        test_only_fixed_id,
        new_completion_registration.course_id,
        new_completion_registration.course_module_completion_id,
        new_completion_registration.course_module_id,
        new_completion_registration.study_registry_registrar_id,
        new_completion_registration.user_id,
        new_completion_registration.real_student_number,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<CourseModuleCompletionStudyRegistryRegistration> {
    let res = sqlx::query_as!(
        CourseModuleCompletionStudyRegistryRegistration,
        "
SELECT *
FROM course_module_completion_study_registry_registrations
WHERE id = $1
  AND deleted_at IS NULL
        ",
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_module_completion_study_registry_registrations
SET deleted_at = now()
WHERE id = $1
        ",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}
