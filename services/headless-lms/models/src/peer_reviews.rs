use crate::{
    exercises,
    library::{self, peer_reviewing::CourseMaterialPeerReviewData},
    prelude::*,
    user_exercise_states::{self, ReviewingStage},
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
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
    pub accepting_threshold: f32,
    pub accepting_strategy: PeerReviewAcceptingStrategy,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CmsPeerReview {
    pub id: Uuid,
    pub course_id: Uuid,
    pub exercise_id: Option<Uuid>,
    pub peer_reviews_to_give: i32,
    pub peer_reviews_to_receive: i32,
    pub accepting_threshold: f32,
    pub accepting_strategy: PeerReviewAcceptingStrategy,
}

/**
Determines how we will treat the answer being peer reviewed once it has received enough reviews and the student has given enough peer reviews.

Some strategies compare the overall received peer review likert answer (1-5) average to peer_reviews.accepting threshold.
*/
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(
    type_name = "peer_review_accepting_strategy",
    rename_all = "snake_case"
)]
pub enum PeerReviewAcceptingStrategy {
    /// If the average of the peer review likert answers is greater than the threshold, the peer review is accepted, otherwise it is rejected.
    AutomaticallyAcceptOrRejectByAverage,
    /// If the average of the peer review likert answers is greater than the threshold, the peer review is accepted, otherwise it is sent to be manually reviewed by the teacher.
    AutomaticallyAcceptOrManualReviewByAverage,
    /// All answers will be sent to be manually reviewed by the teacher once they have received and given enough peer reviews.
    ManualReviewEverything,
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
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  course_id,
  exercise_id,
  peer_reviews_to_give,
  peer_reviews_to_receive,
  accepting_threshold,
  accepting_strategy AS "accepting_strategy: _"
FROM peer_reviews
WHERE id = $1
  AND deleted_at IS NULL
        "#,
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
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  course_id,
  exercise_id,
  peer_reviews_to_give,
  peer_reviews_to_receive,
  accepting_threshold,
  accepting_strategy AS "accepting_strategy: _"
FROM peer_reviews
WHERE exercise_id = $1
  AND deleted_at IS NULL
        "#,
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
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  course_id,
  exercise_id,
  peer_reviews_to_give,
  peer_reviews_to_receive,
  accepting_threshold,
  accepting_strategy AS "accepting_strategy: _"
FROM peer_reviews
WHERE course_id = $1
  AND exercise_id IS NULL
  AND deleted_at IS NULL
        "#,
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

pub async fn get_course_material_peer_review_data(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
) -> ModelResult<CourseMaterialPeerReviewData> {
    let exercise = exercises::get_by_id(conn, exercise_id).await?;
    let (_current_exercise_slide, instance_or_exam_id) =
        exercises::get_or_select_exercise_slide(&mut *conn, Some(user_id), &exercise).await?;

    let user_exercise_state = match instance_or_exam_id {
        Some(course_instance_or_exam_id) => {
            user_exercise_states::get_user_exercise_state_if_exists(
                conn,
                user_id,
                exercise.id,
                course_instance_or_exam_id,
            )
            .await?
        }
        _ => None,
    };

    match user_exercise_state {
        Some(ref user_exercise_state) => {
            if user_exercise_state.reviewing_stage == ReviewingStage::PeerReview {
                // Calling library inside a model function. Maybe should be refactored by moving
                // complicated logic to own library file?
                let res = library::peer_reviewing::try_to_select_exercise_slide_submission_for_peer_review(
                    conn,
                    &exercise,
                    user_exercise_state,
                )
                .await?;
                Ok(res)
            } else {
                Err(ModelError::InvalidRequest(
                    "You cannot peer review yet".to_string(),
                ))
            }
        }
        None => Err(ModelError::InvalidRequest(
            "You haven't answered this exercise".to_string(),
        )),
    }
}

pub async fn get_peer_reviews_by_page_id(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Vec<CmsPeerReview>> {
    let res = sqlx::query_as!(
        CmsPeerReview,
        r#"
SELECT pr.id as id,
  pr.course_id as course_id,
  pr.exercise_id as exercise_id,
  pr.peer_reviews_to_give as peer_reviews_to_give,
  pr.peer_reviews_to_receive as peer_reviews_to_receive,
  pr.accepting_threshold as accepting_threshold,
  pr.accepting_strategy AS "accepting_strategy: _"
from pages p
  join exercises e on p.id = e.page_id
  join peer_reviews pr on e.id = pr.exercise_id
where p.id = $1
  AND p.deleted_at IS NULL
  AND e.deleted_at IS NULL
  AND pr.deleted_at IS NULL;
    "#,
        page_id,
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

pub async fn delete_peer_reviews_by_exrcise_ids(
    conn: &mut PgConnection,
    exercise_ids: &[Uuid],
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
UPDATE peer_reviews
SET deleted_at = now()
WHERE exercise_id = ANY ($1)
RETURNING id;
    ",
        exercise_ids
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .map(|x| x.id)
    .collect();
    Ok(res)
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
