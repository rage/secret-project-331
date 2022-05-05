use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReview {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_instance_id: Uuid,
    pub exercise_id: Option<Uuid>,
}

pub async fn insert(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    exercise_id: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_reviews (course_instance_id, exercise_id)
VALUES ($1, $2)
RETURNING id;
        ",
        course_instance_id,
        exercise_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn insert_with_id(
    conn: &mut PgConnection,
    id: Uuid,
    course_instance_id: Uuid,
    exercise_id: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_reviews (id, course_instance_id, exercise_id)
VALUES ($1, $2, $3)
RETURNING id;
        ",
        id,
        course_instance_id,
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

pub async fn get_by_exercise_or_course_instance_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<PeerReview> {
    match try_to_get_by_exercise_id(conn, exercise_id).await? {
        Some(peer_review) => Ok(peer_review),
        None => {
            let peer_review =
                get_default_for_course_instance_by_course_instance_id(conn, course_instance_id)
                    .await?;
            Ok(peer_review)
        }
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
  AND deleted_at IS NULL;
        ",
        exercise_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_default_for_course_instance_by_course_instance_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<PeerReview> {
    let res = sqlx::query_as!(
        PeerReview,
        "
SELECT *
FROM peer_reviews
WHERE course_instance_id = $1
  AND exercise_id IS NULL
  AND deleted_at IS NULL;
        ",
        course_instance_id
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
        insert_data!(:tx, :user, :org, :course, :instance);

        let peer_review_1 = insert(tx.as_mut(), instance.id, None).await;
        assert!(peer_review_1.is_ok());

        let peer_review_2 = insert(tx.as_mut(), instance.id, None).await;
        assert!(peer_review_2.is_err());
    }
}
