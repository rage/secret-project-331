use crate::prelude::*;

#[derive(Debug, Serialize, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "exercise_repository_status", rename_all = "kebab-case")]
pub enum ExerciseRepositoryStatus {
    Pending,
    Success,
    Failure,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseRepository {
    pub id: Uuid,
    pub url: String,
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub status: ExerciseRepositoryStatus,
    pub error_message: Option<String>,
}

pub async fn get(conn: &mut PgConnection, id: Uuid) -> ModelResult<ExerciseRepository> {
    let res = sqlx::query_as!(
        ExerciseRepository,
        r#"
SELECT id,
  url,
  course_id,
  exam_id,
  status AS "status: ExerciseRepositoryStatus",
  error_message
FROM exercise_repositories
WHERE id = $1
  AND deleted_at IS NULL
"#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn new(
    conn: &mut PgConnection,
    id: Uuid,
    course_or_exam_id: CourseOrExamId,
    url: &str,
    deploy_key: Option<&str>,
) -> ModelResult<()> {
    let (course_id, exam_id) = course_or_exam_id.to_course_and_exam_ids();
    sqlx::query!(
        "
INSERT INTO exercise_repositories (id, course_id, exam_id, url, deploy_key)
VALUES ($1, $2, $3, $4, $5)
",
        id,
        course_id,
        exam_id,
        url,
        deploy_key
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn mark_success(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_repositories
SET status = 'success'
WHERE id = $1
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn mark_failure(
    conn: &mut PgConnection,
    id: Uuid,
    error_message: &str,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_repositories
SET status = 'failure',
  error_message = $2
WHERE id = $1
",
        id,
        error_message
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_repositories
SET deleted_at = now()
WHERE id = $1
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_for_course_or_exam(
    conn: &mut PgConnection,
    id: CourseOrExamId,
) -> ModelResult<Vec<ExerciseRepository>> {
    let (course_id, exam_id) = id.to_course_and_exam_ids();
    let res = sqlx::query_as!(
        ExerciseRepository,
        r#"
SELECT id,
  url,
  course_id,
  exam_id,
  status AS "status: ExerciseRepositoryStatus",
  error_message
FROM exercise_repositories
WHERE (
    course_id = $1
    OR exam_id = $2
  )
  AND deleted_at IS NULL
"#,
        course_id,
        exam_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

#[derive(Debug, Deserialize)]
pub struct ExerciseRepositoryUpdate {
    pub url: String,
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    update: &ExerciseRepositoryUpdate,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_repositories SET url = $1 WHERE id = $2
",
        update.url,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}
