use crate::{
    courses, exercise_slide_submissions, peer_review_queue_entries,
    prelude::*,
    user_exercise_states::{self, CourseInstanceOrExamId, ReviewingStage},
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct FlaggedAnswer {
    pub id: Uuid,
    pub submission_id: Uuid,
    pub flagged_user: Uuid,
    pub flagged_by: Uuid,
    pub reason: ReportReason,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "report_reason")]
pub enum ReportReason {
    #[sqlx(rename = "flagging-reason-spam")]
    Spam,
    #[sqlx(rename = "flagging-reason-harmful-content")]
    HarmfulContent,
    #[sqlx(rename = "flagging-reason-ai-generated")]
    AiGenerated,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewFlaggedAnswer {
    pub submission_id: Uuid,
    pub flagged_user: Option<Uuid>,
    pub flagged_by: Option<Uuid>,
    pub reason: ReportReason,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewFlaggedAnswerWithToken {
    pub submission_id: Uuid,
    pub flagged_user: Option<Uuid>,
    pub flagged_by: Option<Uuid>,
    pub reason: ReportReason,
    pub description: Option<String>,
    pub peer_or_self_review_config_id: Uuid,
    pub token: String,
}

pub async fn insert_flagged_answer_and_move_to_manual_review_if_needed(
    conn: &mut PgConnection,
    flagged_answer: NewFlaggedAnswerWithToken,
    user_id: Uuid,
) -> ModelResult<FlaggedAnswer> {
    let mut tx = conn.begin().await.map_err(|_| {
        ModelError::new(
            ModelErrorType::Generic,
            "Failed to start transaction".to_string(),
            None,
        )
    })?;
    // Fetch flagged submission data
    let flagged_submission_data =
        exercise_slide_submissions::get_by_id(&mut tx, flagged_answer.submission_id).await?;

    // Ensure the submission is related to a course
    let course_id = flagged_submission_data.course_id.ok_or_else(|| {
        ModelError::new(
            ModelErrorType::Generic,
            "Course id not found for the submission.".to_string(),
            None,
        )
    })?;

    let flagged_user = flagged_submission_data.user_id;
    println!(
        "Serialized ReportReason::Spam: {:?}",
        serde_json::to_string(&flagged_answer.reason)?
    );

    // Create a new flagged answer
    let new_flagged_answer = NewFlaggedAnswer {
        submission_id: flagged_answer.submission_id,
        flagged_user: Some(flagged_user),
        flagged_by: Some(user_id),
        reason: flagged_answer.reason,
        description: flagged_answer.description.clone(),
    };

    // Insert the flagged answer into the database
    let insert_result = insert_flagged_answer(&mut tx, new_flagged_answer).await?;

    // Increment the flag count
    let updated_flag_count = increment_flag_count(&mut tx, flagged_answer.submission_id).await?;

    // Fetch the course data
    let course = courses::get_course(&mut tx, course_id).await?;

    // Check if the flag count exceeds the courses flagged answers threshold.
    // If it does the move to manual review and remove from the peer review queue.
    if let Some(flagged_answers_threshold) = course.flagged_answers_threshold {
        if updated_flag_count >= flagged_answers_threshold {
            // Ensure course instance ID exists
            let course_instance_id = flagged_submission_data
                .course_instance_id
                .map(CourseInstanceOrExamId::Instance)
                .ok_or_else(|| {
                    ModelError::new(
                        ModelErrorType::Generic,
                        "No course instance found for the submission.".to_string(),
                        None,
                    )
                })?;

            // Move the answer to manual review
            let update_result = user_exercise_states::update_reviewing_stage(
                &mut tx,
                flagged_user,
                course_instance_id,
                flagged_submission_data.exercise_id,
                ReviewingStage::WaitingForManualGrading,
            )
            .await?;

            // Remove from peer review queue so other students can't review an answers that is already in manual review
            // Remove the answer from the peer review queue
            if let Some(instance_id) = update_result.course_instance_id {
                peer_review_queue_entries::remove_queue_entries_for_unusual_reason(
                    &mut tx,
                    flagged_user,
                    flagged_submission_data.exercise_id,
                    instance_id,
                )
                .await?;
            }
        }
    }
    tx.commit().await.map_err(|_| {
        ModelError::new(
            ModelErrorType::Generic,
            "Failed to commit transaction".to_string(),
            None,
        )
    })?;

    Ok(insert_result)
}

pub async fn insert_flagged_answer(
    conn: &mut PgConnection,
    flagged_answer: NewFlaggedAnswer,
) -> ModelResult<FlaggedAnswer> {
    let res = sqlx::query_as!(
        FlaggedAnswer,
        r#"
INSERT INTO flagged_answers (
    submission_id,
    flagged_user,
    flagged_by,
    reason,
    description
)
VALUES ($1, $2, $3, $4, $5)
RETURNING id,
  submission_id,
  flagged_user,
  flagged_by,
  reason AS "reason: _",
  description,
  created_at,
  updated_at,
  deleted_at
        "#,
        flagged_answer.submission_id,
        flagged_answer.flagged_user,
        flagged_answer.flagged_by,
        flagged_answer.reason as ReportReason,
        flagged_answer.description,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn increment_flag_count(
    conn: &mut PgConnection,
    submission_id: Uuid,
) -> ModelResult<i32> {
    let result = sqlx::query!(
        r#"
        UPDATE exercise_slide_submissions
        SET flag_count = COALESCE(flag_count, 0) + 1
        WHERE id = $1
        RETURNING flag_count
        "#,
        submission_id
    )
    .fetch_one(conn)
    .await?;

    Ok(result.flag_count)
}

pub async fn get_flagged_answers_by_submission_id(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<Vec<FlaggedAnswer>> {
    let results = sqlx::query_as!(
        FlaggedAnswer,
        r#"
        SELECT
            id,
            submission_id,
            flagged_user,
            flagged_by,
            reason AS "reason: _",
            description,
            created_at,
            updated_at,
            deleted_at
        FROM flagged_answers
        WHERE submission_id = $1
          AND deleted_at IS NULL
        "#,
        exercise_slide_submission_id
    )
    .fetch_all(conn)
    .await?;

    Ok(results)
}

pub async fn get_flagged_answers_submission_ids_by_flaggers_id(
    conn: &mut PgConnection,
    flagged_by: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let flagged_submissions = sqlx::query_as!(
        FlaggedAnswer,
        r#"
        SELECT
            id,
            submission_id,
            flagged_user,
            flagged_by,
            reason AS "reason: _",
            description,
            created_at,
            updated_at,
            deleted_at
        FROM flagged_answers
        WHERE flagged_by = $1
          AND deleted_at IS NULL
        "#,
        flagged_by
    )
    .fetch_all(conn)
    .await?;

    Ok(flagged_submissions
        .into_iter()
        .map(|row| row.submission_id)
        .collect())
}
