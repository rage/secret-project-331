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
}

pub async fn insert(
    conn: &mut PgConnection,
    course_id: Uuid,
    exercise_id: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_reviews (course_id, exercise_id)
VALUES ($1, $2)
RETURNING id;
        ",
        course_id,
        exercise_id
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
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_reviews (id, course_id, exercise_id)
VALUES ($1, $2, $3)
RETURNING id;
        ",
        id,
        course_id,
        exercise_id
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
  AND deleted_at IS NULL;
        ",
        id
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
RETURNING id;
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
        insert_data!(:tx, :user, :org, course: course_id);

        let peer_review_1 = insert(tx.as_mut(), course_id, None).await;
        assert!(peer_review_1.is_ok());

        let peer_review_2 = insert(tx.as_mut(), course_id, None).await;
        assert!(peer_review_2.is_err());
    }
}
