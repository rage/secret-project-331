use crate::{
    exercises,
    library::user_exercise_state_updater,
    prelude::*,
    teacher_grading_decisions,
    user_exercise_states::{self, ReviewingStage},
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewQueueEntry {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub exercise_id: Uuid,
    pub course_id: Uuid,
    pub receiving_peer_reviews_exercise_slide_submission_id: Uuid,
    pub received_enough_peer_reviews: bool,
    pub peer_review_priority: i32,
    pub removed_from_queue_for_unusual_reason: bool,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    user_id: Uuid,
    exercise_id: Uuid,
    course_id: Uuid,
    receiving_peer_reviews_exercise_slide_submission_id: Uuid,
    peer_review_priority: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_review_queue_entries (
    id,
    user_id,
    exercise_id,
    course_id,
    receiving_peer_reviews_exercise_slide_submission_id,
    peer_review_priority
  )
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        user_id,
        exercise_id,
        course_id,
        receiving_peer_reviews_exercise_slide_submission_id,
        peer_review_priority,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

/// Inserts or updates the queue entry indexed by `user_id`, `exercise_id` and `course_id`.
///
/// The value for `receiving_peer_reviews_exercise_slide_submission_id` never changes after the initial
/// insertion. This is to make sure that all received peer reviews are made for the same exercise slide
/// submission. The same applies to `received_enough_peer_reviews` to avoid the scenario where it might
/// be set from `true` back to `false`.
pub async fn upsert_peer_review_priority(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_id: Uuid,
    peer_review_priority: i32,
    receiving_peer_reviews_exercise_slide_submission_id: Uuid,
    received_enough_peer_reviews: bool,
) -> ModelResult<PeerReviewQueueEntry> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
INSERT INTO peer_review_queue_entries (
    user_id,
    exercise_id,
    course_id,
    peer_review_priority,
    receiving_peer_reviews_exercise_slide_submission_id,
    received_enough_peer_reviews
  )
VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id, exercise_id, course_id, deleted_at) DO
UPDATE
SET peer_review_priority = $4
RETURNING *
        ",
        user_id,
        exercise_id,
        course_id,
        peer_review_priority,
        receiving_peer_reviews_exercise_slide_submission_id,
        received_enough_peer_reviews,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update_received_enough_peer_reviews(
    conn: &mut PgConnection,
    id: Uuid,
    received_enough_peer_reviews: bool,
) -> ModelResult<PeerReviewQueueEntry> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
UPDATE peer_review_queue_entries
SET received_enough_peer_reviews = $1
WHERE id = $2
  AND deleted_at IS NULL
RETURNING *;
        ",
        received_enough_peer_reviews,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    receiving_peer_reviews_exercise_slide_submission_id: Uuid,
    peer_review_priority: i32,
) -> ModelResult<PeerReviewQueueEntry> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
UPDATE peer_review_queue_entries
SET receiving_peer_reviews_exercise_slide_submission_id = $1,
  peer_review_priority = $2
WHERE id = $3
RETURNING *
    ",
        receiving_peer_reviews_exercise_slide_submission_id,
        peer_review_priority,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<PeerReviewQueueEntry> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
SELECT *
FROM peer_review_queue_entries
WHERE id = $1
  AND deleted_at IS NULL
        ",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

