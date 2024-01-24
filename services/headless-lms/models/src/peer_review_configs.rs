use futures::future::BoxFuture;
use url::Url;

use crate::{
    exercise_service_info::ExerciseServiceInfoApi,
    exercises::{self, Exercise},
    library::{self, peer_reviewing::CourseMaterialPeerReviewData},
    peer_review_questions::{
        delete_peer_review_questions_by_peer_review_config_ids,
        upsert_multiple_peer_review_questions, CmsPeerReviewQuestion,
    },
    prelude::*,
    user_exercise_states::{self, ReviewingStage},
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewConfig {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub exercise_id: Option<Uuid>,
    pub peer_reviews_to_give: i32,
    pub peer_reviews_to_receive: i32,
    pub accepting_threshold: f32,
    pub processing_strategy: PeerReviewProcessingStrategy,
    pub manual_review_cutoff_in_days: i32,
    pub points_are_all_or_nothing: bool,
}

/// Like `PeerReviewConfig` but only the fields it's fine to show to all users.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialPeerReviewConfig {
    pub id: Uuid,
    pub course_id: Uuid,
    pub exercise_id: Option<Uuid>,
    pub peer_reviews_to_give: i32,
    pub peer_reviews_to_receive: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CmsPeerReviewConfig {
    pub id: Uuid,
    pub course_id: Uuid,
    pub exercise_id: Option<Uuid>,
    pub peer_reviews_to_give: i32,
    pub peer_reviews_to_receive: i32,
    pub accepting_threshold: f32,
    pub processing_strategy: PeerReviewProcessingStrategy,
    pub points_are_all_or_nothing: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CmsPeerReviewConfiguration {
    pub peer_review_config: CmsPeerReviewConfig,
    pub peer_review_questions: Vec<CmsPeerReviewQuestion>,
}

/**
Determines how we will treat the answer being peer reviewed once it has received enough reviews and the student has given enough peer reviews.

Some strategies compare the overall received peer review likert answer (1-5) average to peer_reviews.accepting threshold.
*/
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(
    type_name = "peer_review_processing_strategy",
    rename_all = "snake_case"
)]
pub enum PeerReviewProcessingStrategy {
    /// If the average of the peer review likert answers is greater than the threshold, the peer review is accepted, otherwise it is rejected.
    AutomaticallyGradeByAverage,
    /// If the average of the peer review likert answers is greater than the threshold, the peer review is accepted, otherwise it is sent to be manually reviewed by the teacher.
    AutomaticallyGradeOrManualReviewByAverage,
    /// All answers will be sent to be manually reviewed by the teacher once they have received and given enough peer reviews.
    ManualReviewEverything,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    course_id: Uuid,
    exercise_id: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_review_configs (id, course_id, exercise_id)
VALUES ($1, $2, $3)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        course_id,
        exercise_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn upsert_with_id(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    cms_peer_review: &CmsPeerReviewConfig,
) -> ModelResult<CmsPeerReviewConfig> {
    let res = sqlx::query_as!(
        CmsPeerReviewConfig,
        r#"
    INSERT INTO peer_review_configs (
    id,
    course_id,
    exercise_id,
    peer_reviews_to_give,
    peer_reviews_to_receive,
    accepting_threshold,
    processing_strategy,
    points_are_all_or_nothing
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO
UPDATE
SET course_id = excluded.course_id,
  exercise_id = excluded.exercise_id,
  peer_reviews_to_give = excluded.peer_reviews_to_give,
  peer_reviews_to_receive = excluded.peer_reviews_to_receive,
  accepting_threshold = excluded.accepting_threshold,
  processing_strategy = excluded.processing_strategy,
  points_are_all_or_nothing = excluded.points_are_all_or_nothing
RETURNING id,
  course_id,
  exercise_id,
  peer_reviews_to_give,
  peer_reviews_to_receive,
  accepting_threshold,
  processing_strategy AS "processing_strategy:_",
  points_are_all_or_nothing
"#,
        pkey_policy.into_uuid(),
        cms_peer_review.course_id,
        cms_peer_review.exercise_id,
        cms_peer_review.peer_reviews_to_give,
        cms_peer_review.peer_reviews_to_receive,
        cms_peer_review.accepting_threshold,
        cms_peer_review.processing_strategy as _,
        cms_peer_review.points_are_all_or_nothing,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<PeerReviewConfig> {
    let res = sqlx::query_as!(
        PeerReviewConfig,
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
  processing_strategy AS "processing_strategy: _",
  manual_review_cutoff_in_days,
  points_are_all_or_nothing
FROM peer_review_configs
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Usually you want to use `get_by_exercise_or_course_id` instead of this one.
pub async fn get_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<PeerReviewConfig> {
    let res = sqlx::query_as!(
        PeerReviewConfig,
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
    processing_strategy AS "processing_strategy: _",
    manual_review_cutoff_in_days,
    points_are_all_or_nothing
FROM peer_review_configs
WHERE exercise_id = $1
  AND deleted_at IS NULL
        "#,
        exercise_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Returns the correct peer review config depending on `exercise.use_course_default_peer_review_config`.
pub async fn get_by_exercise_or_course_id(
    conn: &mut PgConnection,
    exercise: &Exercise,
    course_id: Uuid,
) -> ModelResult<PeerReviewConfig> {
    if exercise.use_course_default_peer_review_config {
        get_default_for_course_by_course_id(conn, course_id).await
    } else {
        get_by_exercise_id(conn, exercise.id).await
    }
}

pub async fn get_default_for_course_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<PeerReviewConfig> {
    let res = sqlx::query_as!(
        PeerReviewConfig,
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
  processing_strategy AS "processing_strategy: _",
  manual_review_cutoff_in_days,
  points_are_all_or_nothing
FROM peer_review_configs
WHERE course_id = $1
  AND exercise_id IS NULL
  AND deleted_at IS NULL;
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
UPDATE peer_review_configs
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
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<CourseMaterialPeerReviewData> {
    let exercise = exercises::get_by_id(conn, exercise_id).await?;
    let (_current_exercise_slide, instance_or_exam_id) = exercises::get_or_select_exercise_slide(
        &mut *conn,
        Some(user_id),
        &exercise,
        &fetch_service_info,
    )
    .await?;

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
                    &fetch_service_info
                )
                .await?;
                Ok(res)
            } else {
                Err(ModelError::new(
                    ModelErrorType::PreconditionFailed,
                    "You cannot peer review yet".to_string(),
                    None,
                ))
            }
        }
        None => Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "You haven't answered this exercise".to_string(),
            None,
        )),
    }
}

pub async fn get_peer_reviews_by_page_id(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Vec<CmsPeerReviewConfig>> {
    let res = sqlx::query_as!(
        CmsPeerReviewConfig,
        r#"
SELECT pr.id as id,
  pr.course_id as course_id,
  pr.exercise_id as exercise_id,
  pr.peer_reviews_to_give as peer_reviews_to_give,
  pr.peer_reviews_to_receive as peer_reviews_to_receive,
  pr.accepting_threshold as accepting_threshold,
  pr.processing_strategy AS "processing_strategy: _",
  points_are_all_or_nothing
from pages p
  join exercises e on p.id = e.page_id
  join peer_review_configs pr on e.id = pr.exercise_id
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
UPDATE peer_review_configs
SET deleted_at = now()
WHERE exercise_id = ANY ($1)
AND deleted_at IS NULL
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

pub async fn get_course_default_cms_peer_review(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CmsPeerReviewConfig> {
    let res = sqlx::query_as!(
        CmsPeerReviewConfig,
        r#"
SELECT id,
  course_id,
  exercise_id,
  peer_reviews_to_give,
  peer_reviews_to_receive,
  accepting_threshold,
  processing_strategy AS "processing_strategy: _",
  points_are_all_or_nothing
FROM peer_review_configs
WHERE course_id = $1
  AND exercise_id IS NULL
  AND deleted_at IS NULL;
"#,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_cms_peer_review_by_id(
    conn: &mut PgConnection,
    peer_review_config_id: Uuid,
) -> ModelResult<CmsPeerReviewConfig> {
    let res = sqlx::query_as!(
        CmsPeerReviewConfig,
        r#"
SELECT id,
  course_id,
  exercise_id,
  peer_reviews_to_give,
  peer_reviews_to_receive,
  accepting_threshold,
  processing_strategy AS "processing_strategy:_",
  points_are_all_or_nothing
FROM peer_review_configs
WHERE id = $1;
    "#,
        peer_review_config_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn upsert_course_default_cms_peer_review_and_questions(
    conn: &mut PgConnection,
    peer_review_configuration: &CmsPeerReviewConfiguration,
) -> ModelResult<CmsPeerReviewConfiguration> {
    // Upsert peer review
    let peer_review_config = upsert_with_id(
        conn,
        PKeyPolicy::Fixed(peer_review_configuration.peer_review_config.id),
        &peer_review_configuration.peer_review_config,
    )
    .await?;

    // Upsert peer review questions
    let previous_peer_review_question_ids =
        delete_peer_review_questions_by_peer_review_config_ids(conn, &[peer_review_config.id])
            .await?;
    let peer_review_questions = upsert_multiple_peer_review_questions(
        conn,
        &peer_review_configuration
            .peer_review_questions
            .iter()
            .map(|prq| {
                let id = if previous_peer_review_question_ids.contains(&prq.id) {
                    prq.id
                } else {
                    Uuid::new_v4()
                };
                CmsPeerReviewQuestion { id, ..prq.clone() }
            })
            .collect::<Vec<_>>(),
    )
    .await?;

    Ok(CmsPeerReviewConfiguration {
        peer_review_config,
        peer_review_questions,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;

    #[tokio::test]
    async fn only_one_default_peer_review_per_course() {
        insert_data!(:tx, :user, :org, :course);

        let peer_review_1 = insert(tx.as_mut(), PKeyPolicy::Generate, course, None).await;
        assert!(peer_review_1.is_err());
    }
}
