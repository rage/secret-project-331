use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewSubmission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub exercise_id: Uuid,
    pub course_instance_id: Uuid,
    pub peer_review_id: Uuid,
    pub exercise_slide_submission_id: Uuid,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
    peer_review_id: Uuid,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_review_submissions (
    user_id,
    exercise_id,
    course_instance_id,
    peer_review_id,
    exercise_slide_submission_id
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
        ",
        user_id,
        exercise_id,
        course_instance_id,
        peer_review_id,
        exercise_slide_submission_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<PeerReviewSubmission> {
    let res = sqlx::query_as!(
        PeerReviewSubmission,
        "
SELECT *
FROM peer_review_submissions
WHERE id = $1
  AND deleted_at IS NULL
        ",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_users_submission_ids_for_exercise_and_course_instance(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
SELECT exercise_slide_submission_id
FROM peer_review_submissions
WHERE user_id = $1
  AND exercise_id = $2
  AND course_instance_id = $3
  AND deleted_at IS NULL
    ",
        user_id,
        exercise_id,
        course_instance_id
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .map(|record| record.exercise_slide_submission_id)
    .collect();
    Ok(res)
}

pub async fn get_num_peer_reviews_given_by_user_and_course_instance_and_exercise(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_instance_id: Uuid,
    exercise_id: Uuid,
) -> ModelResult<i64> {
    let res = sqlx::query!(
        "
SELECT COUNT(*)
FROM peer_review_submissions
WHERE user_id = $1
  AND exercise_id = $3
  AND course_instance_id = $2
  AND deleted_at IS NULL
    ",
        user_id,
        course_instance_id,
        exercise_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.count.unwrap_or(0))
}
