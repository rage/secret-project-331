use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewQueueEntry {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub exercise_id: Uuid,
    pub course_instance_id: Uuid,
    pub receiving_peer_reviews_exercise_slide_submission_id: Uuid,
    pub received_enough_peer_reviews: bool,
    pub peer_review_priority: i32,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
    receiving_peer_reviews_exercise_slide_submission_id: Uuid,
    peer_review_priority: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_review_queue_entries (
    user_id,
    exercise_id,
    course_instance_id,
    receiving_peer_reviews_exercise_slide_submission_id,
    peer_review_priority
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
        ",
        user_id,
        exercise_id,
        course_instance_id,
        receiving_peer_reviews_exercise_slide_submission_id,
        peer_review_priority,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn upsert(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
    receiving_peer_reviews_exercise_slide_submission_id: Uuid,
) -> ModelResult<PeerReviewQueueEntry> {
    // Can't do actual upsert due to partial constraint.
    let peer_review_queue_entry = try_to_get_by_user_and_exercise_and_course_instance_ids(
        conn,
        user_id,
        exercise_id,
        course_instance_id,
    )
    .await?;
    if let Some(peer_review_queue_entry) = peer_review_queue_entry {
        let peer_review_queue_entry = update(
            conn,
            peer_review_queue_entry.id,
            receiving_peer_reviews_exercise_slide_submission_id,
            0,
        )
        .await?;
        Ok(peer_review_queue_entry)
    } else {
        let peer_review_queue_entry_id = insert(
            conn,
            user_id,
            exercise_id,
            course_instance_id,
            receiving_peer_reviews_exercise_slide_submission_id,
            0,
        )
        .await?;
        let peer_review_queue_entry = get_by_id(conn, peer_review_queue_entry_id).await?;
        Ok(peer_review_queue_entry)
    }
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

pub async fn get_by_user_and_exercise_and_course_instance_ids(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<PeerReviewQueueEntry> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
SELECT *
FROM peer_review_queue_entries
WHERE user_id = $1
  AND exercise_id = $2
  AND course_instance_id = $3
  AND deleted_at IS NULL
        ",
        user_id,
        exercise_id,
        course_instance_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn try_to_get_by_user_and_exercise_and_course_instance_ids(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Option<PeerReviewQueueEntry>> {
    get_by_user_and_exercise_and_course_instance_ids(conn, user_id, exercise_id, course_instance_id)
        .await
        .optional()
}

/// Gets multiple records of `PeerReviewQueueEntry` ordered by peer review priority.
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
  AND receiving_peer_reviews_exercise_slide_submission_id NOT IN (
    SELECT UNNEST($3::uuid [])
  )
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
  AND receiving_peer_reviews_exercise_slide_submission_id NOT IN (
    SELECT UNNEST($3::uuid [])
  )
  AND received_enough_peer_reviews = 'true'
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
