//! Ungraded copies of a student's answer: a paste to share, or a backup kept before local changes
//! are discarded.
//!
//! Deliberately a table of their own rather than a kind of `exercise_slide_submissions` row: every
//! query that grades, counts tries, awards points, picks peer reviews or computes completion reads
//! that table, and none of them has to remember to skip snapshots.

use crate::{
    error::missing_model_error,
    exercise_service_info::ExerciseServiceInfoApi,
    exercise_task_submissions::{AnswerFile, AnswerKind, ExerciseTaskSubmission},
    exercise_tasks::CourseMaterialExerciseTask,
    prelude::*,
};
use futures::future::BoxFuture;
use url::Url;

/// Why a snapshot was stored.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(
    type_name = "exercise_answer_snapshot_purpose",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotPurpose {
    Paste,
    Backup,
}

/// A stored, ungraded copy of one task's file answer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ExerciseAnswerSnapshot {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub exercise_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
    pub purpose: SnapshotPurpose,
    /// The exercise service's own JSON about the files, opaque to the host.
    pub data_json: Option<serde_json::Value>,
}

/// What [`insert`] records, apart from the files.
pub struct NewExerciseAnswerSnapshot {
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub exercise_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
    pub purpose: SnapshotPurpose,
    pub data_json: Option<serde_json::Value>,
}

/// One file of a snapshot, joined with the `file_uploads` row it points at.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SnapshotFile {
    pub file_upload_id: Uuid,
    pub name: String,
    pub mime: String,
    pub size_bytes: Option<i64>,
    pub order_number: i32,
}

