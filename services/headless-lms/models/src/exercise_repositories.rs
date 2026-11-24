use crate::prelude::*;
use secrecy::{ExposeSecret, SecretString};
use utoipa::ToSchema;

#[derive(Debug, Serialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "exercise_repository_status", rename_all = "kebab-case")]
pub enum ExerciseRepositoryStatus {
    Pending,
    Success,
    Failure,
}

/// A repository as teachers see it. Never carries the deploy key.
#[derive(Debug, Serialize, ToSchema)]
pub struct ExerciseRepository {
    pub id: Uuid,
    pub url: String,
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub status: ExerciseRepositoryStatus,
    pub error_message: Option<String>,
    pub branch: Option<String>,
    pub public_key: Option<String>,
    pub has_deploy_key: bool,
    /// Syncs started since the last request or success, the running one included.
    pub sync_attempts: i32,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub last_sync_report: Option<ExerciseRepositorySyncReport>,
    /// Live exercise tasks that use one of the repository's exercises.
    pub exercise_task_count: i64,
}

/// What a sync changed. Exercises are named `part/name`.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct ExerciseRepositorySyncReport {
    pub added: Vec<String>,
    pub updated: Vec<String>,
    pub renamed: Vec<RenamedRepositoryExercise>,
    pub removed: Vec<String>,
    /// Gone from the repository but kept, because exercise tasks still use them.
    pub missing_but_in_use: Vec<String>,
    pub refreshed_exercise_task_count: i32,
    pub failed_exercise_tasks: Vec<FailedExerciseTaskRefresh>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct RenamedRepositoryExercise {
    pub from: String,
    pub to: String,
}

/// An exercise task whose specs could not be derived again; it keeps its previous version.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct FailedExerciseTaskRefresh {
    pub exercise_task_id: Uuid,
    pub repository_exercise: String,
    pub error: String,
}

/// What the sync worker needs to clone a repository.
#[derive(Debug)]
pub struct ExerciseRepositorySyncJob {
    pub id: Uuid,
    pub url: String,
    pub branch: Option<String>,
    pub public_key: Option<String>,
    pub deploy_key: Option<SecretString>,
    /// Identifies this run of the sync; finishing a sync that was taken over does nothing.
    pub sync_started_at: DateTime<Utc>,
}

pub async fn get(conn: &mut PgConnection, id: Uuid) -> ModelResult<ExerciseRepository> {
    let mut repositories = get_where(conn, Some(id), None, None).await?;
    repositories
        .pop()
        .ok_or_else(|| model_err!(NotFound, format!("Exercise repository {id} does not exist")))
}

pub async fn get_for_course_or_exam(
    conn: &mut PgConnection,
    id: CourseOrExamId,
) -> ModelResult<Vec<ExerciseRepository>> {
    let (course_id, exam_id) = id.to_course_and_exam_ids();
    get_where(conn, None, course_id, exam_id).await
}

async fn get_where(
    conn: &mut PgConnection,
    id: Option<Uuid>,
    course_id: Option<Uuid>,
    exam_id: Option<Uuid>,
) -> ModelResult<Vec<ExerciseRepository>> {
    let rows = sqlx::query!(
        r#"
SELECT er.id,
  er.url,
  er.course_id,
  er.exam_id,
  er.status AS "status: ExerciseRepositoryStatus",
  er.error_message,
  er.branch,
  er.public_key,
  er.deploy_key IS NOT NULL AS "has_deploy_key!",
  er.sync_attempts,
  er.last_synced_at,
  er.last_sync_report,
  (
    SELECT COUNT(*)
    FROM exercise_tasks et
      JOIN exercise_slides es ON es.id = et.exercise_slide_id
      AND es.deleted_at IS NULL
      JOIN exercises e ON e.id = es.exercise_id
      AND e.deleted_at IS NULL
      JOIN repository_exercises re ON re.id = et.repository_exercise_id
      AND re.repository_id = er.id
      AND re.deleted_at IS NULL
    WHERE et.deleted_at IS NULL
  ) AS "exercise_task_count!"
FROM exercise_repositories er
WHERE er.deleted_at IS NULL
  AND (
    er.id = $1
    OR er.course_id = $2
    OR er.exam_id = $3
  )
ORDER BY er.created_at
"#,
        id,
        course_id,
        exam_id
    )
    .fetch_all(conn)
    .await?;
    rows.into_iter()
        .map(|row| {
            Ok(ExerciseRepository {
                id: row.id,
                url: row.url,
                course_id: row.course_id,
                exam_id: row.exam_id,
                status: row.status,
                error_message: row.error_message,
                branch: row.branch,
                public_key: row.public_key,
                has_deploy_key: row.has_deploy_key,
                sync_attempts: row.sync_attempts,
                last_synced_at: row.last_synced_at,
                last_sync_report: row
                    .last_sync_report
                    .map(serde_json::from_value)
                    .transpose()?,
                exercise_task_count: row.exercise_task_count,
            })
        })
        .collect()
}

