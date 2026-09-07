//! Which host-stored files a task submission was made from.
//!
//! The exercise service's answer is an opaque blob, so the host cannot recover a submission's
//! files by reading it. Recording the association at submit time is what lets the host serve
//! those files back without interpreting any plugin's answer shape.

use crate::prelude::*;

/// One file of a task submission, joined with the `file_uploads` row it points at.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubmissionFile {
    pub exercise_task_submission_id: Uuid,
    pub file_upload_id: Uuid,
    pub name: String,
    pub path: String,
    pub mime: String,
    /// `None` for a file stored before the size was recorded.
    pub size_bytes: Option<i64>,
    pub order_number: i32,
}

/// Records the files a task submission was made from, in the order the client sent them.
pub async fn insert_many(
    conn: &mut PgConnection,
    exercise_task_submission_id: Uuid,
    file_upload_ids: &[Uuid],
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO exercise_task_submission_files (
    exercise_task_submission_id,
    file_upload_id,
    order_number
  )
SELECT $1,
  file_upload_id,
  (ordinality - 1)::integer
FROM UNNEST($2::uuid []) WITH ORDINALITY AS t(file_upload_id, ordinality)
",
        exercise_task_submission_id,
        file_upload_ids
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The files of the given task submissions, ordered by submission and then by the order the
/// client sent them in. Soft-deleted files are omitted, so a reaped upload simply disappears
/// from the listing.
pub async fn get_by_task_submission_ids(
    conn: &mut PgConnection,
    exercise_task_submission_ids: &[Uuid],
) -> ModelResult<Vec<SubmissionFile>> {
    let res = sqlx::query_as!(
        SubmissionFile,
        "
SELECT etsf.exercise_task_submission_id,
  etsf.file_upload_id,
  fu.name,
  fu.path,
  fu.mime,
  fu.size_bytes,
  etsf.order_number
FROM exercise_task_submission_files AS etsf
  JOIN file_uploads AS fu ON fu.id = etsf.file_upload_id
WHERE etsf.exercise_task_submission_id = ANY($1)
  AND etsf.deleted_at IS NULL
  AND fu.deleted_at IS NULL
ORDER BY etsf.exercise_task_submission_id,
  etsf.order_number
",
        exercise_task_submission_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// One file of one file-typed answer to an exercise, for the teacher bulk download.
///
/// Deliberately carries no `file_uploads.name`: archive entries are named positionally from
/// `order_number` and `mime` so that a plugin which anonymizes filenames cannot leak real ones
/// through the export.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExerciseAnswerFile {
    pub user_id: Uuid,
    pub exercise_task_submission_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub path: String,
    pub mime: String,
    pub order_number: i32,
}

/// Every file of every file-typed answer to the exercise, ordered by user, then submission time,
/// then the order the client sent the files in.
///
/// JSON-typed answers contribute nothing, and a soft delete at any layer -- slide submission, task
/// submission, link row or file upload -- removes the file from the result.
pub async fn get_answer_files_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<Vec<ExerciseAnswerFile>> {
    let res = sqlx::query_as!(
        ExerciseAnswerFile,
        "
SELECT ess.user_id,
  ets.id AS exercise_task_submission_id,
  ets.created_at,
  fu.path,
  fu.mime,
  etsf.order_number
FROM exercise_task_submissions AS ets
  JOIN exercise_slide_submissions AS ess ON ets.exercise_slide_submission_id = ess.id
  JOIN exercise_task_submission_files AS etsf ON etsf.exercise_task_submission_id = ets.id
  JOIN file_uploads AS fu ON fu.id = etsf.file_upload_id
WHERE ess.exercise_id = $1
  AND ets.answer_kind = 'file'
  AND ets.deleted_at IS NULL
  AND ess.deleted_at IS NULL
  AND etsf.deleted_at IS NULL
  AND fu.deleted_at IS NULL
ORDER BY ess.user_id,
  ets.created_at,
  etsf.order_number
",
        exercise_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Whether the exercise has at least one file-typed answer whose files still exist.
///
/// Matches the rows [`get_answer_files_by_exercise_id`] would return, without reading them: the
/// caller only decides whether to offer the bulk download.
pub async fn exercise_has_answer_files(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<bool> {
    let res = sqlx::query!(
        r#"
SELECT EXISTS (
    SELECT 1
    FROM exercise_task_submissions AS ets
      JOIN exercise_slide_submissions AS ess ON ets.exercise_slide_submission_id = ess.id
      JOIN exercise_task_submission_files AS etsf ON etsf.exercise_task_submission_id = ets.id
      JOIN file_uploads AS fu ON fu.id = etsf.file_upload_id
    WHERE ess.exercise_id = $1
      AND ets.answer_kind = 'file'
      AND ets.deleted_at IS NULL
      AND ess.deleted_at IS NULL
      AND etsf.deleted_at IS NULL
      AND fu.deleted_at IS NULL
  ) AS "exists!"
"#,
        exercise_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.exists)
}

/// The files a submission recorded, paired with their positions, in stored order.
///
/// Reports the link rows as they stand; [`get_by_task_submission_ids`] instead joins `file_uploads`
/// and so omits files whose upload row was deleted.
pub async fn get_positions_by_task_submission_id(
    conn: &mut PgConnection,
    task_submission_id: Uuid,
) -> ModelResult<Vec<(Uuid, i32)>> {
    let rows = sqlx::query!(
        "
SELECT file_upload_id,
  order_number
FROM exercise_task_submission_files
WHERE exercise_task_submission_id = $1
  AND deleted_at IS NULL
ORDER BY order_number
",
        task_submission_id
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.file_upload_id, row.order_number))
        .collect())
}

/// Soft-deletes one submission-to-file link, leaving both the submission and the upload alone.
pub async fn delete_by_task_submission_and_file_upload_ids(
    conn: &mut PgConnection,
    task_submission_id: Uuid,
    file_upload_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_task_submission_files
SET deleted_at = now()
WHERE exercise_task_submission_id = $1
  AND file_upload_id = $2
  AND deleted_at IS NULL
",
        task_submission_id,
        file_upload_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::exercise_slide_submissions::{
        NewExerciseSlideSubmission, insert_exercise_slide_submission,
    };
    use crate::exercise_task_gradings::UserPointsUpdateStrategy;
    use crate::library::grading::SubmittedAnswer;
    use crate::test_helper::*;

    async fn insert_task_submission(
        tx: &mut PgConnection,
        course_id: Uuid,
        user_id: Uuid,
        exercise_id: Uuid,
        exercise_slide_id: Uuid,
        exercise_task_id: Uuid,
    ) -> Uuid {
        let slide_submission = insert_exercise_slide_submission(
            tx,
            NewExerciseSlideSubmission {
                exercise_slide_id,
                course_id: Some(course_id),
                exam_id: None,
                user_id,
                exercise_id,
                user_points_update_strategy:
                    UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
            },
        )
        .await
        .unwrap();
        crate::exercise_task_submissions::insert(
            tx,
            PKeyPolicy::Generate,
            slide_submission.id,
            exercise_slide_id,
            exercise_task_id,
            &SubmittedAnswer::Json {
                data: serde_json::json!({ "opaque": "plugin owned" }),
            },
        )
        .await
        .unwrap()
    }

    async fn insert_file(tx: &mut PgConnection, name: &str) -> Uuid {
        crate::file_uploads::insert(
            tx,
            name,
            &format!("tmc/{name}"),
            "application/octet-stream",
            None,
            None,
        )
        .await
        .unwrap()
    }

    async fn insert_file_answer(
        tx: &mut PgConnection,
        course_id: Uuid,
        user_id: Uuid,
        exercise_id: Uuid,
        exercise_slide_id: Uuid,
        exercise_task_id: Uuid,
        file_upload_ids: &[Uuid],
    ) -> (Uuid, Uuid) {
        let slide_submission = insert_exercise_slide_submission(
            tx,
            NewExerciseSlideSubmission {
                exercise_slide_id,
                course_id: Some(course_id),
                exam_id: None,
                user_id,
                exercise_id,
                user_points_update_strategy:
                    UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
            },
        )
        .await
        .unwrap();
        let submission_id = crate::exercise_task_submissions::insert(
            tx,
            PKeyPolicy::Generate,
            slide_submission.id,
            exercise_slide_id,
            exercise_task_id,
            &SubmittedAnswer::File {
                file_upload_ids: file_upload_ids.to_vec(),
                metadata: None,
            },
        )
        .await
        .unwrap();
        (slide_submission.id, submission_id)
    }

    /// Every submission in one test transaction shares `now()`, so submission time has to be set
    /// explicitly for the ordering to be observable at all.
    async fn set_submitted_at(tx: &mut PgConnection, submission_id: Uuid, seconds: i64) {
        crate::exercise_task_submissions::shift_created_at(
            tx,
            submission_id,
            chrono::Duration::seconds(seconds),
        )
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn returns_file_answers_ordered_by_user_then_submission_then_position() {
        insert_data!(:tx, user:first_user, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let second_user = crate::users::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "ordering@example.org",
            None,
            None,
        )
        .await
        .unwrap();
        let (lesser_user, greater_user) = if first_user < second_user {
            (first_user, second_user)
        } else {
            (second_user, first_user)
        };

        let later_first = insert_file(tx.as_mut(), "later-first.png").await;
        let later_second = insert_file(tx.as_mut(), "later-second.png").await;
        let earlier = insert_file(tx.as_mut(), "earlier.png").await;
        let other_user_file = insert_file(tx.as_mut(), "other-user.png").await;

        let (_, later) = insert_file_answer(
            tx.as_mut(),
            course_id,
            lesser_user,
            exercise_id,
            slide_id,
            task_id,
            &[later_first, later_second],
        )
        .await;
        set_submitted_at(tx.as_mut(), later, 60).await;
        let (_, earlier_submission) = insert_file_answer(
            tx.as_mut(),
            course_id,
            lesser_user,
            exercise_id,
            slide_id,
            task_id,
            &[earlier],
        )
        .await;
        set_submitted_at(tx.as_mut(), earlier_submission, 0).await;
        let (_, other_user_submission) = insert_file_answer(
            tx.as_mut(),
            course_id,
            greater_user,
            exercise_id,
            slide_id,
            task_id,
            &[other_user_file],
        )
        .await;

        let files = get_answer_files_by_exercise_id(tx.as_mut(), exercise_id)
            .await
            .unwrap();
        assert_eq!(
            files
                .iter()
                .map(|file| (
                    file.user_id,
                    file.exercise_task_submission_id,
                    file.order_number
                ))
                .collect::<Vec<_>>(),
            vec![
                (lesser_user, earlier_submission, 0),
                (lesser_user, later, 0),
                (lesser_user, later, 1),
                (greater_user, other_user_submission, 0),
            ]
        );
        tx.rollback().await;
    }

    #[tokio::test]
    async fn omits_json_answers() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let json_submission = insert_task_submission(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
        )
        .await;
        // A JSON answer can still have files recorded against it; only the kind decides.
        let file_id = insert_file(tx.as_mut(), "smuggled.png").await;
        insert_many(tx.as_mut(), json_submission, &[file_id])
            .await
            .unwrap();

        assert!(
            get_answer_files_by_exercise_id(tx.as_mut(), exercise_id)
                .await
                .unwrap()
                .is_empty()
        );
        tx.rollback().await;
    }

    /// A file answer plus a second, untouched one, so a test that deletes a layer proves the
    /// deletion is what removed the row rather than the query returning nothing at all.
    async fn insert_two_file_answers(
        tx: &mut PgConnection,
        course_id: Uuid,
        user_id: Uuid,
        exercise_id: Uuid,
        slide_id: Uuid,
        task_id: Uuid,
    ) -> (Uuid, Uuid, Uuid, Uuid) {
        let doomed_file = insert_file(tx, "doomed.png").await;
        let surviving_file = insert_file(tx, "surviving.png").await;
        let (doomed_slide_submission, doomed_submission) = insert_file_answer(
            tx,
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
            &[doomed_file],
        )
        .await;
        let (_, surviving_submission) = insert_file_answer(
            tx,
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
            &[surviving_file],
        )
        .await;
        (
            doomed_slide_submission,
            doomed_submission,
            doomed_file,
            surviving_submission,
        )
    }

    async fn returned_submission_ids(tx: &mut PgConnection, exercise_id: Uuid) -> Vec<Uuid> {
        get_answer_files_by_exercise_id(tx, exercise_id)
            .await
            .unwrap()
            .into_iter()
            .map(|file| file.exercise_task_submission_id)
            .collect()
    }

    #[tokio::test]
    async fn omits_a_deleted_task_submission() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let (_, doomed, _, surviving) = insert_two_file_answers(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
        )
        .await;
        crate::exercise_task_submissions::delete_by_id(tx.as_mut(), doomed)
            .await
            .unwrap();

        assert_eq!(
            returned_submission_ids(tx.as_mut(), exercise_id).await,
            vec![surviving]
        );
        tx.rollback().await;
    }

    #[tokio::test]
    async fn omits_a_deleted_slide_submission() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let (doomed_slide_submission, doomed, _, surviving) = insert_two_file_answers(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
        )
        .await;
        crate::exercise_slide_submissions::delete_by_id(tx.as_mut(), doomed_slide_submission)
            .await
            .unwrap();

        let returned = returned_submission_ids(tx.as_mut(), exercise_id).await;
        assert_eq!(returned, vec![surviving]);
        assert!(!returned.contains(&doomed));
        tx.rollback().await;
    }

    async fn soft_delete_link_row(
        tx: &mut PgConnection,
        submission_id: Uuid,
        file_upload_id: Uuid,
    ) {
        crate::exercise_task_submission_files::delete_by_task_submission_and_file_upload_ids(
            tx,
            submission_id,
            file_upload_id,
        )
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn omits_a_deleted_link_row() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let (_, doomed, doomed_file, surviving) = insert_two_file_answers(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
        )
        .await;
        soft_delete_link_row(tx.as_mut(), doomed, doomed_file).await;

        assert_eq!(
            returned_submission_ids(tx.as_mut(), exercise_id).await,
            vec![surviving]
        );
        tx.rollback().await;
    }

    #[tokio::test]
    async fn omits_a_reaped_upload() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let (_, _, doomed_file, surviving) = insert_two_file_answers(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
        )
        .await;
        crate::file_uploads::delete_and_fetch_path(tx.as_mut(), doomed_file)
            .await
            .unwrap();

        assert_eq!(
            returned_submission_ids(tx.as_mut(), exercise_id).await,
            vec![surviving]
        );
        tx.rollback().await;
    }

    #[tokio::test]
    async fn round_trips_files_in_the_order_the_client_sent_them() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let submission_id = insert_task_submission(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
        )
        .await;

        let first = insert_file(tx.as_mut(), "a.tar.zst").await;
        let second = insert_file(tx.as_mut(), "b.tar.zst").await;
        insert_many(tx.as_mut(), submission_id, &[first, second])
            .await
            .unwrap();

        let files = get_by_task_submission_ids(tx.as_mut(), &[submission_id])
            .await
            .unwrap();
        assert_eq!(
            files
                .iter()
                .map(|f| (f.file_upload_id, f.order_number, f.name.as_str()))
                .collect::<Vec<_>>(),
            vec![(first, 0, "a.tar.zst"), (second, 1, "b.tar.zst")]
        );
        assert_eq!(files[0].path, "tmc/a.tar.zst");
        tx.rollback().await;
    }

    /// The reaper's safety and the download endpoint both depend on this: a file uploaded for
    /// some other submission must never appear in this submission's list.
    #[tokio::test]
    async fn never_returns_another_submissions_files() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let mine = insert_task_submission(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
        )
        .await;
        let theirs = insert_task_submission(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
        )
        .await;

        let my_file = insert_file(tx.as_mut(), "mine.tar.zst").await;
        let their_file = insert_file(tx.as_mut(), "theirs.tar.zst").await;
        // An upload recorded against no submission at all, e.g. an iframe or CMS upload.
        let unrelated = insert_file(tx.as_mut(), "unrelated.png").await;
        insert_many(tx.as_mut(), mine, &[my_file]).await.unwrap();
        insert_many(tx.as_mut(), theirs, &[their_file])
            .await
            .unwrap();

        let files = get_by_task_submission_ids(tx.as_mut(), &[mine])
            .await
            .unwrap();
        assert_eq!(
            files.iter().map(|f| f.file_upload_id).collect::<Vec<_>>(),
            vec![my_file]
        );
        assert!(!files.iter().any(|f| f.file_upload_id == their_file));
        assert!(!files.iter().any(|f| f.file_upload_id == unrelated));
        tx.rollback().await;
    }

    #[tokio::test]
    async fn omits_a_deleted_file_upload() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let submission_id = insert_task_submission(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
        )
        .await;
        let file_id = insert_file(tx.as_mut(), "reaped.tar.zst").await;
        insert_many(tx.as_mut(), submission_id, &[file_id])
            .await
            .unwrap();

        crate::file_uploads::delete_and_fetch_path(tx.as_mut(), file_id)
            .await
            .unwrap();
        assert!(
            get_by_task_submission_ids(tx.as_mut(), &[submission_id])
                .await
                .unwrap()
                .is_empty()
        );
        tx.rollback().await;
    }

    /// A submission whose answer needs no files is legitimate, so an empty list must be a no-op
    /// rather than an error.
    #[tokio::test]
    async fn an_empty_file_list_records_nothing() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let submission_id = insert_task_submission(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
        )
        .await;
        insert_many(tx.as_mut(), submission_id, &[]).await.unwrap();
        assert!(
            get_by_task_submission_ids(tx.as_mut(), &[submission_id])
                .await
                .unwrap()
                .is_empty()
        );
        assert!(
            get_by_task_submission_ids(tx.as_mut(), &[])
                .await
                .unwrap()
                .is_empty()
        );
        tx.rollback().await;
    }
    #[tokio::test]
    async fn reports_answer_files_only_where_a_file_answer_exists() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        assert!(
            !exercise_has_answer_files(tx.as_mut(), exercise_id)
                .await
                .unwrap()
        );

        let json_submission = insert_task_submission(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
        )
        .await;
        let file_id = insert_file(tx.as_mut(), "smuggled.png").await;
        insert_many(tx.as_mut(), json_submission, &[file_id])
            .await
            .unwrap();
        assert!(
            !exercise_has_answer_files(tx.as_mut(), exercise_id)
                .await
                .unwrap()
        );

        let answer_file = insert_file(tx.as_mut(), "answer.png").await;
        insert_file_answer(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
            &[answer_file],
        )
        .await;
        assert!(
            exercise_has_answer_files(tx.as_mut(), exercise_id)
                .await
                .unwrap()
        );
        tx.rollback().await;
    }
}
