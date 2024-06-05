use std::sync::Arc;

use crate::{
    domain::models_requests::{self, JwtKey},
    prelude::*,
};
use chrono::{Duration, Utc};
use futures_util::future::OptionFuture;
use models::{
    exercises::Exercise,
    library::grading::{
        GradingPolicy, StudentExerciseSlideSubmission, StudentExerciseSlideSubmissionResult,
    },
    user_exercise_states::{CourseInstanceOrExamId, ExerciseWithUserState},
};

pub async fn process_submission(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise: Exercise,
    submission: &StudentExerciseSlideSubmission,
    jwt_key: Arc<JwtKey>,
) -> Result<StudentExerciseSlideSubmissionResult, ControllerError> {
    enforce_deadline(conn, &exercise).await?;

    let (course_instance_or_exam_id, last_try) =
        resolve_course_instance_or_exam_id_and_verify_that_user_can_submit(
            conn,
            user_id,
            &exercise,
            submission.exercise_slide_id,
        )
        .await?;

    // TODO: Should this be an upsert?
    let user_exercise_state = models::user_exercise_states::get_user_exercise_state_if_exists(
        conn,
        user_id,
        exercise.id,
        course_instance_or_exam_id,
    )
    .await?
    .ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::Unauthorized,
            "Missing exercise state.".to_string(),
            None,
        )
    })?;

    let mut exercise_with_user_state = ExerciseWithUserState::new(exercise, user_exercise_state)?;
    let mut result = models::library::grading::grade_user_submission(
        conn,
        &mut exercise_with_user_state,
        submission,
        GradingPolicy::Default,
        models_requests::fetch_service_info,
        models_requests::make_grading_request_sender(jwt_key),
    )
    .await?;

    if exercise_with_user_state.is_exam_exercise() {
        // If exam, we don't want to expose model any grading details.
        result.clear_grading_information();
    }

    let score_given = if let Some(exercise_status) = &result.exercise_status {
        exercise_status.score_given.unwrap_or(0.0)
    } else {
        0.0
    };

    // Model solution spec should only be shown when this is the last try for the current slide or they have gotten full points from the current slide.
    // TODO: this uses points for the whole exercise, change this to slide points when slide grading finalized
    let has_received_full_points = score_given
        >= exercise_with_user_state.exercise().score_maximum as f32
        || (score_given - exercise_with_user_state.exercise().score_maximum as f32).abs() < 0.0001;
    if !has_received_full_points && !last_try {
        result.clear_model_solution_specs();
    }
    Ok(result)
}

/// Returns an error if the chapter's or exercise's deadline has passed.
async fn enforce_deadline(
    conn: &mut PgConnection,
    exercise: &Exercise,
) -> Result<(), ControllerError> {
    let chapter_option_future: OptionFuture<_> = exercise
        .chapter_id
        .map(|id| models::chapters::get_chapter(conn, id))
        .into();
    let chapter = chapter_option_future.await.transpose()?;

    // Exercise deadlines takes precedence to chapter deadlines
    if let Some(deadline) = exercise
        .deadline
        .or_else(|| chapter.and_then(|c| c.deadline))
    {
        if Utc::now() + Duration::seconds(1) >= deadline {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "Exercise deadline passed.".to_string(),
                None,
            ));
        }
    }

    Ok(())
}

/// Submissions for exams are posted from course instances or from exams. Make respective validations
/// while figuring out which.
async fn resolve_course_instance_or_exam_id_and_verify_that_user_can_submit(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise: &Exercise,
    slide_id: Uuid,
) -> Result<(CourseInstanceOrExamId, bool), ControllerError> {
    let mut last_try = false;
    let course_instance_id_or_exam_id: CourseInstanceOrExamId = if let Some(course_id) =
        exercise.course_id
    {
        // If submitting for a course, there should be existing course settings that dictate which
        // instance the user is on.
        let settings = models::user_course_settings::get_user_course_settings_by_course_id(
            conn, user_id, course_id,
        )
        .await?;
        if let Some(settings) = settings {
            let token = authorize(conn, Act::View, Some(user_id), Res::Course(course_id)).await?;
            token.authorized_ok(CourseInstanceOrExamId::Instance(
                settings.current_course_instance_id,
            ))
        } else {
            Err(ControllerError::new(
                ControllerErrorType::Unauthorized,
                "User is not enrolled on this course.".to_string(),
                None,
            ))
        }
    } else if let Some(exam_id) = exercise.exam_id {
        // If submitting for an exam, make sure that user's time is not up.
        if models::exams::verify_exam_submission_can_be_made(conn, exam_id, user_id).await? {
            let token = authorize(conn, Act::View, Some(user_id), Res::Exam(exam_id)).await?;
            token.authorized_ok(CourseInstanceOrExamId::Exam(exam_id))
        } else {
            Err(ControllerError::new(
                ControllerErrorType::Unauthorized,
                "Submissions for this exam are no longer accepted.".to_string(),
                None,
            ))
        }
    } else {
        // On database level this scenario is impossible.
        Err(ControllerError::new(
            ControllerErrorType::InternalServerError,
            "Exam doesn't belong to either a course nor exam.".to_string(),
            None,
        ))
    }?
    .data;
    if exercise.limit_number_of_tries {
        if let Some(max_tries_per_slide) = exercise.max_tries_per_slide {
            // check if the user has attempts remaining
            let slide_id_to_submissions_count =
                models::exercise_slide_submissions::get_exercise_slide_submission_counts_for_exercise_user(
                    conn,
                    exercise.id,
                    course_instance_id_or_exam_id,
                    user_id,
                )
                .await?;

            let count = slide_id_to_submissions_count.get(&slide_id).unwrap_or(&0);
            if count >= &(max_tries_per_slide as i64) {
                return Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "You've ran out of tries.".to_string(),
                    None,
                ));
            }
            if count + 1 >= (max_tries_per_slide as i64) {
                last_try = true;
            }
        }
    }
    Ok((course_instance_id_or_exam_id, last_try))
}