async fn get_by_receiving_peer_reviews_submission_and_course_ids(
    conn: &mut PgConnection,
    receiving_peer_reviews_exercise_slide_submission_id: Uuid,
    course_id: Uuid,
) -> ModelResult<PeerReviewQueueEntry> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
SELECT *
FROM peer_review_queue_entries
WHERE receiving_peer_reviews_exercise_slide_submission_id = $1
  AND course_id = $2
  AND deleted_at IS NULL
    ",
        receiving_peer_reviews_exercise_slide_submission_id,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn try_to_get_by_receiving_submission_and_course_ids(
    conn: &mut PgConnection,
    receiving_peer_reviews_exercise_slide_submission_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Option<PeerReviewQueueEntry>> {
    get_by_receiving_peer_reviews_submission_and_course_ids(
        conn,
        receiving_peer_reviews_exercise_slide_submission_id,
        course_id,
    )
    .await
    .optional()
}

pub async fn get_by_user_and_exercise_and_course_ids(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_id: Uuid,
) -> ModelResult<PeerReviewQueueEntry> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
SELECT *
FROM peer_review_queue_entries
WHERE user_id = $1
  AND exercise_id = $2
  AND course_id = $3
  AND deleted_at IS NULL
        ",
        user_id,
        exercise_id,
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn try_to_get_by_user_and_exercise_and_course_ids(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Option<PeerReviewQueueEntry>> {
    get_by_user_and_exercise_and_course_ids(conn, user_id, exercise_id, course_id)
        .await
        .optional()
}

/// Gets multiple records of `PeerReviewQueueEntry` ordered by peer review priority. Also returns entries that don't need peer review.
///
/// Doesn't differentiate between different course instances.
pub async fn get_many_by_exercise_id_and_review_priority(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    excluded_user_id: Uuid,
    excluded_submissions_ids: &[Uuid],
    count: i64,
) -> ModelResult<Vec<PeerReviewQueueEntry>> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
SELECT *
FROM peer_review_queue_entries
WHERE exercise_id = $1
  AND user_id <> $2
  AND receiving_peer_reviews_exercise_slide_submission_id <> ALL($3)
  AND deleted_at IS NULL
ORDER BY peer_review_priority DESC
LIMIT $4
            ",
        exercise_id,
        excluded_user_id,
        excluded_submissions_ids,
        count,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Gets multiple records of `PeerReviewQueueEntry` that still require more peer reviews, ordered by
/// peer review priority.
///
/// Doesn't differentiate between different course instances.
pub async fn get_many_that_need_peer_reviews_by_exercise_id_and_review_priority(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    excluded_user_id: Uuid,
    excluded_submissions_ids: &[Uuid],
    count: i64,
) -> ModelResult<Vec<PeerReviewQueueEntry>> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
SELECT *
FROM peer_review_queue_entries
WHERE exercise_id = $1
  AND user_id <> $2
  AND receiving_peer_reviews_exercise_slide_submission_id <> ALL($3)
  AND received_enough_peer_reviews = 'false'
  AND removed_from_queue_for_unusual_reason = 'false'
  AND deleted_at IS NULL
ORDER BY peer_review_priority DESC
LIMIT $4
        ",
        exercise_id,
        excluded_user_id,
        excluded_submissions_ids,
        count,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Gets multiple records of `PeerReviewQueueEntry` that still require more peer reviews, ordered by
/// peer review priority.
///
/// Doesn't differentiate between different course instances.
pub async fn get_all_that_need_peer_reviews_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<Vec<PeerReviewQueueEntry>> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
SELECT *
FROM peer_review_queue_entries
WHERE exercise_id = $1
  AND received_enough_peer_reviews = 'false'
  AND deleted_at IS NULL
        ",
        exercise_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn increment_peer_review_priority(
    conn: &mut PgConnection,
    peer_review_queue_entry: PeerReviewQueueEntry,
) -> ModelResult<PeerReviewQueueEntry> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
UPDATE peer_review_queue_entries
SET peer_review_priority = $1
WHERE id = $2
  AND deleted_at IS NULL
RETURNING *
    ",
        peer_review_queue_entry.peer_review_priority + 1,
        peer_review_queue_entry.id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn remove_queue_entries_for_unusual_reason(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE peer_review_queue_entries
SET removed_from_queue_for_unusual_reason = TRUE
WHERE user_id = $1
  AND exercise_id = $2
  AND course_id = $3
  AND deleted_at IS NULL
    ",
        user_id,
        exercise_id,
        course_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_entries_that_need_reviews_and_are_older_than(
    conn: &mut PgConnection,
    course_id: Uuid,
    timestamp: DateTime<Utc>,
) -> ModelResult<Vec<PeerReviewQueueEntry>> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
SELECT *
FROM peer_review_queue_entries
WHERE course_id = $1
  AND received_enough_peer_reviews = FALSE
  AND removed_from_queue_for_unusual_reason = FALSE
  AND created_at < $2
  AND deleted_at IS NULL
    ",
        course_id,
        timestamp
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(res)
}

pub async fn get_entries_that_need_reviews_and_are_older_than_with_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    timestamp: DateTime<Utc>,
) -> ModelResult<Vec<PeerReviewQueueEntry>> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
SELECT *
FROM peer_review_queue_entries
WHERE exercise_id = $1
  AND received_enough_peer_reviews = FALSE
  AND removed_from_queue_for_unusual_reason = FALSE
  AND created_at < $2
  AND deleted_at IS NULL
    ",
        exercise_id,
        timestamp
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(res)
}

