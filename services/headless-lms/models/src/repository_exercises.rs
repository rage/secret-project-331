use crate::{exercise_repositories::RetiredArchive, prelude::*};
use utoipa::ToSchema;

/// An exercise as the exercise editor's picker lists it. Serialized into tmc private specs as
/// `repository_exercise`, so the field set is part of the tmc service's contract.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
pub struct RepositoryExercise {
    pub id: Uuid,
    pub repository_id: Uuid,
    pub part: String,
    pub name: String,
    pub repository_url: String,
    pub checksum: Vec<u8>,
    pub download_url: String,
}

/// A repository exercise as a sync compares it with the clone.
#[derive(Debug, Clone)]
pub struct StoredRepositoryExercise {
    pub id: Uuid,
    pub part: String,
    pub name: String,
    pub checksum: Vec<u8>,
    pub archive_path: String,
    pub download_url: String,
}

impl StoredRepositoryExercise {
    pub fn archive(&self) -> RetiredArchive {
        RetiredArchive {
            archive_path: self.archive_path.clone(),
            download_url: self.download_url.clone(),
        }
    }
}

/// The version of an exercise a sync stores.
pub struct RepositoryExerciseVersion<'a> {
    pub part: &'a str,
    pub name: &'a str,
    pub checksum: &'a [u8],
    pub archive_path: &'a str,
    pub download_url: &'a str,
}

