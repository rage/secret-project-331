use crate::prelude::*;

/// A shareable link to an existing exercise-slide submission. The `id` is the
/// unguessable token used in the shareable URL; a viewer resolves the token back
/// to the submission it points at.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, sqlx::FromRow)]
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