pub async fn remove_from_queue_and_add_to_manual_review(
    conn: &mut PgConnection,
    peer_review_queue_entry: &PeerReviewQueueEntry,
) -> ModelResult<PeerReviewQueueEntry> {
    let mut tx = conn.begin().await?;
    let res = remove_from_queue(&mut tx, peer_review_queue_entry).await?;

    let _ues = user_exercise_states::update_reviewing_stage(
        &mut tx,
        peer_review_queue_entry.user_id,
        user_exercise_states::CourseOrExamId::Course(peer_review_queue_entry.course_id),
        peer_review_queue_entry.exercise_id,
        ReviewingStage::WaitingForManualGrading,
    )
    .await?;
    tx.commit().await?;
    Ok(res)
}

pub async fn remove_from_queue_and_give_full_points(
    conn: &mut PgConnection,
    peer_review_queue_entry: &PeerReviewQueueEntry,
) -> ModelResult<PeerReviewQueueEntry> {
    let mut tx = conn.begin().await?;
    let res = remove_from_queue(&mut tx, peer_review_queue_entry).await?;
    let exercise = exercises::get_by_id(&mut tx, peer_review_queue_entry.exercise_id).await?;
    let user_exercise_state = user_exercise_states::get_user_exercise_state_if_exists(
        &mut tx,
        peer_review_queue_entry.user_id,
        peer_review_queue_entry.exercise_id,
        user_exercise_states::CourseOrExamId::Course(peer_review_queue_entry.course_id),
    )
    .await?;
    if let Some(user_exercise_state) = user_exercise_state {
        teacher_grading_decisions::add_teacher_grading_decision(
            &mut tx,
            user_exercise_state.id,
            teacher_grading_decisions::TeacherDecisionType::FullPoints,
            exercise.score_maximum as f32,
            // Giver is none because the system made the decision
            None,
            None,
            false,
        )
        .await?;
        user_exercise_state_updater::update_user_exercise_state(&mut tx, user_exercise_state.id)
            .await?;
    } else {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "User exercise state not found".to_string(),
            None,
        ));
    }

    tx.commit().await?;
    Ok(res)
}

async fn remove_from_queue(
    conn: &mut PgConnection,
    peer_review_queue_entry: &PeerReviewQueueEntry,
) -> ModelResult<PeerReviewQueueEntry> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
UPDATE peer_review_queue_entries
SET removed_from_queue_for_unusual_reason = TRUE
WHERE id = $1
RETURNING *
    ",
        peer_review_queue_entry.id
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(res)
}

pub async fn delete_by_receiving_peer_reviews_exercise_slide_submission_id(
    conn: &mut PgConnection,
    receiving_peer_reviews_exercise_slide_submission_id: Uuid,
) -> ModelResult<()> {
    sqlx::query_as!(
        PeerReviewQueueEntry,
        "
UPDATE peer_review_queue_entries
SET deleted_at = now()
WHERE receiving_peer_reviews_exercise_slide_submission_id = $1
AND deleted_at is NULL
    ",
        receiving_peer_reviews_exercise_slide_submission_id
    )
    .execute(&mut *conn)
    .await?;

    Ok(())
}

pub async fn get_all_by_user_and_course_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Vec<PeerReviewQueueEntry>> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
SELECT *
FROM peer_review_queue_entries
WHERE user_id = $1
  AND course_id = $2
  AND deleted_at IS NULL
        ",
        user_id,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn try_to_get_all_by_user_and_course_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Option<Vec<PeerReviewQueueEntry>>> {
    get_all_by_user_and_course_id(conn, user_id, course_id)
        .await
        .optional()
}
