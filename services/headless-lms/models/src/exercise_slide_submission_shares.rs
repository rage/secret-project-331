use std::collections::HashSet;

use crate::{exercise_tasks::CourseMaterialExerciseTask, exercises::Exercise, prelude::*};

/// A shareable link to an exercise-slide submission or to an ungraded answer snapshot; exactly one
/// of the two ids is set. The `id` is the unguessable token used in the shareable URL; a viewer
/// resolves the token back to what it points at.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, sqlx::FromRow, utoipa::ToSchema)]
pub struct ExerciseSlideSubmissionShare {
    pub id: Uuid,
    pub exercise_slide_submission_id: Option<Uuid>,
    pub exercise_answer_snapshot_id: Option<Uuid>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// What a share-link holder is shown: the shared answer, without the model solution or anything
/// that identifies the student.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, utoipa::ToSchema)]
pub struct SharedSubmissionInfo {
    pub exercise: Exercise,
    pub tasks: Vec<CourseMaterialExerciseTask>,
    pub created_at: DateTime<Utc>,
    /// `false` for a paste or backup snapshot, which is stored but never graded.
    pub is_graded: bool,
    /// The course material page the exercise is on; `None` for an exam exercise.
    pub exercise_page_url: Option<String>,
}

pub async fn insert(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
    created_by: Uuid,
) -> ModelResult<ExerciseSlideSubmissionShare> {
    let row = sqlx::query_as!(
        ExerciseSlideSubmissionShare,
        r#"
INSERT INTO exercise_slide_submission_shares (exercise_slide_submission_id, created_by)
VALUES ($1, $2)
RETURNING *
        "#,
        exercise_slide_submission_id,
        created_by,
    )
    .fetch_one(conn)
    .await?;
    Ok(row)
}

/// Creates a share link to an ungraded snapshot; [`insert`] shares a submission.
pub async fn insert_for_snapshot(
    conn: &mut PgConnection,
    exercise_answer_snapshot_id: Uuid,
    created_by: Uuid,
) -> ModelResult<ExerciseSlideSubmissionShare> {
    let row = sqlx::query_as!(
        ExerciseSlideSubmissionShare,
        r#"
INSERT INTO exercise_slide_submission_shares (exercise_answer_snapshot_id, created_by)
VALUES ($1, $2)
RETURNING *
        "#,
        exercise_answer_snapshot_id,
        created_by,
    )
    .fetch_one(conn)
    .await?;
    Ok(row)
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ExerciseSlideSubmissionShare> {
    let row = sqlx::query_as!(
        ExerciseSlideSubmissionShare,
        r#"
SELECT *
FROM exercise_slide_submission_shares
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(row)
}

/// The shares the user has minted, newest first, so they can be reviewed and withdrawn.
pub async fn list_by_creator(
    conn: &mut PgConnection,
    created_by: Uuid,
) -> ModelResult<Vec<ExerciseSlideSubmissionShare>> {
    let rows = sqlx::query_as!(
        ExerciseSlideSubmissionShare,
        r#"
SELECT *
FROM exercise_slide_submission_shares
WHERE created_by = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC, id DESC
        "#,
        created_by,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}

/// Which of `submission_or_snapshot_ids` the user has a live share of.
pub async fn shared_among(
    conn: &mut PgConnection,
    created_by: Uuid,
    submission_or_snapshot_ids: &[Uuid],
) -> ModelResult<HashSet<Uuid>> {
    let rows = sqlx::query!(
        r#"
SELECT exercise_slide_submission_id,
  exercise_answer_snapshot_id
FROM exercise_slide_submission_shares
WHERE created_by = $1
  AND (
    exercise_slide_submission_id = ANY($2)
    OR exercise_answer_snapshot_id = ANY($2)
  )
  AND deleted_at IS NULL
        "#,
        created_by,
        submission_or_snapshot_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .filter_map(|row| {
            row.exercise_slide_submission_id
                .or(row.exercise_answer_snapshot_id)
        })
        .collect())
}

/// Withdraws a share, which [`get_by_id`] then stops resolving. Scoped to the creator, so the
/// unguessable token is not itself authority to revoke — only to view.
///
/// `false` means there was no live share with that id belonging to this user.
pub async fn revoke(conn: &mut PgConnection, id: Uuid, created_by: Uuid) -> ModelResult<bool> {
    let revoked = sqlx::query_scalar!(
        r#"
UPDATE exercise_slide_submission_shares
SET deleted_at = now()
WHERE id = $1
  AND created_by = $2
  AND deleted_at IS NULL
RETURNING id
        "#,
        id,
        created_by,
    )
    .fetch_optional(conn)
    .await?;
    Ok(revoked.is_some())
}

/// Withdraws every live share of one submission or snapshot at once — the operation a user actually
/// wants after sharing the same answer more than once.
pub async fn revoke_all_for_submission_or_snapshot(
    conn: &mut PgConnection,
    submission_or_snapshot_id: Uuid,
    created_by: Uuid,
) -> ModelResult<u64> {
    let revoked = sqlx::query!(
        r#"
UPDATE exercise_slide_submission_shares
SET deleted_at = now()
WHERE (
    exercise_slide_submission_id = $1
    OR exercise_answer_snapshot_id = $1
  )
  AND created_by = $2
  AND deleted_at IS NULL
        "#,
        submission_or_snapshot_id,
        created_by,
    )
    .execute(conn)
    .await?
    .rows_affected();
    Ok(revoked)
}

/// Withdraws the user's shares of their snapshots in the course, or of only `exercise_ids`, for a
/// teacher's reset. The reset deletes the submissions, which ends their links; a snapshot's link
/// must not outlive them.
pub async fn revoke_snapshot_shares_for_reset(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    exercise_ids: Option<&[Uuid]>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE exercise_slide_submission_shares
SET deleted_at = now()
WHERE exercise_answer_snapshot_id IN (
    SELECT id
    FROM exercise_answer_snapshots
    WHERE user_id = $1
      AND course_id = $2
      AND (
        $3::uuid [] IS NULL
        OR exercise_id = ANY($3)
      )
  )
  AND deleted_at IS NULL
        "#,
        user_id,
        course_id,
        exercise_ids as Option<&[Uuid]>,
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
    use crate::test_helper::*;

    async fn insert_submission(
        tx: &mut PgConnection,
        course_id: Uuid,
        user_id: Uuid,
        exercise_id: Uuid,
        exercise_slide_id: Uuid,
    ) -> Uuid {
        insert_exercise_slide_submission(
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
        .unwrap()
        .id
    }

    /// A share link is forwardable and permanent unless its creator can withdraw it, which is the
    /// whole point of the soft-delete column.
    #[tokio::test]
    async fn a_creator_can_revoke_a_share_and_it_stops_resolving() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:_task);
        let submission_id =
            insert_submission(tx.as_mut(), course_id, user_id, exercise_id, slide_id).await;
        let share = insert(tx.as_mut(), submission_id, user_id).await.unwrap();

        assert_eq!(get_by_id(tx.as_mut(), share.id).await.unwrap().id, share.id);
        assert_eq!(
            list_by_creator(tx.as_mut(), user_id)
                .await
                .unwrap()
                .iter()
                .map(|s| s.id)
                .collect::<Vec<_>>(),
            vec![share.id]
        );

        assert!(revoke(tx.as_mut(), share.id, user_id).await.unwrap());
        assert!(
            get_by_id(tx.as_mut(), share.id).await.is_err(),
            "a revoked share must no longer resolve"
        );
        assert!(
            list_by_creator(tx.as_mut(), user_id)
                .await
                .unwrap()
                .is_empty()
        );
        assert!(
            !revoke(tx.as_mut(), share.id, user_id).await.unwrap(),
            "revoking twice must be a no-op, not a second success"
        );
        tx.rollback().await;
    }

    /// Holding the token is authority to view, not to withdraw.
    #[tokio::test]
    async fn another_user_cannot_revoke_someone_elses_share() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:_task);
        let other_user = crate::users::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "share-thief@example.com",
            None,
            None,
        )
        .await
        .unwrap();
        let submission_id =
            insert_submission(tx.as_mut(), course_id, user_id, exercise_id, slide_id).await;
        let share = insert(tx.as_mut(), submission_id, user_id).await.unwrap();

        assert!(!revoke(tx.as_mut(), share.id, other_user).await.unwrap());
        assert_eq!(get_by_id(tx.as_mut(), share.id).await.unwrap().id, share.id);
        tx.rollback().await;
    }

