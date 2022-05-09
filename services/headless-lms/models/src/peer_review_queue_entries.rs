use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewQueueEntry {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub peer_review_id: Uuid,
    pub receiving_peer_reviews_exercise_slide_submission_id: Uuid,
    pub received_enough_peer_reviews: bool,
    pub peer_review_priority: i32,
}

pub async fn upsert(
    conn: &mut PgConnection,
    user_id: Uuid,
    peer_review_id: Uuid,
    submission_id: Uuid,
) -> ModelResult<()> {
    let _res = sqlx::query!(
        "
INSERT INTO peer_review_queue_entries (
    user_id,
    peer_review_id,
    receiving_peer_reviews_exercise_slide_submission_id
  )
VALUES ($1, $2, $3) ON CONFLICT (user_id, peer_review_id) DO
UPDATE
SET receiving_peer_reviews_exercise_slide_submission_id = $3,
  deleted_at = NULL
        ",
        user_id,
        peer_review_id,
        submission_id,
    )
    .execute(conn)
    .await?;
    Ok(())
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

pub async fn get_many_by_exercise_id_and_review_priority(
    conn: &mut PgConnection,
    peer_review_id: Uuid,
    excluded_user_id: Uuid,
    excluded_submissions_ids: &[Uuid],
    count: i64,
) -> ModelResult<Vec<PeerReviewQueueEntry>> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
SELECT *
FROM peer_review_queue_entries
WHERE peer_review_id = $1
  AND user_id <> $2
  AND receiving_peer_reviews_exercise_slide_submission_id NOT IN (
    SELECT UNNEST($3::uuid [])
  )
  AND deleted_at IS NULL
ORDER BY peer_review_priority DESC
LIMIT $4
            ",
        peer_review_id,
        excluded_user_id,
        excluded_submissions_ids,
        count,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_many_that_need_peer_reviews_by_exercise_id_and_review_priority(
    conn: &mut PgConnection,
    peer_review_id: Uuid,
    excluded_user_id: Uuid,
    excluded_submissions_ids: &[Uuid],
    count: i64,
) -> ModelResult<Vec<PeerReviewQueueEntry>> {
    let res = sqlx::query_as!(
        PeerReviewQueueEntry,
        "
SELECT *
FROM peer_review_queue_entries
WHERE peer_review_id = $1
  AND user_id <> $2
  AND receiving_peer_reviews_exercise_slide_submission_id NOT IN (
    SELECT UNNEST($3::uuid [])
  )
  AND received_enough_peer_reviews = 'true'
  AND deleted_at IS NULL
ORDER BY peer_review_priority DESC
LIMIT $4
        ",
        peer_review_id,
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
