use crate::prelude::*;

/// A shareable link to an existing exercise-slide submission. The `id` is the
/// unguessable token used in the shareable URL; a viewer resolves the token back
/// to the submission it points at.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, sqlx::FromRow, utoipa::ToSchema)]
pub struct ExerciseSlideSubmissionShare {
    pub id: Uuid,
    pub exercise_slide_submission_id: Uuid,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
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

/// Withdraws every live share of one submission at once — the operation a user actually wants
/// after sharing the same answer more than once.
pub async fn revoke_all_for_submission(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
    created_by: Uuid,
) -> ModelResult<u64> {
    let revoked = sqlx::query!(
        r#"
UPDATE exercise_slide_submission_shares
SET deleted_at = now()
WHERE exercise_slide_submission_id = $1
  AND created_by = $2
  AND deleted_at IS NULL
        "#,
        exercise_slide_submission_id,
        created_by,
    )
    .execute(conn)
    .await?
    .rows_affected();
    Ok(revoked)
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
            revoke_all_for_submission(tx.as_mut(), submission_id, user_id)
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
}
