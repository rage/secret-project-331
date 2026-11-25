use crate::{exercise_repositories::RetiredArchive, prelude::*};
use utoipa::ToSchema;

/// An exercise as the exercise editor's picker lists it, and as spec and grading requests carry
/// it as `repository_exercise`, so the field set is part of the exercise services' contract.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
pub struct RepositoryExercise {
    pub id: Uuid,
    pub repository_id: Uuid,
    pub part: String,
    pub name: String,
    pub repository_url: String,
    pub checksum: Vec<u8>,
    pub download_url: String,
    /// What the exercise service that prepared the repository reported about the exercise.
    pub details: Option<serde_json::Value>,
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
    pub details: Option<serde_json::Value>,
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
    pub details: &'a serde_json::Value,
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
    download_url,
    details
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
",
        id,
        repository_id,
        version.part,
        version.name,
        version.checksum,
        version.archive_path,
        version.download_url,
        version.details,
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
  download_url = $6,
  details = $7
WHERE id = $1
",
        id,
        version.part,
        version.name,
        version.checksum,
        version.archive_path,
        version.download_url,
        version.details,
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
  download_url,
  details
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
  re.download_url,
  re.details
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
  re.download_url,
  re.details
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
    let in_use = sqlx::query_scalar!(
        r#"
SELECT DISTINCT et.repository_exercise_id AS "id!"
FROM exercise_tasks et
  JOIN exercise_slides es ON es.id = et.exercise_slide_id
  AND es.deleted_at IS NULL
  JOIN exercises e ON e.id = es.exercise_id
  AND e.deleted_at IS NULL
WHERE et.repository_exercise_id = ANY($1)
  AND et.deleted_at IS NULL
"#,
        ids
    )
    .fetch_all(conn)
    .await?;
    Ok(in_use)
}

/// The current version of the repository exercise the exercise task uses, also when the exercise
/// has since been removed from its repository. `None` for a task that uses none.
pub async fn get_for_exercise_task(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
) -> ModelResult<Option<RepositoryExercise>> {
    let exercise = sqlx::query_as!(
        RepositoryExercise,
        "
SELECT re.id,
  er.id AS repository_id,
  re.part,
  re.name,
  er.url AS repository_url,
  re.checksum,
  re.download_url,
  re.details
FROM exercise_tasks et
  JOIN repository_exercises re ON re.id = et.repository_exercise_id
  JOIN exercise_repositories er ON er.id = re.repository_id
WHERE et.id = $1
",
        exercise_task_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(exercise)
}

/// The current version of a repository exercise, also when it has since been removed from its
/// repository.
pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<RepositoryExercise> {
    let exercise = sqlx::query_as!(
        RepositoryExercise,
        "
SELECT re.id,
  er.id AS repository_id,
  re.part,
  re.name,
  er.url AS repository_url,
  re.checksum,
  re.download_url,
  re.details
FROM repository_exercises re
  JOIN exercise_repositories er ON er.id = re.repository_id
WHERE re.id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(exercise)
}

/// A repository exercise of a live repository of the course or exam. `None` for another's, an
/// unknown or a removed exercise, whose archive may already be gone.
pub async fn get_in_course_or_exam(
    conn: &mut PgConnection,
    id: Uuid,
    course_or_exam_id: CourseOrExamId,
) -> ModelResult<Option<RepositoryExercise>> {
    let (course_id, exam_id) = course_or_exam_id.to_course_and_exam_ids();
    let exercise = sqlx::query_as!(
        RepositoryExercise,
        "
SELECT re.id,
  er.id AS repository_id,
  re.part,
  re.name,
  er.url AS repository_url,
  re.checksum,
  re.download_url,
  re.details
FROM repository_exercises re
  JOIN exercise_repositories er ON er.id = re.repository_id
WHERE re.id = $1
  AND re.deleted_at IS NULL
  AND er.deleted_at IS NULL
  AND (
    er.course_id = $2
    OR er.exam_id = $3
  )
",
        id,
        course_id,
        exam_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(exercise)
}

/// A live exercise task whose specs were derived from an older version of its repository exercise.
#[derive(Debug)]
pub struct OutdatedExerciseTask {
    pub id: Uuid,
    pub exercise_type: String,
    pub private_spec: Option<serde_json::Value>,
    pub repository_exercise_id: Uuid,
}

/// Live exercise tasks, course or exam, whose specs were derived from another version of one of
/// the repository's exercises than its current one.
pub async fn get_outdated_exercise_tasks(
    conn: &mut PgConnection,
    repository_id: Uuid,
) -> ModelResult<Vec<OutdatedExerciseTask>> {
    let tasks = sqlx::query_as!(
        OutdatedExerciseTask,
        r#"
SELECT et.id,
  et.exercise_type,
  et.private_spec,
  re.id AS repository_exercise_id
FROM exercise_tasks et
  JOIN repository_exercises re ON re.id = et.repository_exercise_id
  AND re.repository_id = $1
  AND re.deleted_at IS NULL
  JOIN exercise_slides es ON es.id = et.exercise_slide_id
  AND es.deleted_at IS NULL
  JOIN exercises e ON e.id = es.exercise_id
  AND e.deleted_at IS NULL
WHERE et.deleted_at IS NULL
  AND et.repository_exercise_checksum IS DISTINCT FROM re.checksum
"#,
        repository_id
    )
    .fetch_all(conn)
    .await?;
    Ok(tasks)
}

/// Stores specs re-derived from the repository exercise version with `checksum`, unless the task's
/// private spec or repository exercise has changed since `task` was read. Returns whether the
/// task was updated.
pub async fn update_exercise_task_specs(
    conn: &mut PgConnection,
    task: &OutdatedExerciseTask,
    checksum: &[u8],
    public_spec: Option<&serde_json::Value>,
    model_solution_spec: Option<&serde_json::Value>,
) -> ModelResult<bool> {
    let res = sqlx::query!(
        "
UPDATE exercise_tasks
SET public_spec = $4,
  model_solution_spec = $5,
  repository_exercise_checksum = $3
WHERE id = $1
  AND private_spec IS NOT DISTINCT FROM $2
  AND repository_exercise_id = $6
  AND deleted_at IS NULL
",
        task.id,
        task.private_spec,
        checksum,
        public_spec,
        model_solution_spec,
        task.repository_exercise_id,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected() == 1)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{exercise_repositories, test_helper::*};

    #[tokio::test]
    async fn get_in_course_or_exam_skips_removed_exercises() {
        insert_data!(:tx, :user, :org, :course);
        let repository_id = Uuid::new_v4();
        exercise_repositories::new(
            tx.as_mut(),
            repository_id,
            CourseOrExamId::Course(course),
            "https://example.com/repo.git",
            None,
            None,
            None,
        )
        .await
        .unwrap();
        let id = Uuid::new_v4();
        let details = serde_json::Value::Null;
        insert(
            tx.as_mut(),
            id,
            repository_id,
            &RepositoryExerciseVersion {
                part: "part01",
                name: "ex",
                checksum: &[1],
                archive_path: "repository_exercises/a",
                download_url: "http://files/a",
                details: &details,
            },
        )
        .await
        .unwrap();
        let in_course = CourseOrExamId::Course(course);
        assert!(
            get_in_course_or_exam(tx.as_mut(), id, in_course)
                .await
                .unwrap()
                .is_some()
        );

        delete(tx.as_mut(), id).await.unwrap();
        assert!(
            get_in_course_or_exam(tx.as_mut(), id, in_course)
                .await
                .unwrap()
                .is_none()
        );
    }
}
