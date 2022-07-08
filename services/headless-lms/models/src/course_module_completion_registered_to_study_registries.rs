use crate::{course_module_completions, prelude::*};

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct CourseModuleCompletionRegisteredToStudyRegistry {
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
pub struct NewCourseModuleCompletionRegisteredToStudyRegistry {
    pub course_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub course_module_id: Uuid,
    pub study_registry_registrar_id: Uuid,
    pub user_id: Uuid,
    pub real_student_number: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    new_completion_registration: &NewCourseModuleCompletionRegisteredToStudyRegistry,
    test_only_fixed_id: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO course_module_completion_registered_to_study_registries (
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

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize, Debug)]
pub struct RegisteredCompletion {
    pub completion_id: Uuid,
    pub student_number: String,
    pub registration_date: DateTime<Utc>,
}

pub async fn insert_completions(
    conn: &mut PgConnection,
    completions: Vec<RegisteredCompletion>,
    study_registry_registrar_id: Uuid,
) -> ModelResult<()> {
    let ids: Vec<Uuid> = completions.iter().map(|x| x.completion_id).collect();
    let completions_by_id = course_module_completions::get_by_ids_as_map(conn, &ids).await?;
    let mut tx = conn.begin().await?;
    for completion in completions.into_iter() {
        let module_completion = completions_by_id
            .get(&completion.completion_id)
            .ok_or_else(|| ModelError::PreconditionFailed("Missing completion.".to_string()))?;
        insert(
            &mut tx,
            &NewCourseModuleCompletionRegisteredToStudyRegistry {
                course_id: module_completion.course_id,
                course_module_completion_id: completion.completion_id,
                course_module_id: module_completion.course_module_id,
                study_registry_registrar_id,
                user_id: module_completion.user_id,
                real_student_number: completion.student_number,
            },
            None,
        )
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn get_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<CourseModuleCompletionRegisteredToStudyRegistry> {
    let res = sqlx::query_as!(
        CourseModuleCompletionRegisteredToStudyRegistry,
        "
SELECT *
FROM course_module_completion_registered_to_study_registries
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
UPDATE course_module_completion_registered_to_study_registries
SET deleted_at = now()
WHERE id = $1
        ",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}
