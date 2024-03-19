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
    pub peer_review_config_id: Uuid,
    pub exercise_slide_submission_id: Uuid,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
    peer_review_config_id: Uuid,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_review_submissions (
    id,
    user_id,
    exercise_id,
    course_instance_id,
    peer_review_config_id,
    exercise_slide_submission_id
  )
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        user_id,
        exercise_id,
        course_instance_id,
        peer_review_config_id,
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

pub async fn get_all_received_peer_review_submissions_for_user_and_course_instance(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Vec<PeerReviewSubmission>> {
    let res = sqlx::query_as!(
        PeerReviewSubmission,
        "
SELECT prs.*
FROM exercise_slide_submissions ess
INNER JOIN peer_review_submissions prs ON (ess.id = prs.exercise_slide_submission_id)
WHERE ess.user_id = $1
  AND ess.course_instance_id = $2
  AND ess.deleted_at IS NULL
  AND prs.deleted_at IS NULL
    ",
        user_id,
        course_instance_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_given_peer_review_submissions_for_user_and_course_instance(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Vec<PeerReviewSubmission>> {
    let res = sqlx::query_as!(
        PeerReviewSubmission,
        "
SELECT *
FROM peer_review_submissions
WHERE user_id = $1
  AND course_instance_id = $2
  AND deleted_at IS NULL
    ",
        user_id,
        course_instance_id
    )
    .fetch_all(conn)
    .await?;
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

pub async fn get_peer_reviews_given_by_user_and_course_instance_and_exercise(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_instance_id: Uuid,
    exercise_id: Uuid,
) -> ModelResult<Vec<PeerReviewSubmission>> {
    let res = sqlx::query_as!(
        PeerReviewSubmission,
        "
SELECT *
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
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_users_submission_count_for_exercise_and_course_instance(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<u32> {
    let res = sqlx::query!(
        "
SELECT COUNT(*) AS count
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
    .fetch_one(conn)
    .await?;
    Ok(res.count.unwrap_or(0).try_into()?)
}

pub async fn get_last_time_user_submitted_peer_review(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Option<DateTime<Utc>>> {
    let res = sqlx::query!(
        "
SELECT MAX(created_at) as latest_submission_time
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
    .fetch_optional(conn)
    .await?;
    Ok(res.and_then(|o| o.latest_submission_time))
}

pub async fn count_peer_review_submissions_for_exercise_slide_submission(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<u32> {
    let res = sqlx::query!(
        "
SELECT COUNT(*) AS count
FROM peer_review_submissions
WHERE exercise_slide_submission_id = $1
  AND deleted_at IS NULL
        ",
        exercise_slide_submission_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.count.unwrap_or(0).try_into()?)
}

pub async fn get_self_review_submission_by_user_and_exercise(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
) -> ModelResult<Option<PeerReviewSubmission>> {
    let res = sqlx::query_as!(
        PeerReviewSubmission,
        "
SELECT prs.*
FROM peer_review_submissions prs
  JOIN user_exercise_states ues ON (
    ues.exercise_id = prs.exercise_id
    AND ues.user_id = prs.user_id
    AND ues.course_instance_id = prs.course_instance_id
  )
WHERE ues.user_id = $1
  AND prs.exercise_id = $2
  AND prs.deleted_at IS NULL
  AND ues.deleted_at IS NULL
        ",
        user_id,
        exercise_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_received_peer_or_self_review_submissions_for_user_by_peer_review_config_id_and_exercise_slide_submission(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_slide_submission_id: Uuid,
    peer_review_config_id: Uuid,
) -> ModelResult<Vec<PeerReviewSubmission>> {
    let res = sqlx::query_as!(
        PeerReviewSubmission,
        "
SELECT prs.*
FROM peer_review_submissions prs
  JOIN exercise_slide_submissions ess ON (ess.id = prs.exercise_slide_submission_id)
WHERE ess.user_id = $1
  AND ess.id = $2
  AND prs.peer_review_config_id = $3
  AND prs.deleted_at IS NULL
  AND ess.deleted_at IS NULL
        ",
        user_id,
        exercise_slide_submission_id,
        peer_review_config_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
