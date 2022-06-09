use crate::prelude::*;

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct CourseModuleCompletion {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub user_id: Uuid,
    pub completion_date: Option<DateTime<Utc>>,
    pub completion_registration_attempt_date: Option<DateTime<Utc>>,
    pub completion_language: String,
    pub eligible_for_ects: bool,
    pub email: String,
    // TODO: Grade here
}

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct NewCourseModuleCompletion {
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub user_id: Uuid,
    pub completion_date: Option<DateTime<Utc>>,
    pub completion_registration_attempt_date: Option<DateTime<Utc>>,
    pub completion_language: String,
    pub eligible_for_ects: bool,
    pub email: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    new_course_module_completion: &NewCourseModuleCompletion,
    test_only_fixed_id: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO course_module_completions (
    id,
    course_id,
    course_module_id,
    user_id,
    completion_date,
    completion_registration_attempt_date,
    completion_language,
    eligible_for_ects,
    email
  )
VALUES (
    COALESCE($1, uuid_generate_v4()),
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9
  )
RETURNING id
        ",
        test_only_fixed_id,
        new_course_module_completion.course_id,
        new_course_module_completion.course_module_id,
        new_course_module_completion.user_id,
        new_course_module_completion.completion_date,
        new_course_module_completion.completion_registration_attempt_date,
        new_course_module_completion.completion_language,
        new_course_module_completion.eligible_for_ects,
        new_course_module_completion.email,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<CourseModuleCompletion> {
    let res = sqlx::query_as!(
        CourseModuleCompletion,
        "
SELECT *
FROM course_module_completions
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

UPDATE course_module_completions
SET deleted_at = now()
WHERE id = $1
        ",
        id,
    )
    .execute(conn)
    .await?;
    Ok(())
}
