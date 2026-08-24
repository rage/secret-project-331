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
    pub order_number: i32,
}

/// Records the files a task submission was made from, in the order the client sent them.
pub async fn insert_many(
    conn: &mut PgConnection,
    exercise_task_submission_id: Uuid,
    file_upload_ids: &[Uuid],
) -> ModelResult<()> {
    let order_numbers: Vec<i32> = (0..file_upload_ids.len())
        .map(|index| i32::try_from(index).unwrap_or(i32::MAX))
        .collect();
    sqlx::query!(
        "
INSERT INTO exercise_task_submission_files (
    exercise_task_submission_id,
    file_upload_id,
    order_number
  )
SELECT $1,
  file_upload_id,
  order_number
FROM UNNEST($2::uuid [], $3::integer []) AS t(file_upload_id, order_number)
",
        exercise_task_submission_id,
        file_upload_ids,
        &order_numbers
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

#[cfg(test)]
mod test {
    use super::*;
    use crate::exercise_slide_submissions::{
        NewExerciseSlideSubmission, insert_exercise_slide_submission,
    };
    use crate::exercise_task_gradings::UserPointsUpdateStrategy;
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
            &serde_json::json!({ "opaque": "plugin owned" }),
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
        )
        .await
        .unwrap()
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
}