pub async fn insert(
    conn: &mut PgConnection,
    id: Uuid,
    repository_id: Uuid,
    version: &RepositoryExerciseVersion<'_>,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO repository_exercises (
    id,
    repository_id,
    part,
    name,
    checksum,
    archive_path,
    download_url
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
",
        id,
        repository_id,
        version.part,
        version.name,
        version.checksum,
        version.archive_path,
        version.download_url,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    version: &RepositoryExerciseVersion<'_>,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE repository_exercises
SET part = $2,
  name = $3,
  checksum = $4,
  archive_path = $5,
  download_url = $6
WHERE id = $1
",
        id,
        version.part,
        version.name,
        version.checksum,
        version.archive_path,
        version.download_url,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE repository_exercises
SET deleted_at = now()
WHERE id = $1
  AND deleted_at IS NULL
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Deletes the repository's exercises, returning their archives.
pub async fn delete_for_repository(
    conn: &mut PgConnection,
    repository_id: Uuid,
) -> ModelResult<Vec<RetiredArchive>> {
    let archives = sqlx::query_as!(
        RetiredArchive,
        "
UPDATE repository_exercises
SET deleted_at = now()
WHERE repository_id = $1
  AND deleted_at IS NULL
RETURNING archive_path,
  download_url
",
        repository_id
    )
    .fetch_all(conn)
    .await?;
    Ok(archives)
}

pub async fn get_stored_for_repository(
    conn: &mut PgConnection,
    repository_id: Uuid,
) -> ModelResult<Vec<StoredRepositoryExercise>> {
    let exercises = sqlx::query_as!(
        StoredRepositoryExercise,
        "
SELECT id,
  part,
  name,
  checksum,
  archive_path,
  download_url
FROM repository_exercises
WHERE repository_id = $1
  AND deleted_at IS NULL
",
        repository_id
    )
    .fetch_all(conn)
    .await?;
    Ok(exercises)
}

pub async fn get_for_repository(
    conn: &mut PgConnection,
    repository: Uuid,
) -> ModelResult<Vec<RepositoryExercise>> {
    let exercises = sqlx::query_as!(
        RepositoryExercise,
        "
SELECT re.id,
  er.id AS repository_id,
  re.part,
  re.name,
  er.url AS repository_url,
  re.checksum,
  re.download_url
FROM repository_exercises AS re
JOIN exercise_repositories AS er ON er.id = re.repository_id
WHERE repository_id = $1
AND re.deleted_at IS NULL
ORDER BY re.part, re.name
",
        repository
    )
    .fetch_all(conn)
    .await?;
    Ok(exercises)
}

/// The exercises of the course's or exam's repositories.
pub async fn get_for_course_or_exam(
    conn: &mut PgConnection,
    id: CourseOrExamId,
) -> ModelResult<Vec<RepositoryExercise>> {
    let (course_id, exam_id) = id.to_course_and_exam_ids();
    let exercises = sqlx::query_as!(
        RepositoryExercise,
        "
SELECT re.id,
  er.id AS repository_id,
  re.part,
  re.name,
  er.url AS repository_url,
  re.checksum,
  re.download_url
FROM repository_exercises AS re
JOIN exercise_repositories AS er ON er.id = re.repository_id
WHERE (
    er.course_id = $1
    OR er.exam_id = $2
  )
  AND re.deleted_at IS NULL
  AND er.deleted_at IS NULL
ORDER BY er.created_at, re.part, re.name
",
        course_id,
        exam_id
    )
    .fetch_all(conn)
    .await?;
    Ok(exercises)
}

/// Those of `ids` that a live exercise task uses.
pub async fn get_ids_in_use(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<Vec<Uuid>> {
    let ids_as_text: Vec<String> = ids.iter().map(Uuid::to_string).collect();
    let in_use = sqlx::query_scalar!(
        r#"
SELECT DISTINCT (et.private_spec -> 'repository_exercise' ->> 'id')::uuid AS "id!"
FROM exercise_tasks et
  JOIN exercise_slides es ON es.id = et.exercise_slide_id
  AND es.deleted_at IS NULL
  JOIN exercises e ON e.id = es.exercise_id
  AND e.deleted_at IS NULL
WHERE (et.private_spec -> 'repository_exercise' ->> 'id') = ANY($1)
  AND et.deleted_at IS NULL
"#,
        &ids_as_text
    )
    .fetch_all(conn)
    .await?;
    Ok(in_use)
}

/// A live exercise task whose private spec embeds one of a repository's exercises.
#[derive(Debug)]
pub struct ExerciseTaskUsingRepositoryExercise {
    pub id: Uuid,
    pub exercise_type: String,
    pub private_spec: serde_json::Value,
}

/// Live exercise tasks, course or exam, whose private spec embeds an exercise of the repository.
pub async fn get_exercise_tasks_using_repository(
    conn: &mut PgConnection,
    repository_id: Uuid,
) -> ModelResult<Vec<ExerciseTaskUsingRepositoryExercise>> {
    let tasks = sqlx::query_as!(
        ExerciseTaskUsingRepositoryExercise,
        r#"
SELECT et.id,
  et.exercise_type,
  et.private_spec AS "private_spec!"
FROM exercise_tasks et
  JOIN exercise_slides es ON es.id = et.exercise_slide_id
  AND es.deleted_at IS NULL
  JOIN exercises e ON e.id = es.exercise_id
  AND e.deleted_at IS NULL
WHERE (et.private_spec -> 'repository_exercise' ->> 'id') IN (
    SELECT re.id::text
    FROM repository_exercises re
    WHERE re.repository_id = $1
      AND re.deleted_at IS NULL
  )
  AND et.deleted_at IS NULL
"#,
        repository_id
    )
    .fetch_all(conn)
    .await?;
    Ok(tasks)
}

/// Stores re-derived specs for a task, unless its private spec has changed since
/// `previous_private_spec` was read. Returns whether the task was updated.
pub async fn update_exercise_task_specs(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
    previous_private_spec: &serde_json::Value,
    private_spec: &serde_json::Value,
    public_spec: Option<&serde_json::Value>,
    model_solution_spec: Option<&serde_json::Value>,
) -> ModelResult<bool> {
    let res = sqlx::query!(
        "
UPDATE exercise_tasks
SET private_spec = $3,
  public_spec = $4,
  model_solution_spec = $5
WHERE id = $1
  AND private_spec = $2
  AND deleted_at IS NULL
",
        exercise_task_id,
        previous_private_spec,
        private_spec,
        public_spec,
        model_solution_spec
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected() == 1)
}
