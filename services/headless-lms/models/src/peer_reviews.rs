use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReview {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub exercise_id: Option<Uuid>,
    pub peer_reviews_to_give: i32,
    pub peer_reviews_to_receive: i32,
}

pub async fn insert(
    conn: &mut PgConnection,
    course_id: Uuid,
    exercise_id: Option<Uuid>,
    peer_reviews_to_give: i32,
    peer_reviews_to_receive: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_reviews (
    course_id,
    exercise_id,
    peer_reviews_to_give,
    peer_reviews_to_receive
  )
VALUES ($1, $2, $3, $4)
RETURNING id
        ",
        course_id,
        exercise_id,
        peer_reviews_to_give,
        peer_reviews_to_receive,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn insert_with_id(
    conn: &mut PgConnection,
    id: Uuid,
    course_id: Uuid,
    exercise_id: Option<Uuid>,
    peer_reviews_to_give: i32,
    peer_reviews_to_receive: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_reviews (
    id,
    course_id,
    exercise_id,
    peer_reviews_to_give,
    peer_reviews_to_receive
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
        ",
        id,
        course_id,
        exercise_id,
        peer_reviews_to_give,
        peer_reviews_to_receive,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<PeerReview> {
    let res = sqlx::query_as!(
        PeerReview,
        "
SELECT *
FROM peer_reviews
WHERE id = $1
  AND deleted_at IS NULL
        ",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_exercise_or_course_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    course_id: Uuid,
) -> ModelResult<PeerReview> {
    match try_to_get_by_exercise_id(conn, exercise_id).await? {
        Some(peer_review) => Ok(peer_review),
        None => get_default_for_course_by_course_id(conn, course_id).await,
    }
}

pub async fn try_to_get_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<Option<PeerReview>> {
    let res = sqlx::query_as!(
        PeerReview,
        "
SELECT *
FROM peer_reviews
WHERE exercise_id = $1
  AND deleted_at IS NULL
        ",
        exercise_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_default_for_course_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<PeerReview> {
    let res = sqlx::query_as!(
        PeerReview,
        "
SELECT *
FROM peer_reviews
WHERE course_id = $1
  AND exercise_id IS NULL
  AND deleted_at IS NULL
        ",
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
UPDATE peer_reviews
SET deleted_at = now()
WHERE id = $1
RETURNING id
    ",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;

    #[tokio::test]
    async fn only_one_default_peer_review_per_course() {
        insert_data!(:tx, :user, :org, :course);

        let peer_review_1 = insert(tx.as_mut(), course, None, 3, 2).await;
        assert!(peer_review_1.is_ok());

        let peer_review_2 = insert(tx.as_mut(), course, None, 3, 2).await;
        assert!(peer_review_2.is_err());
    }
}