/// Inserts a repository waiting for its first sync.
pub async fn new(
    conn: &mut PgConnection,
    id: Uuid,
    course_or_exam_id: CourseOrExamId,
    url: &str,
    branch: Option<&str>,
    public_key: Option<&str>,
    deploy_key: Option<&SecretString>,
) -> ModelResult<()> {
    let (course_id, exam_id) = course_or_exam_id.to_course_and_exam_ids();
    sqlx::query!(
        "
INSERT INTO exercise_repositories (
    id,
    course_id,
    exam_id,
    url,
    branch,
    public_key,
    deploy_key
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
",
        id,
        course_id,
        exam_id,
        url,
        branch,
        public_key,
        // Exposed only here, at the DB-write boundary.
        deploy_key.map(|k| k.expose_secret())
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ExerciseRepositoryUpdate {
    pub url: String,
    pub branch: Option<String>,
    /// Replaces the stored key pair when set; the stored pair is kept otherwise.
    #[schema(value_type = Option<String>)]
    pub deploy_key: Option<SecretString>,
    pub public_key: Option<String>,
}

/// Stores the update and queues a sync, since any of the fields can change what the clone yields.
pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    update: &ExerciseRepositoryUpdate,
) -> ModelResult<()> {
    let replaces_keys = update.deploy_key.is_some();
    sqlx::query!(
        "
UPDATE exercise_repositories
SET url = $2,
  branch = $3,
  deploy_key = CASE
    WHEN $4 THEN $5
    ELSE deploy_key
  END,
  public_key = CASE
    WHEN $4 THEN $6
    ELSE public_key
  END
WHERE id = $1
  AND deleted_at IS NULL
",
        id,
        update.url,
        update.branch,
        replaces_keys,
        // Exposed only here, at the DB-write boundary.
        update.deploy_key.as_ref().map(|k| k.expose_secret()),
        update.public_key,
    )
    .execute(&mut *conn)
    .await?;
    request_sync(conn, id).await
}

/// Queues a sync. A sync already running when this is called is followed by another one.
pub async fn request_sync(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    let res = sqlx::query!(
        "
UPDATE exercise_repositories
SET status = 'pending',
  sync_requested_at = clock_timestamp(),
  sync_attempts = 0,
  error_message = NULL
WHERE id = $1
  AND deleted_at IS NULL
",
        id
    )
    .execute(conn)
    .await?;
    if res.rows_affected() == 0 {
        return Err(model_err!(
            NotFound,
            format!("Exercise repository {id} does not exist")
        ));
    }
    Ok(())
}

/// Starts the oldest queued sync that is not running, or whose run started more than `stale_after`
/// ago and is assumed dead. Skips repositories with `max_attempts` syncs started already, and
/// marks those whose last attempt died as failed.
pub async fn start_next_sync(
    conn: &mut PgConnection,
    stale_after: chrono::Duration,
    max_attempts: i32,
    skip: &[Uuid],
) -> ModelResult<Option<ExerciseRepositorySyncJob>> {
    let stale_before = Utc::now() - stale_after;
    sqlx::query!(
        "
UPDATE exercise_repositories
SET status = 'failure',
  sync_started_at = NULL,
  error_message = COALESCE(error_message, 'The sync did not finish.')
WHERE deleted_at IS NULL
  AND status = 'pending'
  AND sync_attempts >= $1
  AND sync_started_at < $2
",
        max_attempts,
        stale_before
    )
    .execute(&mut *conn)
    .await?;
    let job = sqlx::query!(
        "
UPDATE exercise_repositories
SET sync_started_at = clock_timestamp(),
  sync_attempts = sync_attempts + 1
WHERE id = (
    SELECT id
    FROM exercise_repositories
    WHERE deleted_at IS NULL
      AND status = 'pending'
      AND sync_attempts < $1
      AND (
        sync_started_at IS NULL
        OR sync_started_at < $2
      )
      AND id <> ALL($3)
    ORDER BY sync_requested_at
    LIMIT 1 FOR UPDATE SKIP LOCKED
  )
RETURNING id,
  url,
  branch,
  public_key,
  deploy_key,
  sync_started_at AS \"sync_started_at!\"
",
        max_attempts,
        stale_before,
        skip
    )
    .fetch_optional(conn)
    .await?;
    Ok(job.map(|job| ExerciseRepositorySyncJob {
        id: job.id,
        url: job.url,
        branch: job.branch,
        public_key: job.public_key,
        deploy_key: job.deploy_key.map(|key| SecretString::new(key.into())),
        sync_started_at: job.sync_started_at,
    }))
}

/// Records a finished sync, unless another run took it over in the meantime.
pub async fn finish_sync(
    conn: &mut PgConnection,
    job: &ExerciseRepositorySyncJob,
    report: &ExerciseRepositorySyncReport,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_repositories
SET status = CASE
    WHEN sync_requested_at > sync_started_at THEN 'pending'
    ELSE 'success'
  END::exercise_repository_status,
  sync_started_at = NULL,
  sync_attempts = 0,
  error_message = NULL,
  last_synced_at = now(),
  last_sync_report = $3
WHERE id = $1
  AND sync_started_at = $2
",
        job.id,
        job.sync_started_at,
        serde_json::to_value(report)?
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records a failed sync: it is retried until `max_attempts` syncs have been started.
pub async fn fail_sync(
    conn: &mut PgConnection,
    job: &ExerciseRepositorySyncJob,
    error_message: &str,
    max_attempts: i32,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_repositories
SET status = CASE
    WHEN sync_attempts >= $4
    AND sync_requested_at <= sync_started_at THEN 'failure'
    ELSE 'pending'
  END::exercise_repository_status,
  sync_started_at = NULL,
  error_message = $3
WHERE id = $1
  AND sync_started_at = $2
",
        job.id,
        job.sync_started_at,
        error_message,
        max_attempts
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
AND deleted_at IS NULL
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// An archive that no longer belongs to the repository exercise it was made for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetiredArchive {
    pub archive_path: String,
    pub download_url: String,
}

pub async fn retire_archive(
    conn: &mut PgConnection,
    repository_id: Uuid,
    archive: &RetiredArchive,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO retired_repository_exercise_archives (repository_id, archive_path, download_url)
VALUES ($1, $2, $3)
",
        repository_id,
        archive.archive_path,
        archive.download_url
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The repository's retired archives that no live repository exercise has and no live exercise
/// task uses through a removed one, so their objects can be removed.
pub async fn get_unused_retired_archives(
    conn: &mut PgConnection,
    repository_id: Uuid,
) -> ModelResult<Vec<RetiredArchive>> {
    let archives = sqlx::query_as!(
        RetiredArchive,
        "
SELECT DISTINCT ra.archive_path,
  ra.download_url
FROM retired_repository_exercise_archives ra
WHERE ra.repository_id = $1
  AND ra.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM repository_exercises re
    WHERE re.archive_path = ra.archive_path
      AND re.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM exercise_tasks et
      JOIN repository_exercises re ON re.id = et.repository_exercise_id
    WHERE re.archive_path = ra.archive_path
      AND et.deleted_at IS NULL
  )
",
        repository_id
    )
    .fetch_all(conn)
    .await?;
    Ok(archives)
}

/// Marks every retirement of the archive at `archive_path` done once its object is gone.
pub async fn mark_retired_archive_removed(
    conn: &mut PgConnection,
    archive_path: &str,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE retired_repository_exercise_archives
SET deleted_at = now()
WHERE archive_path = $1
  AND deleted_at IS NULL
",
        archive_path
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;

    /// Starts syncs until it starts the one for `id`, skipping any other queued repository.
    async fn start_sync_of(conn: &mut PgConnection, id: Uuid) -> Option<ExerciseRepositorySyncJob> {
        let mut skip = vec![];
        while let Some(job) = start_next_sync(conn, chrono::Duration::minutes(30), 2, &skip)
            .await
            .unwrap()
        {
            if job.id == id {
                return Some(job);
            }
            skip.push(job.id);
        }
        None
    }

    async fn insert_repository(conn: &mut PgConnection, course_id: Uuid) -> Uuid {
        let id = Uuid::new_v4();
        new(
            conn,
            id,
            CourseOrExamId::Course(course_id),
            "https://example.com/repo.git",
            None,
            None,
            None,
        )
        .await
        .unwrap();
        id
    }

    #[tokio::test]
    async fn a_failing_sync_is_retried_until_the_attempt_limit() {
        insert_data!(:tx, :user, :org, :course);
        let id = insert_repository(tx.as_mut(), course).await;

        let job = start_sync_of(tx.as_mut(), id).await.unwrap();
        assert!(
            start_sync_of(tx.as_mut(), id).await.is_none(),
            "already running"
        );
        fail_sync(tx.as_mut(), &job, "first", 2).await.unwrap();
        let repository = get(tx.as_mut(), id).await.unwrap();
        assert!(matches!(
            repository.status,
            ExerciseRepositoryStatus::Pending
        ));
        assert_eq!(repository.error_message.as_deref(), Some("first"));

        let job = start_sync_of(tx.as_mut(), id).await.unwrap();
        fail_sync(tx.as_mut(), &job, "second", 2).await.unwrap();
        let repository = get(tx.as_mut(), id).await.unwrap();
        assert!(matches!(
            repository.status,
            ExerciseRepositoryStatus::Failure
        ));
        assert!(start_sync_of(tx.as_mut(), id).await.is_none());

        request_sync(tx.as_mut(), id).await.unwrap();
        let job = start_sync_of(tx.as_mut(), id).await.unwrap();
        finish_sync(tx.as_mut(), &job, &ExerciseRepositorySyncReport::default())
            .await
            .unwrap();
        let repository = get(tx.as_mut(), id).await.unwrap();
        assert!(matches!(
            repository.status,
            ExerciseRepositoryStatus::Success
        ));
        assert_eq!(repository.sync_attempts, 0);
        assert!(repository.last_sync_report.is_some());
    }

    #[tokio::test]
    async fn a_sync_requested_while_one_runs_runs_after_it() {
        insert_data!(:tx, :user, :org, :course);
        let id = insert_repository(tx.as_mut(), course).await;
        let job = start_sync_of(tx.as_mut(), id).await.unwrap();
        request_sync(tx.as_mut(), id).await.unwrap();
        finish_sync(tx.as_mut(), &job, &ExerciseRepositorySyncReport::default())
            .await
            .unwrap();
        let repository = get(tx.as_mut(), id).await.unwrap();
        assert!(matches!(
            repository.status,
            ExerciseRepositoryStatus::Pending
        ));
        assert!(start_sync_of(tx.as_mut(), id).await.is_some());
    }

    #[tokio::test]
    async fn a_sync_that_died_is_started_again() {
        insert_data!(:tx, :user, :org, :course);
        let id = insert_repository(tx.as_mut(), course).await;
        start_sync_of(tx.as_mut(), id).await.unwrap();
        sqlx::query(
            "UPDATE exercise_repositories SET sync_started_at = now() - interval '1 hour' WHERE id = $1",
        )
        .bind(id)
        .execute(&mut **tx.as_mut())
        .await
        .unwrap();
        let job = start_sync_of(tx.as_mut(), id).await.unwrap();
        assert_eq!(get(tx.as_mut(), id).await.unwrap().sync_attempts, 2);

        // A second death at the limit fails the repository instead.
        sqlx::query(
            "UPDATE exercise_repositories SET sync_started_at = now() - interval '1 hour' WHERE id = $1",
        )
        .bind(id)
        .execute(&mut **tx.as_mut())
        .await
        .unwrap();
        assert!(start_sync_of(tx.as_mut(), id).await.is_none());
        let repository = get(tx.as_mut(), id).await.unwrap();
        assert!(matches!(
            repository.status,
            ExerciseRepositoryStatus::Failure
        ));
        // The run that was taken over cannot overwrite the outcome.
        finish_sync(tx.as_mut(), &job, &ExerciseRepositorySyncReport::default())
            .await
            .unwrap();
        assert!(matches!(
            get(tx.as_mut(), id).await.unwrap().status,
            ExerciseRepositoryStatus::Failure
        ));
    }
}