    /// Sharing is not idempotent, so withdrawing one link would otherwise leave the others live.
    #[tokio::test]
    async fn revoking_by_submission_withdraws_every_share_of_it() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:_task);
        let submission_id =
            insert_submission(tx.as_mut(), course_id, user_id, exercise_id, slide_id).await;
        let other_submission =
            insert_submission(tx.as_mut(), course_id, user_id, exercise_id, slide_id).await;
        let first = insert(tx.as_mut(), submission_id, user_id).await.unwrap();
        let second = insert(tx.as_mut(), submission_id, user_id).await.unwrap();
        let unrelated = insert(tx.as_mut(), other_submission, user_id)
            .await
            .unwrap();

        assert_eq!(
            revoke_all_for_submission_or_snapshot(tx.as_mut(), submission_id, user_id)
                .await
                .unwrap(),
            2
        );
        assert!(get_by_id(tx.as_mut(), first.id).await.is_err());
        assert!(get_by_id(tx.as_mut(), second.id).await.is_err());
        assert_eq!(
            get_by_id(tx.as_mut(), unrelated.id).await.unwrap().id,
            unrelated.id,
            "another submission's share must be untouched"
        );
        tx.rollback().await;
    }

    /// A reset ends the links to the reset submissions, so it must end the links to snapshots too.
    #[tokio::test]
    async fn teacher_resets_revoke_snapshot_shares() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let share_snapshot = async |tx: &mut PgConnection| {
            let snapshot = crate::exercise_answer_snapshots::insert(
                tx,
                crate::exercise_answer_snapshots::NewExerciseAnswerSnapshot {
                    user_id,
                    course_id,
                    exercise_id,
                    exercise_slide_id: slide_id,
                    exercise_task_id: task_id,
                    purpose: crate::exercise_answer_snapshots::SnapshotPurpose::Paste,
                    data_json: None,
                },
                &[],
            )
            .await
            .unwrap();
            insert_for_snapshot(tx, snapshot.id, user_id).await.unwrap()
        };

        let share = share_snapshot(tx.as_mut()).await;
        crate::exercises::reset_exercises_for_selected_users(
            tx.as_mut(),
            &[(user_id, vec![exercise_id])],
            None,
            course_id,
            None,
        )
        .await
        .unwrap();
        assert!(get_by_id(tx.as_mut(), share.id).await.is_err());

        let share = share_snapshot(tx.as_mut()).await;
        crate::course_instances::reset_progress_on_course_instance_for_user(
            tx.as_mut(),
            user_id,
            course_id,
        )
        .await
        .unwrap();
        assert!(get_by_id(tx.as_mut(), share.id).await.is_err());
        tx.rollback().await;
    }
}
