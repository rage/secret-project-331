use models::exercise_task_gradings::ExerciseTaskGradingResult;

use crate::{domain::models_requests::GradingUpdateClaim, prelude::*};

/**
POST `/api/v0/exercise-services/grading/grading-update/:submission_id`

Receives a grading update from an exercise service.
*/
#[instrument(skip(pool))]
async fn grading_update(
    submission_id: web::Path<Uuid>,
    grading_result: web::Json<ExerciseTaskGradingResult>,
    grading_update_claim: GradingUpdateClaim,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<()>> {
    // accessed from exercise services, can't authenticate using login,
    // the upload claim is used to verify requests instead
    let token = skip_authorize();
    let grading_result = grading_result.into_inner();

    // Ensure that the claim is valid for this specific submission
    verify_claim_matches_submission(*submission_id, grading_update_claim.submission_id())?;

    let mut conn = pool.acquire().await?;
    apply_grading_update(&mut conn, *submission_id, &grading_result).await?;

    token.authorized_ok(web::Json(()))
}

/// Rejects a grading update whose signed claim authorizes a different submission than the one
/// addressed by the URL path. Extracted from the handler so the check is unit-testable without
/// a running server.
fn verify_claim_matches_submission(
    submission_id: Uuid,
    claim_submission_id: Uuid,
) -> Result<(), ControllerError> {
    if submission_id != claim_submission_id {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Grading upload claim didn't match the submission id".to_string(),
            None,
        ));
    }
    Ok(())
}

/// Applies a grading result to the submission's existing grading. Extracted from the handler so
/// tests can drive it with a transaction rather than a `PgPool` and a running `App`.
async fn apply_grading_update(
    conn: &mut PgConnection,
    submission_id: Uuid,
    grading_result: &ExerciseTaskGradingResult,
) -> Result<(), ControllerError> {
    let submission = models::exercise_task_submissions::get_submission(conn, submission_id).await?;
    let slide =
        models::exercise_slides::get_exercise_slide(conn, submission.exercise_slide_id).await?;
    let grading =
        models::exercise_task_gradings::get_by_exercise_task_submission_id(conn, submission_id)
            .await?
            .ok_or_else(|| {
                ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "No existing grading for the submission found".to_string(),
                    None,
                )
            })?;
    let exercise = models::exercises::get_by_id(conn, slide.exercise_id).await?;
    models::exercise_task_gradings::update_grading(conn, &grading, grading_result, &exercise)
        .await?;
    Ok(())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
#[doc(hidden)]
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "grading-update/{submission_id}",
        web::post().to(grading_update),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;
    use actix_web::ResponseError;
    use actix_web::http::StatusCode;
    use futures_util::FutureExt;
    use models::exercise_slide_submissions::NewExerciseSlideSubmission;
    use models::exercise_task_gradings::UserPointsUpdateStrategy;
    use models::exercises::GradingProgress;

    fn grading_result() -> ExerciseTaskGradingResult {
        ExerciseTaskGradingResult {
            grading_progress: GradingProgress::FullyGraded,
            score_given: 1.0,
            score_maximum: 1,
            feedback_text: Some("well done".to_string()),
            feedback_json: None,
            set_user_variables: None,
        }
    }

    /// An exercise service must not be able to use a claim signed for one submission to
    /// overwrite the grading of another; the path id and the claim's id have to agree.
    #[test]
    fn claim_for_another_submission_is_rejected() {
        let submission_id = Uuid::new_v4();
        let other_submission_id = Uuid::new_v4();
        let err = verify_claim_matches_submission(submission_id, other_submission_id)
            .expect_err("a claim for another submission must be rejected");
        assert_eq!(err.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
        let value = error_body(err);
        assert_eq!(value["type"], "validation_error");
        assert!(
            value["message"]
                .as_str()
                .unwrap_or_default()
                .contains("didn't match the submission id"),
            "unexpected message: {}",
            value["message"]
        );
    }

    #[test]
    fn claim_for_the_same_submission_is_accepted() {
        let submission_id = Uuid::new_v4();
        assert!(verify_claim_matches_submission(submission_id, submission_id).is_ok());
    }

    /// A grading update for a submission that was never sent out for grading has nothing to
    /// update; it must be a client error rather than a panic or a silent no-op.
    #[actix_web::test]
    async fn update_without_an_existing_grading_is_rejected() {
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, :task);
        let submission_id =
            insert_task_submission(&mut tx, user, course, exercise, slide, task).await;

        let err = apply_grading_update(tx.as_mut(), submission_id, &grading_result())
            .await
            .expect_err("a submission without a grading row must be rejected");
        assert_eq!(err.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
        let value = error_body(err);
        assert!(
            value["message"]
                .as_str()
                .unwrap_or_default()
                .contains("No existing grading for the submission found"),
            "unexpected message: {}",
            value["message"]
        );
    }

    /// Positive control for the test above: with a grading row present the same call writes the
    /// result through, so the rejection isn't just an unrelated failure.
    #[actix_web::test]
    async fn update_with_an_existing_grading_writes_the_result() {
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, :task);
        let submission_id =
            insert_task_submission(&mut tx, user, course, exercise, slide, task).await;
        let grading_id = models::exercise_task_gradings::insert(
            tx.as_mut(),
            models::PKeyPolicy::Generate,
            submission_id,
            course,
            exercise,
            task,
        )
        .await
        .unwrap();

        apply_grading_update(tx.as_mut(), submission_id, &grading_result())
            .await
            .expect("the grading update should be applied");

        let grading = models::exercise_task_gradings::get_by_id(tx.as_mut(), grading_id)
            .await
            .unwrap();
        assert_eq!(grading.grading_progress, GradingProgress::FullyGraded);
        assert_eq!(grading.unscaled_score_given, Some(1.0));
        assert_eq!(grading.feedback_text.as_deref(), Some("well done"));
        assert!(grading.grading_completed_at.is_some());
    }

    /// A submission id that doesn't exist at all must surface as an error rather than being
    /// treated as "no grading yet".
    #[actix_web::test]
    async fn update_for_an_unknown_submission_is_an_error() {
        insert_data!(:tx);
        apply_grading_update(tx.as_mut(), Uuid::new_v4(), &grading_result())
            .await
            .expect_err("an unknown submission id must not succeed");
    }

    /// Inserts a slide submission + task submission and returns the task submission id, which is
    /// what the grading-update route addresses.
    async fn insert_task_submission(
        tx: &mut Tx<'_>,
        user: Uuid,
        course: Uuid,
        exercise: Uuid,
        slide: Uuid,
        task: Uuid,
    ) -> Uuid {
        let slide_submission =
            models::exercise_slide_submissions::insert_exercise_slide_submission(
                tx.as_mut(),
                NewExerciseSlideSubmission {
                    exercise_slide_id: slide,
                    course_id: Some(course),
                    exam_id: None,
                    user_id: user,
                    exercise_id: exercise,
                    user_points_update_strategy:
                        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints,
                },
            )
            .await
            .unwrap();
        models::exercise_task_submissions::insert(
            tx.as_mut(),
            models::PKeyPolicy::Generate,
            slide_submission.id,
            slide,
            task,
            &serde_json::Value::Null,
        )
        .await
        .unwrap()
    }

    /// Decodes a controller error's JSON response body.
    fn error_body(err: ControllerError) -> serde_json::Value {
        let response = err.error_response();
        let bytes = actix_web::body::to_bytes(response.into_body())
            .now_or_never()
            .expect("body resolves immediately")
            .expect("body bytes");
        serde_json::from_slice(&bytes).expect("json")
    }
}