/// Records a snapshot and the uploads it consists of, in the order given.
///
/// The caller must already hold the uploads' row locks in the same transaction (see
/// `exercise_answer_uploads::lock_for_exercise_and_user`), or the reaper may retire them first.
pub async fn insert(
    conn: &mut PgConnection,
    snapshot: NewExerciseAnswerSnapshot,
    file_upload_ids: &[Uuid],
) -> ModelResult<ExerciseAnswerSnapshot> {
    let mut tx = conn.begin().await?;
    let res = sqlx::query_as!(
        ExerciseAnswerSnapshot,
        r#"
INSERT INTO exercise_answer_snapshots (
    user_id,
    course_id,
    exercise_id,
    exercise_slide_id,
    exercise_task_id,
    purpose,
    data_json
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *
"#,
        snapshot.user_id,
        snapshot.course_id,
        snapshot.exercise_id,
        snapshot.exercise_slide_id,
        snapshot.exercise_task_id,
        snapshot.purpose,
        snapshot.data_json,
    )
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query!(
        "
INSERT INTO exercise_answer_snapshot_files (
    exercise_answer_snapshot_id,
    file_upload_id,
    order_number
  )
SELECT $1,
  file_upload_id,
  (ordinality - 1)::integer
FROM UNNEST($2::uuid []) WITH ORDINALITY AS t(file_upload_id, ordinality)
",
        res.id,
        file_upload_ids
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(res)
}

/// The live snapshot with this id, or `None` when there is none, so a caller can fall back to
/// treating the id as a submission id.
pub async fn try_get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<Option<ExerciseAnswerSnapshot>> {
    let res = sqlx::query_as!(
        ExerciseAnswerSnapshot,
        r#"
SELECT *
FROM exercise_answer_snapshots
WHERE id = $1
  AND deleted_at IS NULL
"#,
        id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// The live snapshot with this id; `RecordNotFound` when there is none.
pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ExerciseAnswerSnapshot> {
    try_get_by_id(conn, id)
        .await?
        .ok_or_else(missing_model_error(
            ModelErrorType::RecordNotFound,
            "Snapshot not found",
        ))
}

/// The user's live snapshots of an exercise, newest first.
pub async fn get_by_user_and_exercise(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
) -> ModelResult<Vec<ExerciseAnswerSnapshot>> {
    let res = sqlx::query_as!(
        ExerciseAnswerSnapshot,
        r#"
SELECT *
FROM exercise_answer_snapshots
WHERE user_id = $1
  AND exercise_id = $2
  AND deleted_at IS NULL
ORDER BY created_at DESC,
  id DESC
"#,
        user_id,
        exercise_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The snapshot's files in the order they were named. A reaped file is omitted.
pub async fn get_files(
    conn: &mut PgConnection,
    snapshot_id: Uuid,
) -> ModelResult<Vec<SnapshotFile>> {
    let res = sqlx::query_as!(
        SnapshotFile,
        "
SELECT sf.file_upload_id,
  fu.name,
  fu.mime,
  fu.size_bytes,
  sf.order_number
FROM exercise_answer_snapshot_files AS sf
  JOIN file_uploads AS fu ON fu.id = sf.file_upload_id
WHERE sf.exercise_answer_snapshot_id = $1
  AND sf.deleted_at IS NULL
  AND fu.deleted_at IS NULL
ORDER BY sf.order_number
",
        snapshot_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Deletes the user's backups of the exercise beyond the newest `keep`, with their file rows, and
/// returns how many backups were deleted. Pastes are never pruned. The deleted backups' uploads
/// become reapable.
pub async fn delete_backups_beyond(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    keep: i64,
) -> ModelResult<u64> {
    let mut tx = conn.begin().await?;
    let deleted = sqlx::query_scalar!(
        "
UPDATE exercise_answer_snapshots
SET deleted_at = now()
WHERE id IN (
    SELECT id
    FROM exercise_answer_snapshots
    WHERE user_id = $1
      AND exercise_id = $2
      AND purpose = 'backup'
      AND deleted_at IS NULL
    ORDER BY created_at DESC,
      id DESC
    OFFSET $3
  )
  AND deleted_at IS NULL
RETURNING id
",
        user_id,
        exercise_id,
        keep
    )
    .fetch_all(&mut *tx)
    .await?;
    sqlx::query!(
        "
UPDATE exercise_answer_snapshot_files
SET deleted_at = now()
WHERE exercise_answer_snapshot_id = ANY($1)
  AND deleted_at IS NULL
",
        &deleted
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(deleted.len() as u64)
}

/// The snapshot as the one task a share-link viewer renders: its answer files in the place a
/// graded submission's would be, with no grading and no model solution.
pub async fn get_shared_view_task(
    conn: &mut PgConnection,
    snapshot: &ExerciseAnswerSnapshot,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<CourseMaterialExerciseTask> {
    let task =
        crate::exercise_tasks::get_exercise_task_by_id(conn, snapshot.exercise_task_id).await?;
    let services = crate::exercise_service_info::get_selected_exercise_services_by_type(
        conn,
        std::slice::from_ref(&task.exercise_type),
        fetch_service_info,
    )
    .await?;
    let (exercise_service, service_info) =
        services
            .get(&task.exercise_type)
            .ok_or_else(missing_model_error(
                ModelErrorType::InvalidRequest,
                "Exercise service not found",
            ))?;
    let exercise_iframe_url = crate::exercise_services::get_exercise_iframe_url(
        exercise_service,
        &service_info.user_interface_iframe_path,
    )?;

    let files = get_files(conn, snapshot.id)
        .await?
        .into_iter()
        .map(|file| {
            Ok(AnswerFile {
                id: file.file_upload_id,
                name: file.name,
                mime: file.mime,
                size_bytes: file.size_bytes,
                order_number: file.order_number,
                url: file_store.get_claimed_download_url(file.file_upload_id, app_conf)?,
            })
        })
        .collect::<ModelResult<Vec<_>>>()?;

    Ok(CourseMaterialExerciseTask {
        id: task.id,
        exercise_service_slug: task.exercise_type.clone(),
        exercise_slide_id: task.exercise_slide_id,
        exercise_iframe_url: Some(exercise_iframe_url.to_string()),
        pseudonumous_user_id: None,
        assignment: task.assignment,
        public_spec: task.public_spec,
        model_solution_spec: None,
        previous_submission: Some(ExerciseTaskSubmission {
            id: snapshot.id,
            created_at: snapshot.created_at,
            updated_at: snapshot.updated_at,
            deleted_at: None,
            // The exercise service protocol has no notion of a snapshot; it only needs an id.
            exercise_slide_submission_id: snapshot.id,
            exercise_task_id: snapshot.exercise_task_id,
            exercise_slide_id: snapshot.exercise_slide_id,
            answer_kind: AnswerKind::File,
            data_json: snapshot.data_json.clone(),
            data_files: (!files.is_empty()).then_some(files),
            exercise_task_grading_id: None,
            metadata: None,
        }),
        previous_submission_grading: None,
        order_number: task.order_number,
        deleted_at: task.deleted_at,
    })
}

/// Moves a snapshot's creation time `age` into the past, which decides which backups
/// [`delete_backups_beyond`] keeps.
pub async fn backdate(
    conn: &mut PgConnection,
    snapshot_id: Uuid,
    age: chrono::Duration,
) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE exercise_answer_snapshots SET created_at = now() - $2::interval WHERE id = $1",
        snapshot_id,
        age as chrono::Duration
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::test_helper::*;

    async fn insert_upload(tx: &mut PgConnection, exercise_id: Uuid, user_id: Uuid) -> Uuid {
        let file_upload_id = crate::file_uploads::insert(
            tx,
            "snapshot.tar.zst",
            &format!("snapshot-{}", Uuid::new_v4()),
            "application/zstd",
            Some(user_id),
            Some(4),
        )
        .await
        .unwrap();
        crate::exercise_answer_uploads::insert_many(
            tx,
            exercise_id,
            user_id,
            &[file_upload_id],
            crate::exercise_answer_uploads::AnswerUploadOrigin::NativeClient,
        )
        .await
        .unwrap();
        file_upload_id
    }

    #[allow(clippy::too_many_arguments)]
    async fn insert_snapshot(
        tx: &mut PgConnection,
        user_id: Uuid,
        course_id: Uuid,
        exercise_id: Uuid,
        exercise_slide_id: Uuid,
        exercise_task_id: Uuid,
        purpose: SnapshotPurpose,
        file_upload_ids: &[Uuid],
    ) -> ExerciseAnswerSnapshot {
        insert(
            tx,
            NewExerciseAnswerSnapshot {
                user_id,
                course_id,
                exercise_id,
                exercise_slide_id,
                exercise_task_id,
                purpose,
                data_json: None,
            },
            file_upload_ids,
        )
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn backups_beyond_the_cap_are_deleted_oldest_first_and_pastes_are_kept() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let paste = insert_snapshot(
            tx.as_mut(),
            user_id,
            course_id,
            exercise_id,
            slide_id,
            task_id,
            SnapshotPurpose::Paste,
            &[],
        )
        .await;
        let oldest_upload = insert_upload(tx.as_mut(), exercise_id, user_id).await;
        let oldest = insert_snapshot(
            tx.as_mut(),
            user_id,
            course_id,
            exercise_id,
            slide_id,
            task_id,
            SnapshotPurpose::Backup,
            &[oldest_upload],
        )
        .await;
        // Snapshots inserted in one transaction share its now(), so make this one older.
        backdate(tx.as_mut(), oldest.id, chrono::Duration::hours(1))
            .await
            .unwrap();
        let mut newer = vec![];
        for _ in 0..2 {
            newer.push(
                insert_snapshot(
                    tx.as_mut(),
                    user_id,
                    course_id,
                    exercise_id,
                    slide_id,
                    task_id,
                    SnapshotPurpose::Backup,
                    &[],
                )
                .await
                .id,
            );
        }

        assert_eq!(
            delete_backups_beyond(tx.as_mut(), user_id, exercise_id, 2)
                .await
                .unwrap(),
            1
        );

        let remaining: Vec<Uuid> = get_by_user_and_exercise(tx.as_mut(), user_id, exercise_id)
            .await
            .unwrap()
            .into_iter()
            .map(|snapshot| snapshot.id)
            .collect();
        assert!(!remaining.contains(&oldest.id));
        assert!(remaining.contains(&paste.id));
        assert!(newer.iter().all(|id| remaining.contains(id)));
        assert!(
            get_files(tx.as_mut(), oldest.id).await.unwrap().is_empty(),
            "a deleted backup's files must no longer hold their uploads"
        );
        tx.rollback().await;
    }
}
